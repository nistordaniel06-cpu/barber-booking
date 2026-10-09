-- Optional user-selected avatar in the Client portal, public thumbnail only.
-- The full user account / identity stays inaccessible to other portals.
alter table public.bc_profiles add column if not exists avatar_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bc-client-avatars','bc-client-avatars',true,1048576,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set file_size_limit=1048576,
 allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists bc_client_avatar_insert on storage.objects;
create policy bc_client_avatar_insert on storage.objects for insert to authenticated
with check(bucket_id='bc-client-avatars'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and coalesce((public.bc_portal_access('client')->>'allowed')::boolean,false));

drop policy if exists bc_client_avatar_owner_select on storage.objects;
create policy bc_client_avatar_owner_select on storage.objects for select to authenticated
using(bucket_id='bc-client-avatars'
 and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists bc_client_avatar_owner_delete on storage.objects;
create policy bc_client_avatar_owner_delete on storage.objects for delete to authenticated
using(bucket_id='bc-client-avatars'
 and (storage.foldername(name))[1]=(select auth.uid())::text);

create or replace function public.bc_client_set_avatar(p_path text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;
begin
 u:=(select auth.uid());
 if u is null or not coalesce((public.bc_portal_access('client')->>'allowed')::boolean,false) then
  raise exception 'CLIENT_ACCOUNT_REQUIRED' using errcode='42501';
 end if;
 if p_path is null or p_path !~* ('^'||u::text||'/[0-9a-f-]{36}\\.(jpg|png|webp)$') then
  raise exception 'INVALID_AVATAR_PATH' using errcode='22023';
 end if;
 if not exists(select 1 from storage.objects where bucket_id='bc-client-avatars' and name=p_path) then
  raise exception 'AVATAR_NOT_UPLOADED';
 end if;
 insert into public.bc_profiles(user_id,display_name,avatar_path)
 values(u,'Client BARBERCRAFT',p_path)
 on conflict(user_id) do update set avatar_path=excluded.avatar_path;
 return jsonb_build_object('ok',true,'path',p_path);
end $$;
revoke all on function public.bc_client_set_avatar(text) from public,anon,authenticated;
grant execute on function public.bc_client_set_avatar(text) to authenticated;
