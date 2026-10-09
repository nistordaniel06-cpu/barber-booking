-- Strategy module phase 2: per-sector alliances and deterministic PvE expeditions.
-- No real-money value, no XP or real-loyalty point mutation.
create table if not exists public.bc_kingdom_alliances(
 sector smallint primary key check(sector between 1 and 6),
 wood integer not null default 0 check(wood>=0),
 stone integer not null default 0 check(stone>=0),
 fortress_level integer not null default 1 check(fortress_level between 1 and 10),
 updated_at timestamptz not null default now()
);
insert into public.bc_kingdom_alliances(sector)select generate_series(1,6) on conflict do nothing;
create table if not exists public.bc_kingdom_donations(
 user_id uuid not null references auth.users(id) on delete cascade,
 donation_day date not null, sector smallint not null references public.bc_kingdom_alliances(sector),
 wood integer not null default 20,stone integer not null default 20,
 primary key(user_id,donation_day)
);
create table if not exists public.bc_kingdom_expeditions(
 user_id uuid not null references auth.users(id) on delete cascade,
 expedition_day date not null,target_sector smallint not null check(target_sector between 1 and 6),
 strength integer not null,reward_iron integer not null,
 primary key(user_id,expedition_day)
);
do $$declare t text;begin
 foreach t in array array['bc_kingdom_alliances','bc_kingdom_donations','bc_kingdom_expeditions']loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end$$;
create or replace function public.bc_kingdom_alliance_state()
returns jsonb language plpgsql stable security definer set search_path=''
as $$declare u uuid;sec smallint;begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 select home_sector into sec from public.bc_tw_memberships where user_id=u;
 return jsonb_build_object('sector',sec,
 'alliances',coalesce((select jsonb_agg(jsonb_build_object('sector',a.sector,
 'wood',a.wood,'stone',a.stone,'fortress',a.fortress_level)order by a.sector)
 from public.bc_kingdom_alliances a),'[]'::jsonb),
 'donated_today',exists(select 1 from public.bc_kingdom_donations where user_id=u
 and donation_day=(now() at time zone 'Europe/Bucharest')::date),
 'expedition_today',exists(select 1 from public.bc_kingdom_expeditions where user_id=u
 and expedition_day=(now() at time zone 'Europe/Bucharest')::date));
end;$$;
revoke all on function public.bc_kingdom_alliance_state() from public,anon;
grant execute on function public.bc_kingdom_alliance_state() to authenticated;
create or replace function public.bc_kingdom_alliance_donate()
returns jsonb language plpgsql security definer set search_path=''
as $$declare u uuid;sec smallint;v public.bc_kingdom_villages%rowtype;day date;
begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 day:=(now() at time zone 'Europe/Bucharest')::date;
 select home_sector into sec from public.bc_tw_memberships where user_id=u;
 if sec is null then raise exception 'CHOOSE_SECTOR_FIRST';end if;
 perform public.bc_kingdom_update_tick(u);
 select * into v from public.bc_kingdom_villages where user_id=u for update;
 if v.wood<20 or v.stone<20 then raise exception 'NOT_ENOUGH_RESOURCES';end if;
 insert into public.bc_kingdom_donations(user_id,donation_day,sector)values(u,day,sec);
 update public.bc_kingdom_villages set wood=wood-20,stone=stone-20 where user_id=u;
 update public.bc_kingdom_alliances set wood=wood+20,stone=stone+20,updated_at=now() where sector=sec;
 return jsonb_build_object('donated',true,'sector',sec,'wood',20,'stone',20);
end;$$;
revoke all on function public.bc_kingdom_alliance_donate() from public,anon;
grant execute on function public.bc_kingdom_alliance_donate() to authenticated;
create or replace function public.bc_kingdom_alliance_upgrade()
returns jsonb language plpgsql security definer set search_path=''
as $$declare u uuid;sec smallint;a public.bc_kingdom_alliances%rowtype;cost integer;
begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 select home_sector into sec from public.bc_tw_memberships where user_id=u;
 if sec is null then raise exception 'CHOOSE_SECTOR_FIRST';end if;
 select * into a from public.bc_kingdom_alliances where sector=sec for update;
 if a.fortress_level>=10 then raise exception 'MAX_LEVEL';end if;
 cost:=200*a.fortress_level;
 if a.wood<cost or a.stone<cost then raise exception 'NOT_ENOUGH_ALLIANCE_RESOURCES';end if;
 update public.bc_kingdom_alliances set wood=wood-cost,stone=stone-cost,
 fortress_level=fortress_level+1,updated_at=now() where sector=sec;
 return jsonb_build_object('fortress',a.fortress_level+1,'spent_per_resource',cost);
end;$$;
revoke all on function public.bc_kingdom_alliance_upgrade() from public,anon;
grant execute on function public.bc_kingdom_alliance_upgrade() to authenticated;
create or replace function public.bc_kingdom_expedition(p_target smallint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;v public.bc_kingdom_villages%rowtype;day date;strength integer;cap integer;reward integer;
begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 if p_target not between 1 and 6 then raise exception 'INVALID_TARGET';end if;
 day:=(now() at time zone 'Europe/Bucharest')::date;
 perform public.bc_kingdom_update_tick(u);
 select * into v from public.bc_kingdom_villages where user_id=u for update;
 strength:=v.infantry+coalesce((v.buildings->>'wall')::integer,1);
 if strength<p_target+2 then raise exception 'INSUFFICIENT_SCOUT_FORCE';end if;
 if v.food<15 then raise exception 'NOT_ENOUGH_FOOD';end if;
 cap:=400+(coalesce((v.buildings->>'storage')::integer,1)-1)*150;
 reward:=20+p_target*5;
 insert into public.bc_kingdom_expeditions(user_id,expedition_day,target_sector,strength,reward_iron)
 values(u,day,p_target,strength,reward);
 update public.bc_kingdom_villages set food=food-15,iron=least(cap,iron+reward) where user_id=u;
 return jsonb_build_object('success',true,'target_sector',p_target,'virtual_iron',reward,'no_player_damage',true);
end;$$;
revoke all on function public.bc_kingdom_expedition(smallint) from public,anon;
grant execute on function public.bc_kingdom_expedition(smallint) to authenticated;
