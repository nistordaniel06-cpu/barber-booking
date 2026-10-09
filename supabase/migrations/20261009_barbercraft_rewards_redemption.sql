-- BARBERCRAFT: redeemable reward claims, authenticated staff confirmation, expiring QR.
-- No customer payments, discounts or territory-war automation are activated by this migration.
create table if not exists public.bc_reward_salon_offers(
 salon_id uuid not null references public.bc_salons(id) on delete cascade,
 reward_id uuid not null references public.bc_reward_templates(id) on delete cascade,
 enabled boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(salon_id,reward_id)
);
create table if not exists public.bc_reward_claims(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 salon_id uuid not null references public.bc_salons(id),
 reward_id uuid not null references public.bc_reward_templates(id),
 reward_title text not null,
 points_cost integer not null check(points_cost>=1),
 status text not null default 'requested' check(status in ('requested','redeemed','cancelled')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+ interval '7 days'),
 redeemed_at timestamptz,
 redeemed_by uuid references auth.users(id),
 qr_hash text,
 qr_expires_at timestamptz,
 constraint bc_reward_claim_redeem_consistency check(
  (status='redeemed' and redeemed_at is not null and redeemed_by is not null)
  or (status<>'redeemed' and redeemed_at is null and redeemed_by is null))
);
create index if not exists bc_reward_claims_user on public.bc_reward_claims(user_id,created_at desc);
create index if not exists bc_reward_claims_stock on public.bc_reward_claims(reward_id,status,expires_at);
create index if not exists bc_reward_claims_salon on public.bc_reward_claims(salon_id,status,created_at desc);
alter table public.bc_reward_claims enable row level security;
alter table public.bc_reward_salon_offers enable row level security;
revoke all on public.bc_reward_claims,public.bc_reward_salon_offers from public,anon,authenticated;
grant select on public.bc_reward_claims to authenticated;
drop policy if exists bc_reward_claims_own on public.bc_reward_claims;
create policy bc_reward_claims_own on public.bc_reward_claims
 for select to authenticated using(user_id=(select auth.uid()));
-- Salon participation is managed strictly via owner-checked RPC; no direct table writes.

create or replace function public.bc_reward_available_partners()
returns table(reward_id uuid,salon_id uuid,salon_name text)
language sql stable security definer set search_path=''
as $$
 select o.reward_id,o.salon_id,s.name
 from public.bc_reward_salon_offers o
 join public.bc_salons s on s.id=o.salon_id
 join public.bc_reward_templates r on r.id=o.reward_id
 where o.enabled and r.is_active
   and exists(select 1 from public.bc_public_salon_catalog c
              where c.salon_id=s.id and c.visibility='listed')
 order by s.name;
$$;
revoke all on function public.bc_reward_available_partners() from public;
grant execute on function public.bc_reward_available_partners() to authenticated,anon;

create or replace function public.bc_reward_partner_set(
 p_salon uuid,p_reward uuid,p_enabled boolean
) returns boolean language plpgsql security definer set search_path=''
as $$
begin
 if (select auth.uid()) is null or not public.bc_is_salon_admin(p_salon) then
  raise exception 'NOT_SALON_OWNER';
 end if;
 if not exists(select 1 from public.bc_reward_templates where id=p_reward)
 then raise exception 'REWARD_UNKNOWN';end if;
 insert into public.bc_reward_salon_offers(salon_id,reward_id,enabled)
 values(p_salon,p_reward,coalesce(p_enabled,false))
 on conflict(salon_id,reward_id) do update set
 enabled=excluded.enabled,updated_at=now();
 return true;
end;$$;
revoke all on function public.bc_reward_partner_set(uuid,uuid,boolean) from public,anon;
grant execute on function public.bc_reward_partner_set(uuid,uuid,boolean) to authenticated;

