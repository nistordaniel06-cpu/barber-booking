-- BARBERCRAFT: staged discovery -> catalog -> owner-approved public appointment flow.
-- Promoting external profiles never grants ownership or activates bookings.
alter table public.bc_public_salon_catalog
 add column if not exists explore_sample_id uuid unique references public.bc_discovery_salon_samples(id) on delete restrict,
 add column if not exists explore_cover_path text,
 add column if not exists public_booking_enabled boolean not null default false;

create or replace function public.bc_admin_explore_list()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
 if not public.bc_is_platform_admin() then raise exception 'ADMIN_ONLY';end if;
 return coalesce((select jsonb_agg(
  to_jsonb(s)||jsonb_build_object('catalog_id',c.id,'catalog_visibility',c.visibility,
  'catalog_pro_salon',c.salon_id,'catalog_booking_enabled',c.public_booking_enabled)
  order by s.name,s.id)
 from public.bc_discovery_salon_samples s
 left join public.bc_public_salon_catalog c on c.explore_sample_id=s.id),'[]'::jsonb);
end;$$;
revoke all on function public.bc_admin_explore_list() from public,anon;
grant execute on function public.bc_admin_explore_list() to authenticated;

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
   explore_sample_id,name,address,city,county,sector,services,visibility,explore_cover_path
  )values(
   p_sample,trim(sample.name),trim(sample.address),trim(sample.city),trim(sample.county),sample.sector,
   sample.services,'listed',case when sample.photo_permission then sample.cover_path else null end
  ) returning * into catalog;
 else
  if catalog.salon_id is not null then
   raise exception 'PROFILE_ALREADY_LINKED_TO_PRO_MANAGE_FROM_PRO';
  end if;
  update public.bc_public_salon_catalog c set name=trim(sample.name),address=trim(sample.address),
   city=trim(sample.city),county=trim(sample.county),sector=sample.sector,services=sample.services,
   explore_cover_path=case when sample.photo_permission then sample.cover_path else null end,
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

create or replace function public.bc_admin_catalog_list()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
 if not public.bc_is_platform_admin() then raise exception 'FORBIDDEN';end if;
 return coalesce((select jsonb_agg(to_jsonb(t)) from (
 select id,salon_id,name,address,visibility,city,county,sector,services,description,
 cover_image_url,explore_cover_path,explore_sample_id,public_booking_enabled,created_at
 from public.bc_public_salon_catalog order by created_at desc)t),'[]'::jsonb);
end;$$;
revoke all on function public.bc_admin_catalog_list() from public,anon;
grant execute on function public.bc_admin_catalog_list() to authenticated;

-- Existing catalog association can be made only to an existing PRO salon by admin.
-- A separate owner/manager confirmation is mandatory before the client-facing booking button works.
create or replace function public.bc_catalog_booking_toggle(p_catalog uuid,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare c public.bc_public_salon_catalog%rowtype;conf public.bc_pilot_config%rowtype;
begin
 select * into c from public.bc_public_salon_catalog where id=p_catalog for update;
 if not found or c.salon_id is null then raise exception 'LINK_PRO_SALON_FIRST';end if;
 if (select auth.uid()) is null or not exists(
  select 1 from public.bc_salon_members m
  where m.salon_id=c.salon_id and m.user_id=(select auth.uid())
  and m.role in ('owner','manager')
 ) then raise exception 'SALON_OWNER_APPROVAL_REQUIRED';end if;
 if p_enabled is true then
  if c.visibility<>'listed' or not exists(
   select 1 from public.bc_salons s where s.id=c.salon_id and s.archived_at is null)
  then raise exception 'SALON_NOT_PUBLIC';end if;
  select * into conf from public.bc_pilot_config where salon_id=c.salon_id;
  if conf.enabled is distinct from true or jsonb_array_length(conf.services)=0
   then raise exception 'CONFIGURE_SERVICES_AND_OPEN_HOURS_FIRST';end if;
 end if;
 update public.bc_public_salon_catalog set public_booking_enabled=coalesce(p_enabled,false) where id=p_catalog;
 return jsonb_build_object('enabled',coalesce(p_enabled,false));
end;$$;
revoke all on function public.bc_catalog_booking_toggle(uuid,boolean) from public,anon;
grant execute on function public.bc_catalog_booking_toggle(uuid,boolean) to authenticated;

create or replace function public.bc_catalog_owner_booking_state(p_salon uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
 if (select auth.uid()) is null or not exists(
 select 1 from public.bc_salon_members where salon_id=p_salon
 and user_id=(select auth.uid()) and role in ('owner','manager'))
 then raise exception 'SALON_OWNER_APPROVAL_REQUIRED';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,
  'listed',c.visibility='listed','public_booking_enabled',c.public_booking_enabled))
 from public.bc_public_salon_catalog c where c.salon_id=p_salon),'[]'::jsonb);
