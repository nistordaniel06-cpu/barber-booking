-- Reassociating a catalog card must never carry over the former salon's public-booking consent.
create or replace function public.bc_admin_catalog_link(p_catalog uuid,p_salon uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
begin
 if not public.bc_is_platform_admin() then raise exception 'FORBIDDEN';end if;
 if not exists(select 1 from public.bc_salons where id=p_salon and archived_at is null)
 then raise exception 'SALON_NOT_FOUND';end if;
 if exists(select 1 from public.bc_public_salon_catalog
 where salon_id=p_salon and id<>p_catalog) then raise exception 'ALREADY_LINKED';end if;
 update public.bc_public_salon_catalog c set salon_id=p_salon,public_booking_enabled=false,
 description=s.description,phone=s.phone,website=s.website,cover_image_url=s.cover_image_url
 from public.bc_salons s where c.id=p_catalog and s.id=p_salon;
 if not found then raise exception 'CATALOG_NOT_FOUND';end if;
 insert into public.bc_admin_audit(actor_id,action,target_type,target_id)
 values((select auth.uid()),'link_catalog','catalog',p_catalog::text);
 return jsonb_build_object('ok',true,'public_booking_enabled',false);
end;$$;
revoke all on function public.bc_admin_catalog_link(uuid,uuid) from public,anon;
grant execute on function public.bc_admin_catalog_link(uuid,uuid) to authenticated;

-- Carry gallery assets from a sample only after upload with publication permission.
alter table public.bc_public_salon_catalog
 add column if not exists explore_gallery_paths jsonb not null default '[]'::jsonb;
create or replace function public.bc_admin_explore_promote(p_sample uuid,p_confirmed boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare sample public.bc_discovery_salon_samples%rowtype;catalog public.bc_public_salon_catalog%rowtype;
begin
 if not public.bc_is_platform_admin() then raise exception 'ADMIN_ONLY';end if;
 if p_confirmed is distinct from true then raise exception 'REVIEW_REQUIRED';end if;
 select * into sample from public.bc_discovery_salon_samples where id=p_sample for update;
 if not found then raise exception 'EXPLORE_NOT_FOUND';end if;
 if length(trim(sample.name))<2 or length(trim(sample.address))<5
  or trim(sample.city)='' or trim(sample.county)=''
 then raise exception 'COMPLETE_SALON_DETAILS_FIRST';end if;
 select * into catalog from public.bc_public_salon_catalog where explore_sample_id=p_sample for update;
 if not found then
  if exists(select 1 from public.bc_public_salon_catalog c where lower(trim(c.name))=lower(trim(sample.name))
    and lower(trim(coalesce(c.address,'')))=lower(trim(sample.address))
    and c.explore_sample_id is distinct from p_sample)
  then raise exception 'POSSIBLE_DUPLICATE_IN_CATALOG';end if;
  insert into public.bc_public_salon_catalog(
   explore_sample_id,name,address,city,county,sector,services,visibility,explore_cover_path,explore_gallery_paths
  )values(
   p_sample,trim(sample.name),trim(sample.address),trim(sample.city),trim(sample.county),sample.sector,
   sample.services,'listed',case when sample.photo_permission then sample.cover_path else null end,
   case when sample.photo_permission then sample.gallery_paths else '[]'::jsonb end
  ) returning * into catalog;
 else
  if catalog.salon_id is not null then raise exception 'PROFILE_ALREADY_LINKED_TO_PRO_MANAGE_FROM_PRO';end if;
  update public.bc_public_salon_catalog c set name=trim(sample.name),address=trim(sample.address),
   city=trim(sample.city),county=trim(sample.county),sector=sample.sector,services=sample.services,
   explore_cover_path=case when sample.photo_permission then sample.cover_path else null end,
   explore_gallery_paths=case when sample.photo_permission then sample.gallery_paths else '[]'::jsonb end,
   visibility='listed'
  where c.id=catalog.id returning * into catalog;
 end if;
 update public.bc_discovery_salon_samples set is_visible=false where id=p_sample;
 insert into public.bc_admin_audit(actor_id,action,target_type,target_id,details)
 values((select auth.uid()),'promote_explore','catalog',catalog.id::text,
 jsonb_build_object('explore_sample',p_sample,'booking_enabled',false));
 return jsonb_build_object('ok',true,'catalog_id',catalog.id,'booking_enabled',false,
 'linked_pro',catalog.salon_id is not null);
end;$$;
revoke all on function public.bc_admin_explore_promote(uuid,boolean) from public,anon;
grant execute on function public.bc_admin_explore_promote(uuid,boolean) to authenticated;
