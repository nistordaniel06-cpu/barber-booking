-- BARBERCRAFT: multi-city zone directory. This does not start competitions or grant points.
create table if not exists public.bc_zone_cities(
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(trim(name)) between 2 and 100),
 county text not null default '' check(char_length(county)<=100),
 is_listed boolean not null default false,
 created_at timestamptz not null default now(),
 unique(name,county)
);
create table if not exists public.bc_city_zones(
 id uuid primary key default gen_random_uuid(),
 city_id uuid not null references public.bc_zone_cities(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 2 and 100),
 is_listed boolean not null default false,
 created_at timestamptz not null default now(),
 unique(city_id,name)
);
create index if not exists bc_city_zones_parent on public.bc_city_zones(city_id,is_listed);
alter table public.bc_zone_cities enable row level security;
alter table public.bc_city_zones enable row level security;
revoke all on public.bc_zone_cities,public.bc_city_zones from public,anon,authenticated;
-- Only restricted RPCs expose/modify this config.
insert into public.bc_zone_cities(name,county,is_listed) values
 ('București','București',true),
 ('Cluj-Napoca','Cluj',true),
 ('Iași','Iași',true),
 ('Timișoara','Timiș',true),
 ('Constanța','Constanța',true),
 ('Brașov','Brașov',true)
on conflict(name,county) do nothing;
insert into public.bc_city_zones(city_id,name,is_listed)
select c.id,x.name,false from public.bc_zone_cities c
cross join lateral unnest(array['Sector 1','Sector 2','Sector 3','Sector 4','Sector 5','Sector 6']) as x(name)
where c.name='București'
on conflict(city_id,name) do nothing;

create or replace function public.bc_city_zones_public() returns jsonb
language sql stable security definer set search_path=''
as $$
 select coalesce(jsonb_agg(
 jsonb_build_object('id',c.id,'name',c.name,'county',c.county,
 'status',case when c.name='București' then 'pilot' else 'pregatire' end,
 'zones',coalesce((select jsonb_agg(jsonb_build_object('id',z.id,'name',z.name) order by z.name)
   from public.bc_city_zones z where z.city_id=c.id and z.is_listed),'[]'::jsonb))
 order by c.name),'[]'::jsonb)
 from public.bc_zone_cities c where c.is_listed
$$;
revoke all on function public.bc_city_zones_public() from public;
grant execute on function public.bc_city_zones_public() to anon,authenticated;

create or replace function public.bc_admin_zone_directory() returns jsonb
language plpgsql stable security definer set search_path=''
as $$
begin
 if (select auth.uid()) is null or not public.bc_is_platform_admin() then raise exception 'ADMIN_ONLY';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'county',c.county,
  'is_listed',c.is_listed,'zones',coalesce(
    (select jsonb_agg(jsonb_build_object('id',z.id,'name',z.name,'is_listed',z.is_listed) order by z.name)
    from public.bc_city_zones z where z.city_id=c.id),'[]'::jsonb)) order by c.name)
    from public.bc_zone_cities c),'[]'::jsonb);
end;$$;
revoke all on function public.bc_admin_zone_directory() from public,anon;
grant execute on function public.bc_admin_zone_directory() to authenticated;

create or replace function public.bc_admin_city_save(
 p_id uuid,p_name text,p_county text,p_listed boolean
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
 if (select auth.uid()) is null or not public.bc_is_platform_admin() then raise exception 'ADMIN_ONLY';end if;
 if char_length(trim(coalesce(p_name,''))) not between 2 and 100
 or char_length(coalesce(p_county,''))>100 then raise exception 'INVALID_CITY';end if;
 if p_id is null then
  insert into public.bc_zone_cities(name,county,is_listed)
  values(trim(p_name),trim(coalesce(p_county,'')),coalesce(p_listed,false))
  returning id into v_id;
 else
  update public.bc_zone_cities set name=trim(p_name),county=trim(coalesce(p_county,'')),
  is_listed=coalesce(p_listed,false) where id=p_id returning id into v_id;
  if v_id is null then raise exception 'CITY_NOT_FOUND';end if;
 end if;
 return v_id;
end;$$;
revoke all on function public.bc_admin_city_save(uuid,text,text,boolean) from public,anon;
grant execute on function public.bc_admin_city_save(uuid,text,text,boolean) to authenticated;

create or replace function public.bc_admin_zone_save(
 p_id uuid,p_city uuid,p_name text,p_listed boolean
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
 if (select auth.uid()) is null or not public.bc_is_platform_admin() then raise exception 'ADMIN_ONLY';end if;
 if char_length(trim(coalesce(p_name,''))) not between 2 and 100
 or not exists(select 1 from public.bc_zone_cities where id=p_city) then
 raise exception 'INVALID_ZONE';end if;
 if p_id is null then
  insert into public.bc_city_zones(city_id,name,is_listed)
  values(p_city,trim(p_name),coalesce(p_listed,false)) returning id into v_id;
 else
  update public.bc_city_zones set name=trim(p_name),is_listed=coalesce(p_listed,false)
  where id=p_id and city_id=p_city returning id into v_id;
  if v_id is null then raise exception 'ZONE_NOT_FOUND';end if;
 end if;
 return v_id;
end;$$;
revoke all on function public.bc_admin_zone_save(uuid,uuid,text,boolean) from public,anon;
grant execute on function public.bc_admin_zone_save(uuid,uuid,text,boolean) to authenticated;