end;$$;
revoke all on function public.bc_catalog_owner_booking_state(uuid) from public,anon;
grant execute on function public.bc_catalog_owner_booking_state(uuid) to authenticated;

-- No invite token exposed to the public. The public route wraps the existing
-- collision-safe, owner-approved booking engine and checks listing + activation on each call.
create or replace function public.bc_catalog_booking_public(p_catalog uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare c record;
begin
 select cat.salon_id,cat.name,cat.address,conf.services,conf.opens,conf.closes
 into c
 from public.bc_public_salon_catalog cat
 join public.bc_salons s on s.id=cat.salon_id and s.archived_at is null
 join public.bc_pilot_config conf on conf.salon_id=s.id and conf.enabled=true
 where cat.id=p_catalog and cat.visibility='listed' and cat.public_booking_enabled=true;
 if not found then return jsonb_build_object('enabled',false);end if;
 return jsonb_build_object('enabled',true,'name',c.name,'address',c.address,
  'services',c.services,'opens',to_char(c.opens,'HH24:MI'),
  'closes',to_char(c.closes,'HH24:MI'),'catalog_id',p_catalog);
end;$$;
revoke all on function public.bc_catalog_booking_public(uuid) from public;
grant execute on function public.bc_catalog_booking_public(uuid) to anon,authenticated;

create or replace function public.bc_catalog_booking_slots(
 p_catalog uuid,p_date date,p_service text)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare s uuid;token text;
begin
 select c.salon_id,p.invite_code into s,token from public.bc_public_salon_catalog c
 join public.bc_salons v on v.id=c.salon_id and v.archived_at is null
 join public.bc_pilot_config p on p.salon_id=c.salon_id and p.enabled=true
 where c.id=p_catalog and c.visibility='listed' and c.public_booking_enabled=true;
 if s is null then return '[]'::jsonb;end if;
 return public.bc_pilot_slots(s,token,p_date,p_service);
end;$$;
revoke all on function public.bc_catalog_booking_slots(uuid,date,text) from public;
grant execute on function public.bc_catalog_booking_slots(uuid,date,text) to anon,authenticated;

create or replace function public.bc_catalog_booking_create(
 p_catalog uuid,p_request uuid,p_service text,p_date date,p_time time,
 p_name text,p_phone text,p_consent boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare c public.bc_public_salon_catalog%rowtype;token text;
begin
 select * into c from public.bc_public_salon_catalog where id=p_catalog for update;
 if not found or c.salon_id is null or c.visibility<>'listed'
  or c.public_booking_enabled is distinct from true
 then raise exception 'ONLINE_BOOKING_NOT_ENABLED';end if;
 if not exists(select 1 from public.bc_salons where id=c.salon_id and archived_at is null)
 then raise exception 'SALON_INACTIVE';end if;
 select invite_code into token from public.bc_pilot_config
 where salon_id=c.salon_id and enabled=true;
 if token is null then raise exception 'OWNER_HAS_CLOSED_BOOKINGS';end if;
 return public.bc_pilot_book(c.salon_id,token,p_request,p_service,p_date,p_time,
  p_name,p_phone,p_consent);
end;$$;
revoke all on function public.bc_catalog_booking_create(uuid,uuid,text,date,time,text,text,boolean) from public;
grant execute on function public.bc_catalog_booking_create(uuid,uuid,text,date,time,text,text,boolean) to anon,authenticated;
