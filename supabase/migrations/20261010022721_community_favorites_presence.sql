-- Favorites, app presence, public visit ranks, salon tags and professional address book.
-- Privileged implementations remain in an unexposed schema. Public RPCs are invokers.
create schema if not exists bc_private;
revoke all on schema bc_private from public,anon,authenticated;
grant usage on schema bc_private to anon,authenticated,service_role;
create table public.bc_profile_favorites (
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('salon','barber')),
 target_id uuid not null,
 created_at timestamptz not null default now(),
 primary key(user_id,kind,target_id)
);
create index bc_favorites_target on public.bc_profile_favorites(kind,target_id);
alter table public.bc_profile_favorites enable row level security;
revoke all on public.bc_profile_favorites from public,anon,authenticated;
create table public.bc_app_presence (
 user_id uuid primary key references auth.users(id) on delete cascade,
 active_at timestamptz not null default now()
);
alter table public.bc_app_presence enable row level security;
revoke all on public.bc_app_presence from public,anon,authenticated;
alter table public.bc_pilot_bookings add column if not exists client_user_id uuid references auth.users(id) on delete set null;
create index if not exists bc_pilot_bookings_client_user on public.bc_pilot_bookings(client_user_id,salon_id,starts_at desc);
create table public.bc_booking_whatsapp_outbox (
 booking_id uuid primary key references public.bc_pilot_bookings(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 consent_at timestamptz not null default now(),
 status text not null default 'queued' check(status in ('queued','sending','sent','failed','unknown')),
 meta_message_id text,
 updated_at timestamptz not null default now()
);
create index bc_whatsapp_outbox_queue on public.bc_booking_whatsapp_outbox(consent_at) where status='queued';
alter table public.bc_booking_whatsapp_outbox enable row level security;
revoke all on public.bc_booking_whatsapp_outbox from public,anon,authenticated;
grant select,update on public.bc_booking_whatsapp_outbox to service_role;

create function bc_private.bc_favorite_state(p_kind text,p_target uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $fn$
declare valid boolean;begin
 if p_kind='salon' then valid:=exists(select 1 from public.bc_public_salon_catalog where id=p_target and visibility='listed');
 elsif p_kind='barber' then valid:=public.bc_social_profile_read(p_target) is not null and exists(select 1 from public.bc_salon_members where user_id=p_target);
 else raise exception 'INVALID_FAVORITE_KIND';end if;
 if not valid then raise exception 'PROFILE_NOT_AVAILABLE';end if;
 return jsonb_build_object('count',(select count(*) from public.bc_profile_favorites where kind=p_kind and target_id=p_target),
 'saved',exists(select 1 from public.bc_profile_favorites where user_id=(select auth.uid()) and kind=p_kind and target_id=p_target));
end;
$fn$;
revoke all on function bc_private.bc_favorite_state(text,uuid) from public,anon,authenticated;
grant execute on function bc_private.bc_favorite_state(text,uuid) to anon,authenticated;
create function public.bc_favorite_state(p_kind text,p_target uuid) returns jsonb
language sql stable security invoker set search_path='' as $fn$
select bc_private.bc_favorite_state(p_kind,p_target)
$fn$;
revoke all on function public.bc_favorite_state(text,uuid) from public,anon,authenticated;
grant execute on function public.bc_favorite_state(text,uuid) to anon,authenticated;

create function bc_private.bc_favorite_set(p_kind text,p_target uuid,p_saved boolean) returns jsonb
language plpgsql volatile security definer set search_path='' as $fn$
declare u uuid:=(select auth.uid());begin
 if u is null then raise exception 'LOGIN_REQUIRED';end if;
 if p_saved then
 perform bc_private.bc_favorite_state(p_kind,p_target);
 insert into public.bc_profile_favorites(user_id,kind,target_id) values(u,p_kind,p_target) on conflict do nothing;
 else delete from public.bc_profile_favorites where user_id=u and kind=p_kind and target_id=p_target;end if;
 return bc_private.bc_favorite_state(p_kind,p_target);
end;
$fn$;
revoke all on function bc_private.bc_favorite_set(text,uuid,boolean) from public,anon,authenticated;
grant execute on function bc_private.bc_favorite_set(text,uuid,boolean) to authenticated;
create function public.bc_favorite_set(p_kind text,p_target uuid,p_saved boolean) returns jsonb
language sql volatile security invoker set search_path='' as $fn$
select bc_private.bc_favorite_set(p_kind,p_target,p_saved)
$fn$;
revoke all on function public.bc_favorite_set(text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.bc_favorite_set(text,uuid,boolean) to authenticated;

create function bc_private.bc_favorites_list(p_kind text) returns jsonb
language plpgsql stable security definer set search_path='' as $fn$
declare u uuid:=(select auth.uid());begin
 if u is null then raise exception 'LOGIN_REQUIRED';end if;
 if p_kind not in ('salon','barber') then raise exception 'INVALID_FAVORITE_KIND';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('kind',f.kind,'id',f.target_id,'name',case when f.kind='salon' then c.name else p.display_name end) order by f.created_at desc)
 from public.bc_profile_favorites f left join public.bc_public_salon_catalog c on f.kind='salon' and c.id=f.target_id
 left join public.bc_social_profiles p on f.kind='barber' and p.user_id=f.target_id
 where f.user_id=u and f.kind=p_kind and ((f.kind='salon' and c.visibility='listed') or
 (f.kind='barber' and public.bc_social_profile_read(f.target_id) is not null and exists(select 1 from public.bc_salon_members where user_id=f.target_id)))),'[]'::jsonb);