create or replace function public.bc_reward_partner_catalog(p_salon uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
 if (select auth.uid()) is null or not exists(
   select 1 from public.bc_salon_members m where m.salon_id=p_salon and m.user_id=(select auth.uid()))
 then raise exception 'NOT_SALON_STAFF';end if;
 return coalesce((
 select jsonb_agg(jsonb_build_object(
 'id',r.id,'title',r.title,'cost',r.points_cost,'active',r.is_active,
 'enabled',coalesce(o.enabled,false)) order by r.points_cost,r.title)
 from public.bc_reward_templates r
 left join public.bc_reward_salon_offers o on o.reward_id=r.id and o.salon_id=p_salon
 ),'[]'::jsonb);
end;$$;
revoke all on function public.bc_reward_partner_catalog(uuid) from public,anon;
grant execute on function public.bc_reward_partner_catalog(uuid) to authenticated;

create or replace function public.bc_reward_wallet()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare u uuid;earned bigint;spent bigint;
begin
 u:=(select auth.uid());
 if u is null then raise exception 'LOGIN_REQUIRED';end if;
 select coalesce(sum(loyalty_points),0) into earned
 from public.bc_tw_activity where user_id=u;
 select coalesce(sum(points_cost),0) into spent
 from public.bc_reward_claims where user_id=u
 and (status='redeemed' or (status='requested' and expires_at>now()));
 return jsonb_build_object(
  'earned',earned,'committed',spent,'available',greatest(earned-spent,0),
  'claims',coalesce((select jsonb_agg(jsonb_build_object(
    'id',c.id,'title',c.reward_title,'salon',s.name,'status',
    case when c.status='requested' and c.expires_at<=now() then 'expired' else c.status end,
    'cost',c.points_cost,'expires_at',c.expires_at,'created_at',c.created_at)
    order by c.created_at desc)
    from (select * from public.bc_reward_claims where user_id=u order by created_at desc limit 30)c
    join public.bc_salons s on s.id=c.salon_id
  ),'[]'::jsonb));
end;$$;
revoke all on function public.bc_reward_wallet() from public,anon;
grant execute on function public.bc_reward_wallet() to authenticated;

create or replace function public.bc_reward_claim_create(p_reward uuid,p_salon uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;r record;earned bigint;spent bigint;active_claims bigint;v_id uuid;
begin
 u:=(select auth.uid());
 if u is null then raise exception 'LOGIN_REQUIRED';end if;
 -- Serializes point reservations per user; reward row lock serializes stock checks.
 perform pg_advisory_xact_lock(hashtextextended('bc-reward-wallet:'||u::text,0));
 select * into r from public.bc_reward_templates where id=p_reward for update;
 if not found or not r.is_active or r.points_cost<1 then raise exception 'REWARD_NOT_AVAILABLE';end if;
 if not exists(select 1 from public.bc_reward_salon_offers o
               join public.bc_public_salon_catalog c on c.salon_id=o.salon_id and c.visibility='listed'
               where o.salon_id=p_salon and o.reward_id=r.id and o.enabled)
 then raise exception 'SALON_NOT_PARTICIPATING';end if;
 select count(*) into active_claims from public.bc_reward_claims
 where reward_id=r.id and (status='redeemed' or (status='requested' and expires_at>now()));
 if r.stock is not null and active_claims>=r.stock then raise exception 'REWARD_OUT_OF_STOCK';end if;
 select coalesce(sum(loyalty_points),0) into earned from public.bc_tw_activity where user_id=u;
 select coalesce(sum(points_cost),0) into spent from public.bc_reward_claims where user_id=u
 and (status='redeemed' or (status='requested' and expires_at>now()));
 if earned-spent<r.points_cost then raise exception 'INSUFFICIENT_POINTS';end if;
 insert into public.bc_reward_claims(user_id,salon_id,reward_id,reward_title,points_cost)
 values(u,p_salon,p_reward,r.title,r.points_cost) returning id into v_id;
 return jsonb_build_object('id',v_id,'status','requested',
   'points_reserved',r.points_cost,'expires_at',now()+interval '7 days');
end;$$;
revoke all on function public.bc_reward_claim_create(uuid,uuid) from public,anon;
grant execute on function public.bc_reward_claim_create(uuid,uuid) to authenticated;

create or replace function public.bc_reward_claim_cancel(p_claim uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare c record;
begin
 if (select auth.uid()) is null then raise exception 'LOGIN_REQUIRED';end if;
 select * into c from public.bc_reward_claims where id=p_claim for update;
 if not found or c.user_id<>(select auth.uid()) then raise exception 'CLAIM_NOT_FOUND';end if;
 if c.status<>'requested' then raise exception 'CLAIM_NOT_CANCELLABLE';end if;
 update public.bc_reward_claims set status='cancelled',qr_hash=null,qr_expires_at=null
 where id=p_claim;
 return true;
end;$$;
revoke all on function public.bc_reward_claim_cancel(uuid) from public,anon;
grant execute on function public.bc_reward_claim_cancel(uuid) to authenticated;

create or replace function public.bc_reward_claim_qr(p_claim uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare c record;secret text;payload text;until_time timestamptz;
begin
 if (select auth.uid()) is null then raise exception 'LOGIN_REQUIRED';end if;
 select * into c from public.bc_reward_claims where id=p_claim for update;
 if not found or c.user_id<>(select auth.uid()) then raise exception 'CLAIM_NOT_FOUND';end if;
 if c.status<>'requested' or c.expires_at<=now() then raise exception 'CLAIM_EXPIRED';end if;
 -- Rotate the token on each display; never reveal a client's auth token or private profile.
 secret:=gen_random_uuid()::text||'.'||gen_random_uuid()::text;
 payload:='BC1|'||c.id::text||'|'||secret;
 until_time:=least(c.expires_at,now()+interval '5 minutes');
 update public.bc_reward_claims
 set qr_hash=encode(extensions.digest(convert_to(payload,'UTF8'),'sha256'),'hex'),qr_expires_at=until_time
 where id=c.id;
 return jsonb_build_object('payload',payload,'valid_until',until_time,
 'salon_id',c.salon_id,'reward',c.reward_title);
end;$$;
revoke all on function public.bc_reward_claim_qr(uuid) from public,anon;
grant execute on function public.bc_reward_claim_qr(uuid) to authenticated;

create or replace function public.bc_reward_claim_redeem(p_salon uuid,p_qr text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare c record;claim_id uuid;actor uuid;
begin
 actor:=(select auth.uid());
 if actor is null then raise exception 'LOGIN_REQUIRED';end if;
 if not exists(select 1 from public.bc_salon_members m where m.user_id=actor and m.salon_id=p_salon)
 then raise exception 'NOT_SALON_STAFF';end if;
 if length(coalesce(p_qr,''))>200 or split_part(p_qr,'|',1)<>'BC1' or
    split_part(p_qr,'|',4)<>'' or split_part(p_qr,'|',3)=''
 then raise exception 'INVALID_QR';end if;
 begin claim_id:=split_part(p_qr,'|',2)::uuid;
 exception when invalid_text_representation then raise exception 'INVALID_QR';end;
 select * into c from public.bc_reward_claims where id=claim_id for update;
 if not found or c.salon_id<>p_salon or c.status<>'requested' or c.expires_at<=now()
 then raise exception 'CLAIM_NOT_VALID';end if;
 if c.qr_hash is null or c.qr_expires_at<=now() or c.qr_hash<>
     encode(extensions.digest(convert_to(p_qr,'UTF8'),'sha256'),'hex')
 then raise exception 'QR_EXPIRED_OR_INVALID';end if;
 update public.bc_reward_claims set status='redeemed',redeemed_at=now(),redeemed_by=actor,
 qr_hash=null,qr_expires_at=null where id=c.id;
 return jsonb_build_object('success',true,'reward',c.reward_title,'points_used',c.points_cost,'claim_id',c.id);
end;$$;
revoke all on function public.bc_reward_claim_redeem(uuid,text) from public,anon;
grant execute on function public.bc_reward_claim_redeem(uuid,text) to authenticated;
