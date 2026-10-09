-- Validate PRO eligibility in Storage as well as in the publishing RPC.
-- Prevent unused public storage uploads after today's limit is already reached.
create or replace function public.bc_social_pro_gallery_upload_allowed()
returns boolean language sql stable security definer set search_path=''
as $$
select (select auth.uid()) is not null
 and public.bc_social_is_barber((select auth.uid()))
 and (select count(*) from public.bc_pro_portfolio_upload_log
   where user_id=(select auth.uid())
     and posted_on=(now() at time zone 'Europe/Bucharest')::date)
     < public.bc_social_pro_daily_photo_limit((select auth.uid()));
$$;
revoke all on function public.bc_social_pro_gallery_upload_allowed() from public,anon;
grant execute on function public.bc_social_pro_gallery_upload_allowed() to authenticated;

drop policy if exists bc_barber_portfolio_insert on storage.objects;
create policy bc_barber_portfolio_insert on storage.objects
for insert to authenticated with check(
 bucket_id='bc-barber-portfolio'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and public.bc_social_pro_gallery_upload_allowed()
);
