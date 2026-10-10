-- Favorites: clients may only heart a published salon or a public PRO barber.
-- Names/counts are public; the identities of people who liked remain private.
create table if not exists public.bc_client_favorites(
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('salon','barber')),
 target_id uuid not null,
 created_at timestamptz not null default now(),
 primary key(user_id,kind,target_id)
);
create index if not exists bc_client_favorites_target_idx on public.bc_client_favorites(kind,target_id);
alter table public.bc_client_favorites enable row level security;
revoke all on public.bc_client_favorites from public,anon,authenticated;

create or replace function public.bc_favorite_allowed(p_kind text,p_target uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if p_kind='salon' then
  return exists(select 1 from public.bc_public_salon_catalog s where s.id=p_target and s.visibility='listed');
 elsif p_kind='barber' then
  return exists(select 1 from public.bc_social_profiles p where p.user_id=p_target and p.is_public)
    and public.bc_social_is_barber(p_target);
 end if;
 return false;
end $$;
revoke all on function public.bc_favorite_allowed(text,uuid) from public,anon,authenticated;

create or replace function public.bc_favorite_toggle(p_kind text,p_target uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); added boolean:=false;
begin
 if u is null or not public.bc_portal_access('client') then raise exception 'CLIENT_LOGIN_REQUIRED' using errcode='42501';end if;
 if p_target is null or not public.bc_favorite_allowed(p_kind,p_target) then raise exception 'PROFILE_NOT_AVAILABLE' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||':'||p_kind||':'||p_target::text,0));
 if exists(select 1 from public.bc_client_favorites where user_id=u and kind=p_kind and target_id=p_target) then
  delete from public.bc_client_favorites where user_id=u and kind=p_kind and target_id=p_target;
 else
  insert into public.bc_client_favorites(user_id,kind,target_id) values(u,p_kind,p_target);
  added:=true;
 end if;
 return jsonb_build_object('saved',added,'count',(select count(*) from public.bc_client_favorites where kind=p_kind and target_id=p_target));
end $$;

create or replace function public.bc_favorite_summary(p_kind text,p_targets uuid[])
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=(select auth.uid());
begin
 if p_kind not in ('salon','barber') or array_length(p_targets,1)>100 then raise exception 'INVALID_REQUEST';end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object('id',v.target_id,'count',(
   select count(*) from public.bc_client_favorites f where f.kind=p_kind and f.target_id=v.target_id),
   'saved',exists(select 1 from public.bc_client_favorites f where f.kind=p_kind and f.target_id=v.target_id and f.user_id=u)))
  from (select distinct unnest(p_targets) target_id) v
  where public.bc_favorite_allowed(p_kind,v.target_id)
 ),'[]'::jsonb);
end $$;

create or replace function public.bc_favorites_mine()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=(select auth.uid());
begin
 if u is null or not public.bc_portal_access('client') then raise exception 'CLIENT_LOGIN_REQUIRED' using errcode='42501';end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object('kind',q.kind,'id',q.target_id,'title',
    case when q.kind='salon' then (select s.name from public.bc_public_salon_catalog s where s.id=q.target_id)
      else (select p.display_name from public.bc_social_profiles p where p.user_id=q.target_id) end,
    'subtitle',case when q.kind='salon' then (select s.city from public.bc_public_salon_catalog s where s.id=q.target_id)
      else (select '@'||p.handle from public.bc_social_profiles p where p.user_id=q.target_id) end,
    'count',(select count(*) from public.bc_client_favorites x where x.kind=q.kind and x.target_id=q.target_id))
   order by q.created_at desc)
  from (select * from public.bc_client_favorites where user_id=u order by created_at desc limit 150) q
  where public.bc_favorite_allowed(q.kind,q.target_id)
 ),'[]'::jsonb);
end $$;
revoke all on function public.bc_favorite_toggle(text,uuid) from public,anon;
revoke all on function public.bc_favorite_summary(text,uuid[]) from public,anon;
revoke all on function public.bc_favorites_mine() from public,anon;
grant execute on function public.bc_favorite_toggle(text,uuid) to authenticated;
grant execute on function public.bc_favorite_summary(text,uuid[]) to authenticated,anon;
grant execute on function public.bc_favorites_mine() to authenticated;

-- PRO agenda: only PRO identities attached to the salon can list its clients.
-- The profile link is exposed only when a real authenticated booking linked it.
alter table public.bc_pilot_bookings add column if not exists client_user_id uuid references auth.users(id) on delete set null;
create or replace function public.bc_pilot_booking_link_client()
returns trigger language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid());
begin
 if u is not null and exists(select 1 from public.bc_portal_accounts where user_id=u and portal='client') then
  new.client_user_id:=u;
 else
  new.client_user_id:=null;
 end if;
 return new;
end $$;
drop trigger if exists bc_pilot_booking_link_client_tg on public.bc_pilot_bookings;
create trigger bc_pilot_booking_link_client_tg before insert on public.bc_pilot_bookings
for each row execute function public.bc_pilot_booking_link_client();
revoke all on function public.bc_pilot_booking_link_client() from public,anon,authenticated;

create or replace function public.bc_pro_client_agenda(p_salon uuid,p_search text default '')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=(select auth.uid());needle text:=lower(left(trim(coalesce(p_search,'')),80));
begin
 if u is null or not exists(select 1 from public.bc_salon_members m join public.bc_portal_accounts pa on pa.user_id=m.user_id
     where m.user_id=u and m.salon_id=p_salon and pa.portal='pro')
 then raise exception 'SALON_ACCESS_DENIED' using errcode='42501'; end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object('name',b.client_name,'phone',b.client_phone,'visits',b.visits,
    'last_booking',b.last_booking,'profile_user',p.user_id,'username',p.handle)
    order by b.last_booking desc)
  from (select (array_agg(client_name order by starts_at desc))[1] client_name,client_phone,
      count(*) visits,max(starts_at) last_booking,
      (array_remove(array_agg(client_user_id order by starts_at desc),null))[1] client_user_id
      from public.bc_pilot_bookings
      where salon_id=p_salon and
       (needle='' or lower(client_name) like '%'||needle||'%' or client_phone like '%'||needle||'%')
      group by client_phone order by max(starts_at) desc limit 100) b
  left join public.bc_social_profiles p on p.user_id=b.client_user_id and p.is_public=true
 ),'[]'::jsonb);
end $$;
revoke all on function public.bc_pro_client_agenda(uuid,text) from public,anon;
grant execute on function public.bc_pro_client_agenda(uuid,text) to authenticated;
