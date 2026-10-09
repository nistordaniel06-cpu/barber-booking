-- Fix haircut portfolio uploads and private previews for verified PRO members.
-- Bucket remains public only for explicit portfolio photos. Storage metadata
-- SELECT is limited to the authenticated owner, not to other members.
drop policy if exists bc_barber_portfolio_owner_select on storage.objects;
create policy bc_barber_portfolio_owner_select
on storage.objects for select to authenticated
using (
  bucket_id = 'bc-barber-portfolio'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Keep the public-profile opt-in boundary, while allowing a barber to see their
-- own unpublished gallery and previously uploaded photos without a social profile.
create or replace function public.bc_social_barber_details(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare u uuid; p record; has_profile boolean;
begin
  u := (select auth.uid());
  select * into p from public.bc_social_profiles where user_id = p_user;
  has_profile := found;
  if not public.bc_social_is_barber(p_user) then return null; end if;
  if u is distinct from p_user then
    if not has_profile or not coalesce(p.is_public, false)
      or exists(select 1 from public.bc_social_blocks
        where (blocker = u and blocked = p_user)
           or (blocker = p_user and blocked = u))
    then return null; end if;
  end if;
  return jsonb_build_object(
    'jobs',coalesce((
      select jsonb_agg(jsonb_build_object('id',j.id,'salon',j.salon_name,
        'title',j.role_title,'start',j.start_year,'end',j.end_year,
        'verification','Declarat de profesionist') order by j.start_year desc)
      from public.bc_barber_jobs j where user_id=p_user),'[]'::jsonb),
    'portfolio',coalesce((
      select jsonb_agg(jsonb_build_object('id',f.id,'path',f.object_path,
        'caption',f.caption) order by f.created_at desc)
      from public.bc_barber_portfolio f where user_id=p_user),'[]'::jsonb));
end;$$;
revoke all on function public.bc_social_barber_details(uuid) from public;
grant execute on function public.bc_social_barber_details(uuid) to anon,authenticated;
