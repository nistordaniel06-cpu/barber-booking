-- Promotional referral program: invitations are trackable, rewards initially DISABLED.
create table if not exists public.bc_referral_config(
 id integer primary key default 1 check(id=1),
 enabled boolean not null default false,
 client_referrer_points integer not null default 100 check(client_referrer_points between 0 and 1000),
 client_newcomer_points integer not null default 50 check(client_newcomer_points between 0 and 1000),
 pro_free_days integer not null default 14 check(pro_free_days between 0 and 90),
 monthly_referrer_cap integer not null default 10 check(monthly_referrer_cap between 1 and 30),
 updated_at timestamptz not null default now()
);
insert into public.bc_referral_config(id)values(1) on conflict do nothing;
create table if not exists public.bc_referral_links(
 id uuid primary key default gen_random_uuid(),
 code text not null unique check(code ~ '^BC[A-F0-9]{12}$'),
 inviter uuid not null references auth.users(id) on delete cascade,
 audience text not null check(audience in('client','pro')),
 salon_id uuid references public.bc_salons(id),
 created_at timestamptz not null default now(),
 unique(inviter,audience,salon_id)
);
create index if not exists bc_ref_link_inviter on public.bc_referral_links(inviter);
create table if not exists public.bc_referral_claims(
 id uuid primary key default gen_random_uuid(),
 link_id uuid not null references public.bc_referral_links(id),
 inviter uuid not null references auth.users(id),
 invited uuid not null unique references auth.users(id),
 status text not null default 'registered' check(status in('registered','qualified','approved','declined')),
 qualified_at timestamptz,
 awarded_at timestamptz,
 created_at timestamptz not null default now(),
 check(inviter<>invited)
);
create index if not exists bc_ref_claim_inviter on public.bc_referral_claims(inviter,created_at desc);
create table if not exists public.bc_referral_rewards(
 id uuid primary key default gen_random_uuid(),
 claim_id uuid not null references public.bc_referral_claims(id),
 beneficiary uuid not null references auth.users(id),
 kind text not null check(kind in ('promo_points','pro_trial_request')),
 amount integer not null check(amount>=0),
 status text not null default 'pending' check(status in('pending','issued','expired')),
 created_at timestamptz not null default now(),
 unique(claim_id,beneficiary,kind)
);
do $$declare tab text;begin
 foreach tab in array array['bc_referral_config','bc_referral_links','bc_referral_claims','bc_referral_rewards'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('revoke all on public.%I from public,anon,authenticated',tab);
 end loop;
end$$;
create or replace function public.bc_referral_link_create(p_audience text,p_salon uuid default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid; l public.bc_referral_links%rowtype;identifier text;
begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 if p_audience not in('client','pro') then raise exception 'INVALID_AUDIENCE';end if;
 if p_audience='pro' and (p_salon is null or not exists(
 select 1 from public.bc_salon_members m join public.bc_salons s on s.id=m.salon_id
 where m.salon_id=p_salon and m.user_id=u and m.role in('owner','manager') and s.archived_at is null))
 then raise exception 'PRO_SALON_REQUIRED';end if;
 if p_audience='client' and p_salon is not null then raise exception 'CLIENT_SALON_NOT_ALLOWED';end if;
 select * into l from public.bc_referral_links where inviter=u and audience=p_audience
 and salon_id is not distinct from p_salon;
 if not found then
  if (select count(*) from public.bc_referral_links where inviter=u)>=15 then raise exception 'LINK_LIMIT';end if;
  identifier:='BC'||upper(left(replace(gen_random_uuid()::text,'-',''),12));
  insert into public.bc_referral_links(code,inviter,audience,salon_id)
  values(identifier,u,p_audience,p_salon) returning * into l;
 end if;
 return jsonb_build_object('code',l.code,'audience',l.audience,'link_id',l.id,'promotion_active',
 (select enabled from public.bc_referral_config where id=1));
end;$$;
revoke all on function public.bc_referral_link_create(text,uuid) from public,anon;
grant execute on function public.bc_referral_link_create(text,uuid) to authenticated;
create or replace function public.bc_referral_claim(p_code text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;l public.bc_referral_links%rowtype;existing uuid;
begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 select * into l from public.bc_referral_links where code=upper(trim(coalesce(p_code,'')));
 if not found then raise exception 'INVALID_CODE';end if;
 if l.inviter=u then raise exception 'SELF_REFERRAL';end if;
 -- Qualification is separate from registration and cannot be self-awarded.
 select id into existing from public.bc_referral_claims where invited=u;
 if existing is not null then raise exception 'INVITATION_ALREADY_USED';end if;
 if (select count(*) from public.bc_referral_claims where inviter=l.inviter
 and created_at>date_trunc('month',now())) >=(select monthly_referrer_cap
 from public.bc_referral_config where id=1) then raise exception 'REFERRAL_MONTHLY_CAP';end if;
 insert into public.bc_referral_claims(link_id,inviter,invited) values(l.id,l.inviter,u);
 return jsonb_build_object('registered',true,'status','awaiting_verified_action','audience',l.audience,
 'promotion_active',(select enabled from public.bc_referral_config where id=1));
end;$$;
revoke all on function public.bc_referral_claim(text) from public,anon;
grant execute on function public.bc_referral_claim(text) to authenticated;
create or replace function public.bc_referral_my_status()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare u uuid;
begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 return jsonb_build_object(
 'enabled',(select enabled from public.bc_referral_config where id=1),
 'terms',jsonb_build_object('client_inviter_points',(select client_referrer_points from public.bc_referral_config where id=1),
 'newcomer_points',(select client_newcomer_points from public.bc_referral_config where id=1),
 'pro_free_days',(select pro_free_days from public.bc_referral_config where id=1)),
 'links',coalesce((select jsonb_agg(jsonb_build_object('code',l.code,'audience',l.audience,'salon_id',l.salon_id))
 from public.bc_referral_links l where inviter=u),'[]'::jsonb),
 'referrals',coalesce((select jsonb_agg(jsonb_build_object('status',c.status,'at',c.created_at,'qualified_at',c.qualified_at)
 order by c.created_at desc)from public.bc_referral_claims c where inviter=u),'[]'::jsonb),
 'my_invitation',(select jsonb_build_object('status',c.status,'at',c.created_at)
 from public.bc_referral_claims c where invited=u),
 'rewards',coalesce((select jsonb_agg(jsonb_build_object('kind',r.kind,'amount',r.amount,'status',r.status)
 order by r.created_at desc)from public.bc_referral_rewards r where beneficiary=u),'[]'::jsonb));
end;$$;
revoke all on function public.bc_referral_my_status() from public,anon;
grant execute on function public.bc_referral_my_status() to authenticated;
-- An independent finished visit qualifies the invited client. No financial benefit is issued automatically.
create or replace function public.bc_referral_visit_qualify()
returns trigger language plpgsql security definer set search_path=''
as $$begin
 update public.bc_referral_claims c set status='qualified',qualified_at=now()
 from public.bc_referral_links l
 where c.link_id=l.id and l.audience='client' and c.invited=new.user_id and c.status='registered';
 return new;
end;$$;
drop trigger if exists bc_referral_qualified_service on public.bc_service_visits;
create trigger bc_referral_qualified_service after insert on public.bc_service_visits
for each row execute function public.bc_referral_visit_qualify();
revoke all on function public.bc_referral_visit_qualify() from public,anon,authenticated;
create or replace function public.bc_admin_referral_config(p_enabled boolean,p_referrer integer,p_invitee integer,p_days integer)
returns boolean language plpgsql security definer set search_path=''
as $$begin
 if not public.bc_is_platform_admin() then raise exception 'ADMIN_ONLY';end if;
 update public.bc_referral_config set enabled=p_enabled,client_referrer_points=p_referrer,
 client_newcomer_points=p_invitee,pro_free_days=p_days,updated_at=now() where id=1;
 return true;
end;$$;
revoke all on function public.bc_admin_referral_config(boolean,integer,integer,integer) from public,anon;
grant execute on function public.bc_admin_referral_config(boolean,integer,integer,integer) to authenticated;