end;
$fn$;
revoke all on function bc_private.bc_favorites_list(text) from public,anon,authenticated;
grant execute on function bc_private.bc_favorites_list(text) to authenticated;
create function public.bc_favorites_list(p_kind text) returns jsonb
language sql stable security invoker set search_path='' as $fn$
select bc_private.bc_favorites_list(p_kind)
$fn$;
revoke all on function public.bc_favorites_list(text) from public,anon,authenticated;
grant execute on function public.bc_favorites_list(text) to authenticated;

create function bc_private.bc_presence_ping(p_active boolean) returns boolean
language plpgsql volatile security definer set search_path='' as $fn$
declare u uuid:=(select auth.uid());begin
 if u is null then raise exception 'LOGIN_REQUIRED';end if;
 -- Hidden tabs do not mark a member offline while another tab is active. Presence expires naturally.
 if p_active then insert into public.bc_app_presence(user_id,active_at) values(u,now()) on conflict(user_id) do update set active_at=excluded.active_at;end if;
 return true;
end;
$fn$;
revoke all on function bc_private.bc_presence_ping(boolean) from public,anon,authenticated;
grant execute on function bc_private.bc_presence_ping(boolean) to authenticated;
create function public.bc_presence_ping(p_active boolean) returns boolean
language sql volatile security invoker set search_path='' as $fn$
select bc_private.bc_presence_ping(p_active)
$fn$;
revoke all on function public.bc_presence_ping(boolean) from public,anon,authenticated;
grant execute on function public.bc_presence_ping(boolean) to authenticated;

create function bc_private.bc_presence_read(p_users uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $fn$
begin
 if coalesce(cardinality(p_users),0)>100 then raise exception 'TOO_MANY_USERS';end if;
 return coalesce((select jsonb_agg(x.user_id) from public.bc_app_presence x
 where x.user_id=any(p_users) and x.active_at>now()-interval '75 seconds'
 and public.bc_social_profile_read(x.user_id) is not null),'[]'::jsonb);
end;
$fn$;
revoke all on function bc_private.bc_presence_read(uuid[]) from public,anon,authenticated;
grant execute on function bc_private.bc_presence_read(uuid[]) to anon,authenticated;
create function public.bc_presence_read(p_users uuid[]) returns jsonb
language sql stable security invoker set search_path='' as $fn$
select bc_private.bc_presence_read(p_users)
$fn$;
revoke all on function public.bc_presence_read(uuid[]) from public,anon,authenticated;
grant execute on function public.bc_presence_read(uuid[]) to anon,authenticated;

create function bc_private.bc_friends_list() returns jsonb
language plpgsql stable security definer set search_path='' as $fn$
declare u uuid:=(select auth.uid());begin
 if u is null then raise exception 'LOGIN_REQUIRED';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',p.user_id,'display_name',p.display_name,'handle',p.handle,
 'outgoing',exists(select 1 from public.bc_social_follows where follower=u and followed=p.user_id),
 'mutual',exists(select 1 from public.bc_social_follows where follower=u and followed=p.user_id) and exists(select 1 from public.bc_social_follows where follower=p.user_id and followed=u),
 'message_allowed',public.bc_social_can_message(u,p.user_id)) order by p.display_name)
 from public.bc_social_profiles p where public.bc_social_profile_read(p.user_id) is not null and p.user_id<>u
 and exists(select 1 from public.bc_social_follows where (follower=u and followed=p.user_id) or (follower=p.user_id and followed=u))),'[]'::jsonb);
