-- Bătălia Zonelor strategic sandbox. Resources and units have NO monetary/XP value.
-- Server-generated time progression with a six-hour production cap prevents client cheating.
create table if not exists public.bc_kingdom_villages(
 user_id uuid primary key references auth.users(id) on delete cascade,
 name text not null default 'Tabăra mea' check(length(name) between 3 and 60),
 wood integer not null default 240 check(wood>=0),
 stone integer not null default 220 check(stone>=0),
 iron integer not null default 200 check(iron>=0),
 food integer not null default 200 check(food>=0),
 infantry integer not null default 0 check(infantry>=0),
 buildings jsonb not null default '{"wood":1,"stone":1,"iron":1,"farm":1,"storage":1,"barracks":1,"wall":1}'::jsonb,
 last_tick timestamptz not null default now(),
 last_mission date,
 created_at timestamptz not null default now()
);
alter table public.bc_kingdom_villages enable row level security;
revoke all on public.bc_kingdom_villages from public,anon,authenticated;
create or replace function public.bc_kingdom_update_tick(p_user uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v public.bc_kingdom_villages%rowtype;hours numeric; cap integer;
begin
 select * into v from public.bc_kingdom_villages where user_id=p_user for update;
 if not found then raise exception 'NO_VILLAGE';end if;
 hours:=least(6,greatest(0,extract(epoch from now()-v.last_tick)/3600));
 cap:=400+(coalesce((v.buildings->>'storage')::integer,1)-1)*150;
 update public.bc_kingdom_villages set
 wood=least(cap,v.wood+floor(hours*(25+15*(coalesce((v.buildings->>'wood')::integer,1)-1)))::integer),
 stone=least(cap,v.stone+floor(hours*(20+12*(coalesce((v.buildings->>'stone')::integer,1)-1)))::integer),
 iron=least(cap,v.iron+floor(hours*(20+12*(coalesce((v.buildings->>'iron')::integer,1)-1)))::integer),
 food=least(cap,v.food+floor(hours*(25+15*(coalesce((v.buildings->>'farm')::integer,1)-1)))::integer),
 last_tick=now()
 where user_id=p_user;
end;$$;
revoke all on function public.bc_kingdom_update_tick(uuid) from public,anon,authenticated;
create or replace function public.bc_kingdom_state()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;v public.bc_kingdom_villages%rowtype;
begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 insert into public.bc_kingdom_villages(user_id)values(u) on conflict do nothing;
 perform public.bc_kingdom_update_tick(u);
 select * into v from public.bc_kingdom_villages where user_id=u;
 return jsonb_build_object('wood',v.wood,'stone',v.stone,'iron',v.iron,'food',v.food,
 'infantry',v.infantry,'buildings',v.buildings,'name',v.name,'last_tick',v.last_tick,
 'mission_available',v.last_mission is distinct from (now() at time zone 'Europe/Bucharest')::date,
 'sector',(select home_sector from public.bc_tw_memberships where user_id=u),
 'practice',true,'convertible',false);
end;$$;
revoke all on function public.bc_kingdom_state() from public,anon;
grant execute on function public.bc_kingdom_state() to authenticated;
create or replace function public.bc_kingdom_build(p_kind text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;v public.bc_kingdom_villages%rowtype;lvl integer;costw integer;costs integer;costi integer;
begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 if p_kind not in('wood','stone','iron','farm','storage','barracks','wall') then raise exception 'INVALID_BUILDING';end if;
 perform public.bc_kingdom_update_tick(u);
 select * into v from public.bc_kingdom_villages where user_id=u for update;
 lvl:=coalesce((v.buildings->>p_kind)::integer,1);
 if lvl>=10 then raise exception 'MAX_LEVEL';end if;
 costw:=30*lvl*lvl;costs:=25*lvl*lvl;costi:=20*lvl*lvl;
 if v.wood<costw or v.stone<costs or v.iron<costi then raise exception 'NOT_ENOUGH_RESOURCES';end if;
 update public.bc_kingdom_villages set wood=wood-costw,stone=stone-costs,iron=iron-costi,
 buildings=jsonb_set(buildings,array[p_kind],to_jsonb(lvl+1)) where user_id=u;
 return jsonb_build_object('building',p_kind,'level',lvl+1,'resource_cost',
 jsonb_build_object('wood',costw,'stone',costs,'iron',costi));
end;$$;
revoke all on function public.bc_kingdom_build(text) from public,anon;
grant execute on function public.bc_kingdom_build(text) to authenticated;
create or replace function public.bc_kingdom_train(p_units integer)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;v public.bc_kingdom_villages%rowtype;maxunits integer;
begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 if p_units not between 1 and 20 then raise exception 'INVALID_UNIT_COUNT';end if;
 perform public.bc_kingdom_update_tick(u);
 select * into v from public.bc_kingdom_villages where user_id=u for update;
 maxunits:=10*coalesce((v.buildings->>'barracks')::integer,1);
 if v.infantry+p_units>maxunits then raise exception 'BARRACKS_CAPACITY';end if;
 if v.iron<p_units*18 or v.food<p_units*12 then raise exception 'NOT_ENOUGH_RESOURCES';end if;
 update public.bc_kingdom_villages set iron=iron-p_units*18,food=food-p_units*12,
 infantry=infantry+p_units where user_id=u;
 return jsonb_build_object('trained',p_units,'total',v.infantry+p_units);
end;$$;
revoke all on function public.bc_kingdom_train(integer) from public,anon;
grant execute on function public.bc_kingdom_train(integer) to authenticated;
create or replace function public.bc_kingdom_daily_mission()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;v public.bc_kingdom_villages%rowtype;today date;
begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 perform public.bc_kingdom_update_tick(u);
 today:=(now() at time zone 'Europe/Bucharest')::date;
 select * into v from public.bc_kingdom_villages where user_id=u for update;
 if v.last_mission=today then raise exception 'DAILY_MISSION_ALREADY_CLAIMED';end if;
 update public.bc_kingdom_villages set last_mission=today,
 wood=least(400+(coalesce((v.buildings->>'storage')::integer,1)-1)*150,wood+40),
 stone=least(400+(coalesce((v.buildings->>'storage')::integer,1)-1)*150,stone+40),
 food=least(400+(coalesce((v.buildings->>'storage')::integer,1)-1)*150,food+25)
 where user_id=u;
 return jsonb_build_object('completed',true,'virtual_supplies',true,'wood',40,'stone',40,'food',25);
end;$$;
revoke all on function public.bc_kingdom_daily_mission() from public,anon;
grant execute on function public.bc_kingdom_daily_mission() to authenticated;
