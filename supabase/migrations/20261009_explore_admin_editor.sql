-- Admin-managed discovery samples: not partner salons and never bookable.
-- Keep original provenance privately; public listings do not expose external source URLs.
alter table public.bc_discovery_salon_samples
 add column if not exists is_visible boolean not null default true,
 add column if not exists cover_path text,
 add column if not exists gallery_paths jsonb not null default '[]'::jsonb,
 add column if not exists data_status text not null default 'external_sample'
  check(data_status in ('external_sample','admin_updated')),
 add column if not exists edited_at timestamptz,
 add column if not exists edited_by uuid references auth.users(id);
alter table public.bc_discovery_salon_samples alter column source_url drop not null;
drop policy if exists bc_sample_public_preview on public.bc_discovery_salon_samples;
create policy bc_sample_public_preview on public.bc_discovery_salon_samples
 for select to anon,authenticated using(is_visible=true);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bc-explore-images','bc-explore-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
drop policy if exists bc_explore_image_upload_admin on storage.objects;
create policy bc_explore_image_upload_admin on storage.objects for insert to authenticated
 with check(bucket_id='bc-explore-images' and public.bc_is_platform_admin());
drop policy if exists bc_explore_image_update_admin on storage.objects;
create policy bc_explore_image_update_admin on storage.objects for update to authenticated
 using(bucket_id='bc-explore-images' and public.bc_is_platform_admin())
 with check(bucket_id='bc-explore-images' and public.bc_is_platform_admin());
drop policy if exists bc_explore_image_remove_admin on storage.objects;
create policy bc_explore_image_remove_admin on storage.objects for delete to authenticated
 using(bucket_id='bc-explore-images' and public.bc_is_platform_admin());

create or replace function public.bc_admin_explore_list()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
 if not public.bc_is_platform_admin() then raise exception 'ADMIN_ONLY';end if;
 return coalesce((select jsonb_agg(to_jsonb(s) order by s.name,s.id)
 from public.bc_discovery_salon_samples s),'[]'::jsonb);
end;$$;
revoke all on function public.bc_admin_explore_list() from public,anon;
grant execute on function public.bc_admin_explore_list() to authenticated;

create or replace function public.bc_admin_explore_save(
 p_id uuid,p_name text,p_address text,p_city text,p_county text,p_sector text,
 p_services jsonb,p_team jsonb,p_cover text,p_gallery jsonb,
 p_visible boolean,p_photos_authorized boolean
) returns uuid language plpgsql security definer set search_path=''
as $$
declare u uuid;target uuid;rec public.bc_discovery_salon_samples%rowtype;
 media text;item jsonb;
begin
 u:=(select auth.uid());
 if u is null or not public.bc_is_platform_admin() then raise exception 'ADMIN_ONLY';end if;
 if length(trim(coalesce(p_name,''))) not between 2 and 120 or
 length(trim(coalesce(p_address,''))) not between 5 and 240 or
 length(trim(coalesce(p_city,''))) not between 2 and 90 or
 length(trim(coalesce(p_county,''))) not between 2 and 90 or
 length(trim(coalesce(p_sector,''))) not between 1 and 90 then raise exception 'INVALID_DETAILS';end if;
 if jsonb_typeof(p_services) is distinct from 'array' or jsonb_array_length(p_services)>40
 or jsonb_typeof(p_team) is distinct from 'array' or jsonb_array_length(p_team)>30
 or jsonb_typeof(p_gallery) is distinct from 'array' or jsonb_array_length(p_gallery)>12
 then raise exception 'INVALID_COLLECTION';end if;
 for item in select value from jsonb_array_elements(p_services)loop
  if jsonb_typeof(item) is distinct from 'object'
  or length(trim(coalesce(item->>'name',''))) not between 2 and 110
  or length(trim(coalesce(item->>'price',''))) not between 1 and 65
  or length(coalesce(item->>'duration',''))>65
  then raise exception 'INVALID_SERVICE';end if;
 end loop;
 for item in select value from jsonb_array_elements(p_team)loop
  if jsonb_typeof(item) is distinct from 'string' or length(trim(item #>> '{}')) not between 2 and 90
  then raise exception 'INVALID_TEAM';end if;
 end loop;
 target:=coalesce(p_id,gen_random_uuid());
 if p_id is not null then
  select * into rec from public.bc_discovery_salon_samples where id=target for update;
  if not found then raise exception 'NOT_FOUND';end if;
 end if;
 if (p_cover is not null or jsonb_array_length(p_gallery)>0) and p_photos_authorized is not true
 then raise exception 'PHOTO_RIGHTS_CONFIRMATION_REQUIRED';end if;
 for media in select path from (
  select p_cover as path union all select value #>> '{}' as path from jsonb_array_elements(p_gallery)
 )f where path is not null loop
  if media !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\\.(jpg|png|webp)$'
  or split_part(media,'/',1)<>target::text
  or not exists(select 1 from storage.objects so where so.bucket_id='bc-explore-images' and so.name=media)
  then raise exception 'INVALID_IMAGE';end if;
 end loop;
 insert into public.bc_discovery_salon_samples(
  id,name,address,city,county,sector,services,publicly_listed_team,
  is_visible,photo_permission,cover_path,gallery_paths,data_status,edited_at,edited_by
 )values(
  target,trim(p_name),trim(p_address),trim(p_city),trim(p_county),trim(p_sector),p_services,p_team,
  coalesce(p_visible,true),coalesce(p_photos_authorized,false),p_cover,p_gallery,'admin_updated',now(),u
 )on conflict(id) do update set
 name=excluded.name,address=excluded.address,city=excluded.city,county=excluded.county,
 sector=excluded.sector,services=excluded.services,publicly_listed_team=excluded.publicly_listed_team,
 is_visible=excluded.is_visible,photo_permission=excluded.photo_permission,
 cover_path=excluded.cover_path,gallery_paths=excluded.gallery_paths,
 data_status='admin_updated',edited_at=now(),edited_by=u;
 return target;
end;$$;
revoke all on function public.bc_admin_explore_save(uuid,text,text,text,text,text,jsonb,jsonb,text,jsonb,boolean,boolean) from public,anon;
grant execute on function public.bc_admin_explore_save(uuid,text,text,text,text,text,jsonb,jsonb,text,jsonb,boolean,boolean) to authenticated;

create or replace function public.bc_admin_explore_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare record public.bc_discovery_salon_samples%rowtype;
begin
 if not public.bc_is_platform_admin() then raise exception 'ADMIN_ONLY';end if;
 delete from public.bc_discovery_salon_samples where id=p_id returning * into record;
 if not found then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object('deleted',true,'name',record.name,'cover',record.cover_path,'gallery',record.gallery_paths);
end;$$;
revoke all on function public.bc_admin_explore_delete(uuid) from public,anon;
grant execute on function public.bc_admin_explore_delete(uuid) to authenticated;