end;
$fn$;
revoke all on function bc_private.bc_friends_list() from public,anon,authenticated;
grant execute on function bc_private.bc_friends_list() to authenticated;
create function public.bc_friends_list() returns jsonb
language sql stable security invoker set search_path='' as $fn$
select bc_private.bc_friends_list()
$fn$;
revoke all on function public.bc_friends_list() from public,anon,authenticated;
grant execute on function public.bc_friends_list() to authenticated;

create function bc_private.bc_profile_visit_rank(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $fn$
begin
 if p_user is distinct from (select auth.uid()) and public.bc_social_profile_read(p_user) is null then return null;end if;
 return jsonb_build_object('visits',(select count(*) from public.bc_service_visits where user_id=p_user));
end;
$fn$;
revoke all on function bc_private.bc_profile_visit_rank(uuid) from public,anon,authenticated;
grant execute on function bc_private.bc_profile_visit_rank(uuid) to anon,authenticated;
create function public.bc_profile_visit_rank(p_user uuid) returns jsonb
language sql stable security invoker set search_path='' as $fn$
select bc_private.bc_profile_visit_rank(p_user)
$fn$;
revoke all on function public.bc_profile_visit_rank(uuid) from public,anon,authenticated;
grant execute on function public.bc_profile_visit_rank(uuid) to anon,authenticated;

create function bc_private.bc_salon_mentions() returns jsonb
language sql stable security definer set search_path='' as $fn$
select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'handle',
 left(trim(both '_' from regexp_replace(lower(translate(name,'ăâîșțĂÂÎȘȚ','aaistAAIST')),'[^a-z0-9]+','_','g')),20)||'_'||replace(id::text,'-','')) order by name),'[]'::jsonb)
 from public.bc_public_salon_catalog where visibility='listed'

$fn$;
revoke all on function bc_private.bc_salon_mentions() from public,anon,authenticated;
grant execute on function bc_private.bc_salon_mentions() to anon,authenticated;
create function public.bc_salon_mentions() returns jsonb
language sql stable security invoker set search_path='' as $fn$
select bc_private.bc_salon_mentions()
$fn$;
revoke all on function public.bc_salon_mentions() from public,anon,authenticated;
grant execute on function public.bc_salon_mentions() to anon,authenticated;

