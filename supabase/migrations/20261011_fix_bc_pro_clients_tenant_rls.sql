-- Security hardening: 2026-10-11
-- Scope every bc_pro_clients SELECT/INSERT to the target row's salon_id.
-- Previously both policies used 'm.salon_id = m.salon_id' (tautology), so
-- membership in salon A could authorize reading/inserting rows of salon B.
-- Deliberately minimal: no table/data changes and no new access roles.
--
-- Review & deploy once to Barbercraft Supabase (Domn):
--   zqdsrgamoqcvbmazbwcq
-- Do not run against a different project or replace bc_salon_members rules.

begin;

alter policy bc_pro_client_read on public.bc_pro_clients
  to authenticated
  using (
    exists (
      select 1
      from public.bc_salon_members as m
      where m.user_id = (select auth.uid())
        and m.salon_id = bc_pro_clients.salon_id
    )
  );

alter policy bc_pro_client_add on public.bc_pro_clients
  to authenticated
  with check (
    exists (
      select 1
      from public.bc_salon_members as m
      where m.user_id = (select auth.uid())
        and m.salon_id = bc_pro_clients.salon_id
        and m.role in ('owner', 'admin', 'manager')
    )
  );

commit;

-- Post-deploy verification, run manually with read-only pg_policies query:
-- select policyname,cmd,qual,with_check from pg_policies
-- where schemaname='public' and tablename='bc_pro_clients';
--
-- Staging E2E:
-- 1. Login as owner of salon A, SELECT rows of B => 0 rows.
-- 2. Login as owner of salon A, INSERT with B's salon_id => RLS error.
-- 3. Login as owner of salon A, SELECT/INSERT own salon A => works.
-- 4. Login as staff of A, INSERT into A => RLS error.
-- 5. Unauthenticated/Client accounts => no access.
