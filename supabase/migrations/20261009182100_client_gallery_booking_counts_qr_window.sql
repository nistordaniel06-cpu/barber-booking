-- Align client eligibility with the existing trusted Passport haircut counter.
-- Third haircut can be verified by app booking or QR+staff completion;
-- the 24-hour photo window starts after a new staff-verified QR scan,
-- without requiring another service completion just for photo posting.
create or replace function public.bc_social_client_verified_haircut_count(p_user uuid)
returns integer language sql stable security definer set search_path=''
as $$
select count(*)::integer from (
 select salon_id, (visit_at at time zone 'Europe/Bucharest')::date visit_day
 from (
   select salon_id,occurred_at as visit_at
   from public.bc_tw_activity where user_id=p_user
   union all
   select salon_id,verified_at as visit_at
   from public.bc_service_visits where user_id=p_user
 ) counts
 group by salon_id,(visit_at at time zone 'Europe/Bucharest')::date
) unique_haircuts
$$;
revoke all on function public.bc_social_client_verified_haircut_count(uuid)
 from public,anon,authenticated;

create or replace function public.bc_social_client_gallery_upload_allowed()
returns boolean language sql stable security definer set search_path=''
as $$
select (select auth.uid()) is not null
 and not public.bc_social_is_barber((select auth.uid()))
 and public.bc_social_client_verified_haircut_count((select auth.uid()))>=3
 and exists (
   select 1 from public.bc_passport_checkins q
   where q.user_id=(select auth.uid())
     and q.checked_at<=now() and q.checked_at>now()-interval '24 hours'
     and not exists(select 1 from public.bc_client_social_photo_claims c
       where c.checkin_id=q.id)
 );
$$;
revoke all on function public.bc_social_client_gallery_upload_allowed() from public,anon;
grant execute on function public.bc_social_client_gallery_upload_allowed() to authenticated;

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
 total:=public.bc_social_client_verified_haircut_count(u);
 return jsonb_build_object(
 'kind','client','completed_visits',total,'needed',greatest(0,3-total),
 'visits',case when total<3 then '[]'::jsonb else
 coalesce((select jsonb_agg(jsonb_build_object(
  'checkin_id',x.id,'checked_at',x.checked_at,
  'expires_at',x.checked_at+interval '24 hours') order by x.checked_at desc)
  from (select q.id,q.checked_at from public.bc_passport_checkins q
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
 if public.bc_social_client_verified_haircut_count(u)<3
 then raise exception 'THREE_VERIFIED_VISITS_REQUIRED';end if;
 select q.checked_at into qr_time from public.bc_passport_checkins q
 where q.id=p_checkin and q.user_id=u;
 if qr_time is null or qr_time>now() or qr_time<=now()-interval '24 hours'
 then raise exception 'QR_24H_WINDOW_EXPIRED';end if;
 if exists(select 1 from public.bc_client_social_photo_claims where checkin_id=p_checkin)
 then raise exception 'PHOTO_ALREADY_POSTED_FOR_VISIT';end if;
 if p_path is null or split_part(p_path,'/',1)<>u::text
   or p_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$'
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
