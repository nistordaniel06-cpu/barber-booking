-- Moderation queue for platform admins. Reports are private by design.
create or replace function public.bc_admin_social_reports()
returns jsonb language plpgsql stable security definer set search_path=''
as $$begin
 if (select auth.uid()) is null or not public.bc_is_platform_admin()
 then raise exception 'ADMIN_ONLY';end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
 'id',r.id,'reporter',r.reporter,'reported',r.reported,'reason',r.reason,'date',r.created_at)
 order by r.created_at desc)
 from (select * from public.bc_social_reports order by created_at desc limit 100)r),'[]'::jsonb);
end;$$;
revoke all on function public.bc_admin_social_reports() from public,anon;
grant execute on function public.bc_admin_social_reports() to authenticated;
