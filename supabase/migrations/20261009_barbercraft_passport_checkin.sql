-- BARBERCRAFT: explicit client-consent QR check-in, not proof of completed service.
create table if not exists public.bc_passport_identity_codes(
 user_id uuid primary key references auth.users(id) on delete cascade,
 code_id uuid not null default gen_random_uuid() unique,
 code_hash text not null,
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 consumed_at timestamptz
);
create table if not exists public.bc_passport_checkins(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 salon_id uuid not null references public.bc_salons(id),
 staff_user_id uuid not null references auth.users(id),
 checked_at timestamptz not null default now()
);
create index if not exists bc_passport_checkins_owner on public.bc_passport_checkins(user_id,checked_at desc);
create index if not exists bc_passport_checkins_salon on public.bc_passport_checkins(salon_id,checked_at desc);
alter table public.bc_passport_identity_codes enable row level security;
alter table public.bc_passport_checkins enable row level security;
revoke all on public.bc_passport_identity_codes,public.bc_passport_checkins from public,anon,authenticated;
-- All access through checked RPCs; no browser INSERT/UPDATE on these records.
create or replace function public.bc_passport_qr_issue()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;c_id uuid;secret text;payload text;expiry timestamptz;
begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended('bc-passport:'||u::text,0));
 if exists(select 1 from public.bc_passport_identity_codes where user_id=u and created_at>now()-interval '5 seconds')
 then raise exception 'TRY_AGAIN_SHORTLY';end if;
 c_id:=gen_random_uuid();secret:=gen_random_uuid()::text||'.'||gen_random_uuid()::text;
 payload:='BCP1|'||c_id::text||'|'||secret;expiry:=now()+interval '5 minutes';
 insert into public.bc_passport_identity_codes(user_id,code_id,code_hash,expires_at,created_at,consumed_at)
 values(u,c_id,encode(extensions.digest(convert_to(payload,'UTF8'),'sha256'),'hex'),expiry,now(),null)
 on conflict(user_id) do update set code_id=excluded.code_id,code_hash=excluded.code_hash,
 expires_at=excluded.expires_at,created_at=excluded.created_at,consumed_at=null;
 return jsonb_build_object('payload',payload,'valid_until',expiry);
end;$$;
revoke all on function public.bc_passport_qr_issue() from public,anon;
grant execute on function public.bc_passport_qr_issue() to authenticated;
create or replace function public.bc_passport_qr_checkin(p_salon uuid,p_payload text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid;rec record;client text;already boolean;
begin
 actor:=(select auth.uid());if actor is null then raise exception 'LOGIN_REQUIRED';end if;
 if not exists(select 1 from public.bc_salon_members where salon_id=p_salon and user_id=actor)
 then raise exception 'NOT_SALON_STAFF';end if;
 if length(coalesce(p_payload,''))>200 or split_part(p_payload,'|',1)<>'BCP1'
 or split_part(p_payload,'|',3)='' or split_part(p_payload,'|',4)<>''
 then raise exception 'INVALID_PASSPORT_QR';end if;
 begin
  select c.* into rec from public.bc_passport_identity_codes c
  where c.code_id=split_part(p_payload,'|',2)::uuid for update;
 exception when invalid_text_representation then raise exception 'INVALID_PASSPORT_QR';end;
 if not found or rec.consumed_at is not null or rec.expires_at<=now()
 or rec.code_hash<>encode(extensions.digest(convert_to(p_payload,'UTF8'),'sha256'),'hex')
 then raise exception 'EXPIRED_OR_USED_PASSPORT_QR';end if;
 update public.bc_passport_identity_codes set consumed_at=now() where user_id=rec.user_id;
 select coalesce(nullif(trim(p.display_name),''),'Client BARBERCRAFT') into client
 from public.bc_profiles p where p.user_id=rec.user_id;
 if client is null then client:='Client BARBERCRAFT';end if;
 select exists(select 1 from public.bc_passport_checkins
 where salon_id=p_salon and user_id=rec.user_id and checked_at>now()-interval '1 hour') into already;
 if not already then
   insert into public.bc_passport_checkins(user_id,salon_id,staff_user_id)
   values(rec.user_id,p_salon,actor);
 end if;
 return jsonb_build_object('success',true,'display_name',client,'new_checkin',not already,
 'message','Identitate confirmată; serviciul nu este considerat finalizat și nu acordă automat puncte');
end;$$;
revoke all on function public.bc_passport_qr_checkin(uuid,text) from public,anon;
grant execute on function public.bc_passport_qr_checkin(uuid,text) to authenticated;
create or replace function public.bc_passport_my_checkins()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare u uuid;
begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('salon',s.name,'at',q.checked_at) order by q.checked_at desc)
 from (select salon_id,checked_at from public.bc_passport_checkins where user_id=u order by checked_at desc limit 20)q
 join public.bc_salons s on s.id=q.salon_id),'[]'::jsonb);
end;$$;
revoke all on function public.bc_passport_my_checkins() from public,anon;
grant execute on function public.bc_passport_my_checkins() to authenticated;
