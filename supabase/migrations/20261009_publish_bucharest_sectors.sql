-- Make all six real București sectors visible in Bătălia Zonelor zone directory.
-- This is a directory-only operation. No games, scores, XP or rewards are activated.
insert into public.bc_city_zones(city_id,name,is_listed)
select c.id,'Sector '||n.num,true from public.bc_zone_cities c
cross join generate_series(1,6) as n(num)
where c.name='București' and c.county='București'
on conflict(city_id,name) do update set is_listed=true;
