-- Dedicated read-only admin landing data. Counts are computed from actual database
-- rows, not demo totals. No client-side access to auth.users is required.
create or replace function public.bc_admin_command_center()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare response jsonb;
begin
 if not public.bc_is_platform_admin() then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 with canonical as (
   select distinct on (c.salon_id) c.salon_id,
     coalesce(nullif(trim(c.city),''),'Necunoscut') city,
     coalesce(nullif(trim(c.sector),''),'') sector
   from public.bc_public_salon_catalog c
   where c.salon_id is not null and c.visibility='listed'
   order by c.salon_id,c.created_at desc
 ), counted as (
   select ca.city,ca.sector,
    count(e.id) filter(where e.status='confirmed')::int as bookings,
    count(distinct ca.salon_id)::int as salons
   from canonical ca
   left join public.bc_pro_calendar_events e on e.salon_id=ca.salon_id
   group by ca.city,ca.sector
 ), regions as (
   select jsonb_agg(jsonb_build_object('city',city,'sector',sector,'bookings',bookings,'salons',salons)
     order by bookings desc,city,sector) from counted
 ), notifications as (
   select jsonb_agg(to_jsonb(q) order by q.created_at desc) from (
    select id,'partner'::text kind,public_name::text label,city::text place,
      created_at from public.bc_partner_applications where status='pending'
    union all
    select user_id,'client'::text kind,coalesce(p.display_name,'Client nou')::text label,
      ''::text place,c.requested_at created_at
    from public.bc_client_approvals c
    left join public.bc_profiles p on p.user_id=c.user_id
    where c.status='pending'
   ) q
 ), arrivals as (
   select jsonb_agg(to_jsonb(t) order by t.created_at desc) from (
    select id,coalesce(email,'Cont nou')::text label,created_at from auth.users
    order by created_at desc limit 8
   )t
 )
 select jsonb_build_object(
  'total_users',(select count(*) from auth.users),
  'new_users_7d',(select count(*) from auth.users where created_at>=now()-interval '7 days'),
  'pending_clients',(select count(*) from public.bc_client_approvals where status='pending'),
  'pending_partners',(select count(*) from public.bc_partner_applications where status='pending'),
  'pending_catalog',(select count(*) from public.bc_public_salon_catalog where visibility<>'listed'),
  'listed_salons',(select count(*) from public.bc_public_salon_catalog where visibility='listed'),
  'confirmed_bookings',(select count(*) from public.bc_pro_calendar_events where status='confirmed'),
  'regions',coalesce((select * from regions),'[]'::jsonb),
  'notifications',coalesce((select * from notifications),'[]'::jsonb),
  'new_users',coalesce((select * from arrivals),'[]'::jsonb)
 ) into response;
 return response;
end $$;
revoke all on function public.bc_admin_command_center() from public, anon,authenticated;
grant execute on function public.bc_admin_command_center() to authenticated;