create function bc_private.bc_pro_client_directory(p_salon uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $fn$
declare u uuid:=(select auth.uid());manager boolean;begin
 if u is null or not exists(select 1 from public.bc_salon_members where salon_id=p_salon and user_id=u) then raise exception 'NOT_SALON_STAFF';end if;
 manager:=exists(select 1 from public.bc_salon_members where salon_id=p_salon and user_id=u and role in ('owner','manager'));
 return coalesce((select jsonb_agg(jsonb_build_object('name',x.name,'phone',x.phone,'user_id',x.uid,'handle',x.handle) order by x.name)
 from (
 select distinct on(coalesce(b.client_user_id::text,b.client_phone)) b.client_name name,b.client_phone phone,
 b.client_user_id uid,p.handle from public.bc_pilot_bookings b join public.bc_pro_calendar_events e on e.id=b.calendar_event_id
 left join public.bc_social_profiles p on p.user_id=b.client_user_id and public.bc_social_profile_read(p.user_id) is not null
 where b.salon_id=p_salon and (manager or e.specialist_user_id=u)
 order by coalesce(b.client_user_id::text,b.client_phone),b.starts_at desc limit 500
 ) x),'[]'::jsonb)||case when manager then coalesce((select jsonb_agg(jsonb_build_object('name',display_name,'phone',phone,'user_id',null,'handle',null))
 from public.bc_pro_clients where salon_id=p_salon),'[]'::jsonb) else '[]'::jsonb end;
end;
$fn$;
revoke all on function bc_private.bc_pro_client_directory(uuid) from public,anon,authenticated;
grant execute on function bc_private.bc_pro_client_directory(uuid) to authenticated;
create function public.bc_pro_client_directory(p_salon uuid) returns jsonb
language sql stable security invoker set search_path='' as $fn$
select bc_private.bc_pro_client_directory(p_salon)
$fn$;
revoke all on function public.bc_pro_client_directory(uuid) from public,anon,authenticated;
grant execute on function public.bc_pro_client_directory(uuid) to authenticated;

create function bc_private.bc_booking_whatsapp_optin(p_booking uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $fn$
declare u uuid:=(select auth.uid());b public.bc_pilot_bookings%rowtype;begin
 if u is null then raise exception 'LOGIN_REQUIRED';end if;
 select * into b from public.bc_pilot_bookings where id=p_booking and client_user_id=u;
 if not found then raise exception 'BOOKING_NOT_FOUND';end if;
 if not exists(select 1 from public.bc_pro_calendar_events where id=b.calendar_event_id and status='confirmed') then raise exception 'BOOKING_NOT_CONFIRMED';end if;
 if not exists(select 1 from public.bc_whatsapp_channels where salon_id=b.salon_id and enabled) then return jsonb_build_object('queued',false,'reason','CHANNEL_NOT_CONFIGURED');end if;
 insert into public.bc_booking_whatsapp_outbox(booking_id,user_id) values(b.id,u) on conflict do nothing;
 return jsonb_build_object('queued',true,'status',(select status from public.bc_booking_whatsapp_outbox where booking_id=b.id));
end;
$fn$;
revoke all on function bc_private.bc_booking_whatsapp_optin(uuid) from public,anon,authenticated;
grant execute on function bc_private.bc_booking_whatsapp_optin(uuid) to authenticated;
create function public.bc_booking_whatsapp_optin(p_booking uuid) returns jsonb
language sql volatile security invoker set search_path='' as $fn$
select bc_private.bc_booking_whatsapp_optin(p_booking)
$fn$;
revoke all on function public.bc_booking_whatsapp_optin(uuid) from public,anon,authenticated;
grant execute on function public.bc_booking_whatsapp_optin(uuid) to authenticated;

create function bc_private.bc_whatsapp_claim() returns jsonb
language plpgsql volatile security definer set search_path='' as $fn$
declare result jsonb;begin
 with picked as (select o.booking_id from public.bc_booking_whatsapp_outbox o join public.bc_pilot_bookings b on b.id=o.booking_id
 join public.bc_pro_calendar_events e on e.id=b.calendar_event_id and e.status='confirmed'
 where o.status='queued' order by o.consent_at for update of o skip locked limit 10),
 claimed as (update public.bc_booking_whatsapp_outbox o set status='sending',updated_at=now() from picked p where o.booking_id=p.booking_id returning o.booking_id)
 select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'phone',b.client_phone,'salon',s.name,'location',coalesce(c.address,s.city,''),
 'start',b.starts_at,'service',b.service_label,'channel',w.meta_phone_number_id)),'[]'::jsonb) into result
 from claimed o join public.bc_pilot_bookings b on b.id=o.booking_id join public.bc_salons s on s.id=b.salon_id
 left join lateral(select address from public.bc_public_salon_catalog where salon_id=b.salon_id and visibility='listed' limit 1)c on true
 join lateral(select meta_phone_number_id from public.bc_whatsapp_channels where salon_id=b.salon_id and enabled order by created_at limit 1)w on true;
 return result;
end;
$fn$;
revoke all on function bc_private.bc_whatsapp_claim() from public,anon,authenticated;
grant execute on function bc_private.bc_whatsapp_claim() to service_role;
create function public.bc_whatsapp_claim() returns jsonb
language sql volatile security invoker set search_path='' as $fn$
select bc_private.bc_whatsapp_claim()
$fn$;
revoke all on function public.bc_whatsapp_claim() from public,anon,authenticated;
grant execute on function public.bc_whatsapp_claim() to service_role;

create function bc_private.bc_booking_identity() returns trigger language plpgsql security definer set search_path='' as $fn$
begin
 if new.client_user_id is null and public.bc_client_my_approval()->>'status'='approved' then new.client_user_id:=(select auth.uid());end if;
 return new;
end;$fn$;
revoke all on function bc_private.bc_booking_identity() from public,anon,authenticated;
create trigger bc_booking_identity before insert on public.bc_pilot_bookings for each row execute function bc_private.bc_booking_identity();
