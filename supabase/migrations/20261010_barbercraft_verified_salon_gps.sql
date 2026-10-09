-- Verified map pin coordinates supplied by salon owner/manager while on location.
-- Unknown coordinates remain NULL; never invent positions from addresses.
alter table public.bc_salons add column if not exists geo_lat numeric(9,6);
alter table public.bc_salons add column if not exists geo_lng numeric(9,6);
alter table public.bc_public_salon_catalog add column if not exists geo_lat numeric(9,6);
alter table public.bc_public_salon_catalog add column if not exists geo_lng numeric(9,6);

create or replace function public.bc_pro_save_salon_location(p_salon uuid,p_lat numeric,p_lng numeric)
returns jsonb language plpgsql security definer set search_path=''
as $$
begin
 if not public.bc_can_manage_pro_hours(p_salon) then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 if p_lat is null or p_lng is null or p_lat<43 or p_lat>49 or p_lng<20 or p_lng>30 then
  raise exception 'INVALID_ROMANIA_LOCATION' using errcode='22023';
 end if;
 update public.bc_salons set geo_lat=round(p_lat,6),geo_lng=round(p_lng,6)
 where id=p_salon and archived_at is null;
 if not found then raise exception 'SALON_NOT_FOUND';end if;
 update public.bc_public_salon_catalog set geo_lat=round(p_lat,6),geo_lng=round(p_lng,6)
 where salon_id=p_salon;
 return jsonb_build_object('ok',true,'latitude',round(p_lat,6),'longitude',round(p_lng,6));
end $$;
revoke all on function public.bc_pro_save_salon_location(uuid,numeric,numeric) from public,anon,authenticated;
grant execute on function public.bc_pro_save_salon_location(uuid,numeric,numeric) to authenticated;
