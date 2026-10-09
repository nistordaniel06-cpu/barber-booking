-- BARBERCRAFT social gallery: client 3 completed QR+staff visits,
-- 1 client photo per completed check-in within 24h after QR, PRO daily tiers.
-- Private bc_passport_photos remains unchanged.

-- Immutable usage ledger: deleting an image cannot reset the PRO daily quota.
create table if not exists public.bc_pro_portfolio_upload_log (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 posted_on date not null,
 created_at timestamptz not null default now()
);
create index if not exists bc_pro_portfolio_upload_log_day
 on public.bc_pro_portfolio_upload_log(user_id,posted_on);
alter table public.bc_pro_portfolio_upload_log enable row level security;
revoke all on public.bc_pro_portfolio_upload_log from public,anon,authenticated;
-- Count photographs posted before quotas existed, too.
insert into public.bc_pro_portfolio_upload_log(id,user_id,posted_on,created_at)
select f.id,f.user_id,(f.created_at at time zone 'Europe/Bucharest')::date,f.created_at
from public.bc_barber_portfolio f on conflict(id) do nothing;

-- Client gallery is public only by explicit upload; private Passport album is separate.
create table if not exists public.bc_client_social_photo_claims (
 checkin_id uuid primary key references public.bc_passport_checkins(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 claimed_at timestamptz not null default now()
);
create index if not exists bc_client_social_photo_claims_user
 on public.bc_client_social_photo_claims(user_id,claimed_at desc);
alter table public.bc_client_social_photo_claims enable row level security;
revoke all on public.bc_client_social_photo_claims from public,anon,authenticated;
create table if not exists public.bc_client_social_gallery (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 checkin_id uuid not null unique references public.bc_client_social_photo_claims(checkin_id),
 object_path text not null unique,
 caption text not null default '' check(char_length(caption)<=160),
 created_at timestamptz not null default now(),
 constraint bc_client_gallery_owner_folder check (split_part(object_path,'/',1)=user_id::text)
);
create index if not exists bc_client_social_gallery_owner
 on public.bc_client_social_gallery(user_id,created_at desc);
alter table public.bc_client_social_gallery enable row level security;
revoke all on public.bc_client_social_gallery from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bc-client-social-gallery','bc-client-social-gallery',true,5242880,
 array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=5242880,
 allowed_mime_types=array['image/jpeg','image/png','image/webp'];

-- Always derive both role and verified-visit counts from server-side tables.
create or replace function public.bc_social_client_gallery_upload_allowed()
returns boolean language sql stable security definer set search_path=''
as $$
select (select auth.uid()) is not null
 and not public.bc_social_is_barber((select auth.uid()))
 and (select count(*) from public.bc_service_visits v
      where v.user_id=(select auth.uid()))>=3
 and exists (
   select 1 from public.bc_service_visits v
   join public.bc_passport_checkins q on q.id=v.checkin_id
   where v.user_id=(select auth.uid()) and q.user_id=v.user_id
     and q.checked_at<=now() and q.checked_at>now()-interval '24 hours'
     and not exists(select 1 from public.bc_client_social_photo_claims c
       where c.checkin_id=q.id));
$$;
revoke all on function public.bc_social_client_gallery_upload_allowed() from public,anon;
grant execute on function public.bc_social_client_gallery_upload_allowed() to authenticated;

drop policy if exists bc_client_social_gallery_insert on storage.objects;
create policy bc_client_social_gallery_insert on storage.objects
for insert to authenticated
with check (bucket_id='bc-client-social-gallery'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and public.bc_social_client_gallery_upload_allowed());
drop policy if exists bc_client_social_gallery_owner_select on storage.objects;
create policy bc_client_social_gallery_owner_select on storage.objects
for select to authenticated
using(bucket_id='bc-client-social-gallery'
 and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists bc_client_social_gallery_owner_delete on storage.objects;
create policy bc_client_social_gallery_owner_delete on storage.objects
for delete to authenticated
using(bucket_id='bc-client-social-gallery'
 and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Upload limits are based on account age, not on unverified job experience.
-- 0-<1mo:1/day; 1-<5mo:2; 5-<6mo:3; 6-<12mo:4; >=12mo:5.
create or replace function public.bc_social_pro_daily_photo_limit(p_user uuid)
returns integer language sql stable security definer set search_path=''
as $$
select case
 when now()>=a.created_at+interval '1 year' then 5
 when now()>=a.created_at+interval '6 months' then 4
 when now()>=a.created_at+interval '5 months' then 3
 when now()>=a.created_at+interval '1 month' then 2
 else 1 end
from auth.users a where a.id=p_user
$$;
revoke all on function public.bc_social_pro_daily_photo_limit(uuid) from public,anon,authenticated;

-- Replace old PRO upload: remove total 70-photo cap and enforce daily
-- quota atomically. Deleted pictures stay in the immutable usage ledger.
create or replace function public.bc_social_barber_portfolio_add(p_path text,p_caption text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare u uuid; result uuid; current_day date; allowed_count integer;
begin
 u:=(select auth.uid());
 if u is null or not public.bc_social_is_barber(u) then raise exception 'BARBER_ONLY';end if;
 if p_path is null or split_part(p_path,'/',1)<>u::text
   or p_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\\.(jpg|png|webp)$'
   or char_length(coalesce(p_caption,''))>160
   or not exists(select 1 from storage.objects where bucket_id='bc-barber-portfolio' and name=p_path)
 then raise exception 'INVALID_IMAGE';end if;
 perform pg_advisory_xact_lock(hashtextextended('bc-pro-gallery:'||u::text,0));
 current_day:=(now() at time zone 'Europe/Bucharest')::date;
 allowed_count:=public.bc_social_pro_daily_photo_limit(u);
 if (select count(*) from public.bc_pro_portfolio_upload_log
     where user_id=u and posted_on=current_day)>=allowed_count
 then raise exception 'DAILY_PORTFOLIO_LIMIT';end if;
 insert into public.bc_barber_portfolio(user_id,object_path,caption)
 values(u,p_path,coalesce(p_caption,'')) returning id into result;
 insert into public.bc_pro_portfolio_upload_log(user_id,posted_on)
 values(u,current_day);
 return result;
end;$$;
revoke all on function public.bc_social_barber_portfolio_add(text,text) from public,anon;
grant execute on function public.bc_social_barber_portfolio_add(text,text) to authenticated;

-- Status displayed in the user interface, with no client-pro crossover.
create or replace function public.bc_social_gallery_status()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare u uuid; is_pro boolean; total integer; daily_limit integer; used integer;
begin
 u:=(select auth.uid());
 if u is null then raise exception 'LOGIN_REQUIRED';end if;
 is_pro:=public.bc_social_is_barber(u);
 if is_pro then
   daily_limit:=public.bc_social_pro_daily_photo_limit(u);
   select count(*) into used from public.bc_pro_portfolio_upload_log
    where user_id=u and posted_on=(now() at time zone 'Europe/Bucharest')::date;
   return jsonb_build_object('kind','barber','daily_limit',daily_limit,
      'used_today',used,'remaining',greatest(0,daily_limit-used));
 end if;
 select count(*) into total from public.bc_service_visits where user_id=u;
 return jsonb_build_object(
 'kind','client','completed_visits',total,'needed',greatest(0,3-total),
 'visits',case when total<3 then '[]'::jsonb else
 coalesce((select jsonb_agg(jsonb_build_object(
  'checkin_id',x.id,'checked_at',x.checked_at,
  'expires_at',x.checked_at+interval '24 hours') order by x.checked_at desc)
  from (select q.id,q.checked_at from public.bc_passport_checkins q
    join public.bc_service_visits v on v.checkin_id=q.id and v.user_id=q.user_id
    where q.user_id=u and q.checked_at<=now()
      and q.checked_at>now()-interval '24 hours'
      and not exists(select 1 from public.bc_client_social_photo_claims c
        where c.checkin_id=q.id)
    order by q.checked_at desc limit 15)x),'[]'::jsonb) end);
end;$$;
revoke all on function public.bc_social_gallery_status() from public,anon;
grant execute on function public.bc_social_gallery_status() to authenticated;

create or replace function public.bc_social_client_gallery_add(
 p_path text,p_caption text,p_checkin uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare u uuid; result uuid; qr_time timestamptz; media_uploaded timestamptz;
begin
 u:=(select auth.uid());
 if u is null then raise exception 'LOGIN_REQUIRED';end if;
 if public.bc_social_is_barber(u) then raise exception 'CLIENT_ONLY';end if;
 perform pg_advisory_xact_lock(hashtextextended('bc-client-gallery:'||u::text,0));
 if (select count(*) from public.bc_service_visits where user_id=u)<3
 then raise exception 'THREE_VERIFIED_VISITS_REQUIRED';end if;
 select q.checked_at into qr_time
 from public.bc_passport_checkins q
 join public.bc_service_visits v on v.checkin_id=q.id and v.user_id=q.user_id
 where q.id=p_checkin and q.user_id=u;
 if qr_time is null or qr_time>now() or qr_time<=now()-interval '24 hours'
 then raise exception 'QR_24H_WINDOW_EXPIRED';end if;
 if exists(select 1 from public.bc_client_social_photo_claims where checkin_id=p_checkin)
 then raise exception 'PHOTO_ALREADY_POSTED_FOR_VISIT';end if;
 if p_path is null or split_part(p_path,'/',1)<>u::text
   or p_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\\.(jpg|png|webp)$'
   or char_length(coalesce(p_caption,''))>160
 then raise exception 'INVALID_IMAGE';end if;
 select created_at into media_uploaded from storage.objects
 where bucket_id='bc-client-social-gallery' and name=p_path;
 if media_uploaded is null or media_uploaded<qr_time
 then raise exception 'INVALID_IMAGE';end if;
 insert into public.bc_client_social_photo_claims(checkin_id,user_id)
 values(p_checkin,u);
 insert into public.bc_client_social_gallery(user_id,checkin_id,object_path,caption)
 values(u,p_checkin,p_path,coalesce(p_caption,'')) returning id into result;
 return result;
end;$$;
revoke all on function public.bc_social_client_gallery_add(text,text,uuid) from public,anon;
grant execute on function public.bc_social_client_gallery_add(text,text,uuid) to authenticated;

create or replace function public.bc_social_client_gallery_delete(p_id uuid)
returns text language plpgsql security definer set search_path=''
as $$
declare u uuid; removed_path text;
begin
 u:=(select auth.uid());
 if u is null then raise exception 'LOGIN_REQUIRED';end if;
 delete from public.bc_client_social_gallery
 where id=p_id and user_id=u returning object_path into removed_path;
 -- The check-in claim remains, so removal never grants another upload.
 return removed_path;
end;$$;
revoke all on function public.bc_social_client_gallery_delete(uuid) from public,anon;
grant execute on function public.bc_social_client_gallery_delete(uuid) to authenticated;

create or replace function public.bc_social_client_gallery_list(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare u uuid; p record; has_profile boolean;
begin
 u:=(select auth.uid());
 select * into p from public.bc_social_profiles where user_id=p_user;
 has_profile:=found;
 if u is distinct from p_user then
   if not has_profile or not coalesce(p.is_public,false)
     or exists(select 1 from public.bc_social_blocks
       where (blocker=u and blocked=p_user)
          or (blocker=p_user and blocked=u))
   then return '[]'::jsonb;end if;
 end if;
 return coalesce((
 select jsonb_agg(jsonb_build_object('id',g.id,'path',g.object_path,
 'caption',g.caption,'created_at',g.created_at) order by g.created_at desc)
 from (select id,object_path,caption,created_at
       from public.bc_client_social_gallery where user_id=p_user
       order by created_at desc limit 100) g),'[]'::jsonb);
end;$$;
revoke all on function public.bc_social_client_gallery_list(uuid) from public;
grant execute on function public.bc_social_client_gallery_list(uuid) to anon,authenticated;
