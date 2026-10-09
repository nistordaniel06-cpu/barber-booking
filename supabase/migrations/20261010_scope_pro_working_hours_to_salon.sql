-- Fix opening-hours RLS policies that compared m.salon_id = m.salon_id,
-- which did not scope the calendar hours to the requested salon.
-- Reuse the current, real membership relationship. Never grant a Client
-- permission to edit or read another salon's schedule.
create or replace function public.bc_can_manage_pro_hours(p_salon uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select (select auth.uid()) is not null
   and exists (
     select 1 from public.bc_salon_members m
     where m.salon_id = p_salon
       and m.user_id = (select auth.uid())
       and m.role in ('owner','manager')
   );
$$;
revoke all on function public.bc_can_manage_pro_hours(uuid) from public, anon, authenticated;
grant execute on function public.bc_can_manage_pro_hours(uuid) to authenticated;

drop policy if exists bc_hours_read_members on public.bc_pro_working_hours;
create policy bc_hours_read_members on public.bc_pro_working_hours
for select to authenticated
using (public.bc_is_salon_member(salon_id));

drop policy if exists bc_hours_insert_owners on public.bc_pro_working_hours;
create policy bc_hours_insert_owners on public.bc_pro_working_hours
for insert to authenticated
with check (public.bc_can_manage_pro_hours(salon_id));

drop policy if exists bc_hours_update_owners on public.bc_pro_working_hours;
create policy bc_hours_update_owners on public.bc_pro_working_hours
for update to authenticated
using (public.bc_can_manage_pro_hours(salon_id))
with check (public.bc_can_manage_pro_hours(salon_id));
