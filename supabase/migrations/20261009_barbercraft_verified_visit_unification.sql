-- Unify QR+staff finished visits and existing trusted territory visits in Passport.
-- Prevent double-counting the same salon/day; do NOT mint XP for QR completion.
create or replace function public.bc_passport_verified_visits()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare u uuid;answer jsonb;
begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 with unioned as (
 select salon_id,occurred_at at,awarded_xp xp,loyalty_points pts,1 priority,
 'trusted_booking'::text source from public.bc_tw_activity where user_id=u
 union all
 select salon_id,verified_at at,0 xp,0 pts,2 priority,
 'qr_staff'::text source from public.bc_service_visits where user_id=u
 ),
 unique_dates as (
 select distinct on(salon_id,(at at time zone 'Europe/Bucharest')::date)
 salon_id,at,xp,pts,source
 from unioned order by salon_id,(at at time zone 'Europe/Bucharest')::date,priority,at desc
 ),
 ordered as (select * from unique_dates order by at desc limit 30)
 select jsonb_build_object(
 'total_visits',(select count(*) from unique_dates),
 'recent',coalesce((select jsonb_agg(jsonb_build_object('date',v.at,'salon_id',v.salon_id,
 'xp',v.xp,'points',v.pts,'source',v.source) order by v.at desc) from ordered v),'[]'::jsonb)
 ) into answer;
 return answer;
end;$$;
revoke all on function public.bc_passport_verified_visits() from public,anon;
grant execute on function public.bc_passport_verified_visits() to authenticated;

create or replace function public.bc_salon_idea_submit(p_salon uuid,p_title text,p_detail text)
returns uuid language plpgsql security definer set search_path=''
as $$declare u uuid;visits integer;result uuid;
begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 select count(distinct visit_day) into visits from (
  select (verified_at at time zone 'Europe/Bucharest')::date AS visit_day
  from public.bc_service_visits where user_id=u and salon_id=p_salon
  union all
  select (occurred_at at time zone 'Europe/Bucharest')::date
  from public.bc_tw_activity where user_id=u and salon_id=p_salon
 )all_days;
 if visits<5 then raise exception 'FIVE_VERIFIED_VISITS_REQUIRED';end if;
 if length(trim(coalesce(p_title,''))) not between 10 and 110
 or length(trim(coalesce(p_detail,''))) not between 15 and 600 then raise exception 'INVALID_IDEA';end if;
 if (select count(*) from public.bc_salon_ideas where user_id=u and salon_id=p_salon
 and created_at>now()-interval '30 days')>=3 then raise exception 'MONTHLY_IDEA_LIMIT';end if;
 insert into public.bc_salon_ideas(salon_id,user_id,title,detail)
 values(p_salon,u,trim(p_title),trim(p_detail)) returning id into result;
 return result;
end;$$;
revoke all on function public.bc_salon_idea_submit(uuid,text,text) from public,anon;
grant execute on function public.bc_salon_idea_submit(uuid,text,text) to authenticated;

create or replace function public.bc_my_idea_eligibility()
returns jsonb language plpgsql stable security definer set search_path=''
as $$declare u uuid;begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('salon_id',x.salon_id,'salon',s.name,
 'visits',x.days,'eligible',x.days>=5) order by x.days desc)
 from (
  select salon_id,count(distinct visit_day) AS days from (
   select salon_id,(verified_at at time zone 'Europe/Bucharest')::date AS visit_day
   from public.bc_service_visits where user_id=u
   union all
   select salon_id,(occurred_at at time zone 'Europe/Bucharest')::date AS visit_day
   from public.bc_tw_activity where user_id=u
  )all_days group by salon_id
 )x join public.bc_salons s on s.id=x.salon_id),'[]'::jsonb);
end;$$;
revoke all on function public.bc_my_idea_eligibility() from public,anon;
grant execute on function public.bc_my_idea_eligibility() to authenticated;
