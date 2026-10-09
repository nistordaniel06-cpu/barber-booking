-- Fix a cross-bucket Storage RLS failure:
-- bc_social_feed_insert used to read bc_social_profiles directly in an
-- authenticated user's context. That private table intentionally has no
-- authenticated SELECT grant, so a cover upload to bc-salon-covers could
-- fail with "permission denied for table bc_social_profiles".
-- Keep the private social table locked down; expose only a boolean check.
create or replace function public.bc_social_feed_upload_allowed()
returns boolean
language sql stable security definer
set search_path = ''
as $$
 select (select auth.uid()) is not null
   and exists (
     select 1 from public.bc_social_profiles p
     where p.user_id = (select auth.uid())
       and p.is_public is true
   );
$$;

revoke all on function public.bc_social_feed_upload_allowed() from public, anon, authenticated;
grant execute on function public.bc_social_feed_upload_allowed() to authenticated;

drop policy if exists bc_social_feed_insert on storage.objects;
create policy bc_social_feed_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'bc-social-feed'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select public.bc_social_feed_upload_allowed())
);

-- Return uploaded salon-cover metadata to the salon's owner/manager.
-- This is a metadata SELECT policy, not a public-listing permission.
drop policy if exists bc_salon_cover_owner_select on storage.objects;
create policy bc_salon_cover_owner_select on storage.objects
for select to authenticated
using (
  bucket_id = 'bc-salon-covers'
  and exists (
    select 1 from public.bc_salon_members m
    where m.salon_id = (split_part(name, '/', 1))::uuid
      and m.user_id = (select auth.uid())
      and m.role in ('owner','manager')
  )
);
