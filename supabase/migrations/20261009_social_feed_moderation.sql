-- Admin report queue includes both profiles and public posts, private to platform administrators.
create or replace function public.bc_admin_social_reports()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
 if (select auth.uid()) is null or not public.bc_is_platform_admin()
 then raise exception 'ADMIN_ONLY';end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
 'id',r.id,'reporter',r.reporter,'reported',r.reported,
 'post_id',r.post_id,'kind',r.kind,'reason',r.reason,'date',r.created_at)
 order by r.created_at desc)
 from (
 select id,reporter,reported,null::uuid as post_id,
 'profile'::text as kind,reason,created_at from public.bc_social_reports
 union all
 select pr.id,pr.reporter,po.user_id as reported,pr.post_id,
 'post'::text as kind,pr.reason,pr.created_at
 from public.bc_social_post_reports pr join public.bc_social_posts po on po.id=pr.post_id
 order by created_at desc limit 100
 )r),'[]'::jsonb);
end;$$;
revoke all on function public.bc_admin_social_reports() from public,anon;
grant execute on function public.bc_admin_social_reports() to authenticated;
