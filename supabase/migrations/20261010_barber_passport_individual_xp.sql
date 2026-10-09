-- BARBERCRAFT / Barber Passport. Only staff-verified service visits, verified
-- reviews and client avatar completion may generate XP. No browser-provided XP.
-- These tables are independent from the legacy Territory War subsystem.
create table if not exists public.bc_passport_seasons(
 id uuid primary key default gen_random_uuid(),
 slug text unique not null,
 title text not null,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 check (ends_at>starts_at)
);
insert into public.bc_passport_seasons(slug,title,starts_at,ends_at)
values('barber-passport-2026-autumn','Barber Passport · Sezonul 1','2026-10-01T00:00:00+03','2027-01-01T00:00:00+02')
on conflict(slug) do nothing;

create table if not exists public.bc_passport_clients(
 user_id uuid primary key references auth.users(id) on delete cascade,
 xp_client bigint not null default 0 check(xp_client>=0),
 nivel_passport smallint not null default 1 check(nivel_passport between 1 and 20),
 tip_passport text not null default 'free' check(tip_passport in ('free','premium')),
 streak_days smallint not null default 0 check(streak_days>=0),
 last_verified_visit_at timestamptz,
 updated_at timestamptz not null default now()
);
create table if not exists public.bc_passport_quests(
 quest_id text primary key,
 title text not null,
 description text not null,
 trigger_event text not null check(trigger_event in ('visit_verified','avatar_completed','review_verified')),
 target_count integer not null check(target_count>0),
 bonus_xp integer not null check(bonus_xp>=0),
 per_salon boolean not null default false,
 active boolean not null default true
);
insert into public.bc_passport_quests(quest_id,title,description,trigger_event,target_count,bonus_xp,per_salon)
values
 ('first_verified_visit','Prima vizită','Prima vizită confirmată de salon','visit_verified',1,80,false),
 ('salon_loyalty_3','Client fidel','Trei vizite verificate la același salon','visit_verified',3,120,true),
 ('avatar_completed','Identitate completă','Adaugă o fotografie la avatar','avatar_completed',1,25,false),
 ('review_verified','Părerea ta contează','Lasă o recenzie pentru o vizită verificată','review_verified',1,50,false),
 ('visit_streak_3','Ritmul tău','Trei vizite consecutive la 14–45 de zile','visit_verified',3,150,false)
on conflict(quest_id) do nothing;
create table if not exists public.bc_passport_quest_progress(
 user_id uuid not null references auth.users(id) on delete cascade,
 season_id uuid not null references public.bc_passport_seasons(id),
 quest_id text not null references public.bc_passport_quests(quest_id),
 scope_key text not null default 'all',
 progress integer not null default 0 check(progress>=0),
 completed_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(user_id,season_id,quest_id,scope_key)
);
create table if not exists public.bc_passport_xp_ledger(
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 season_id uuid references public.bc_passport_seasons(id),
 event_key text not null,
 source_id uuid not null,
 xp integer not null check(xp>=0 and xp<=500),
 created_at timestamptz not null default now(),
 unique(user_id,event_key,source_id)
);
create index if not exists bc_passport_xp_ledger_client_idx
 on public.bc_passport_xp_ledger(user_id,created_at desc);

create table if not exists public.bc_passport_reward_definitions(
 reward_id text primary key,
 min_level smallint not null check(min_level between 2 and 20),
 tier text not null check(tier in('free','premium')),
 title text not null,
 reward_kind text not null check(reward_kind in('badge','cosmetic','voucher','service')),
 details jsonb not null default '{}'::jsonb,
 active boolean not null default true
);
insert into public.bc_passport_reward_definitions(reward_id,min_level,tier,title,reward_kind,details)
values
 ('level_2_free_badge',2,'free','Badge: Primul progres','badge','{"icon":"✂"}'),
 ('level_5_free_frame',5,'free','Ramă Barber Passport','cosmetic','{"frame":"bronze"}'),
 ('level_10_free_badge',10,'free','Badge: Client fidel','badge','{"icon":"★"}'),
 ('level_3_premium_name',3,'premium','Culoare personalizată nume','cosmetic','{"choice":"name_color"}'),
 ('level_8_premium_passport',8,'premium','Ramă premium pentru poză','cosmetic','{"frame":"gold"}'),
 ('level_15_premium_badge',15,'premium','Însemn Barber Passport Premium','badge','{"icon":"♛"}')
on conflict(reward_id) do nothing;
create table if not exists public.bc_passport_unlocked_rewards(
 user_id uuid not null references auth.users(id) on delete cascade,
 reward_id text not null references public.bc_passport_reward_definitions(reward_id),
 unlocked_at timestamptz not null default now(),
 redeemed_at timestamptz,
 primary key(user_id,reward_id)
);

-- Incremental XP necessary to advance FROM level L TO L+1, L=1..19.
create or replace function public.bc_passport_xp_next(p_level integer)
returns integer language sql immutable set search_path=''
as $$select case when p_level between 1 and 19
 then 100+50*(p_level-1)+10*(p_level-1)*(p_level-1) else null end$$;
create or replace function public.bc_passport_level(p_xp bigint)
returns integer language plpgsql immutable set search_path=''
as $$
declare lvl integer:=1;remaining bigint:=greatest(0,coalesce(p_xp,0));
begin
 while lvl<20 and remaining>=public.bc_passport_xp_next(lvl) loop
  remaining:=remaining-public.bc_passport_xp_next(lvl);
  lvl:=lvl+1;
 end loop;
 return lvl;
end $$;

-- Internal event award: called from trusted database triggers only. The UNIQUE
-- ledger key makes retries idempotent; a user-row lock serializes level ups.
create or replace function public.bc_passport_award(
 p_client uuid,p_key text,p_source uuid,p_xp integer)
returns boolean language plpgsql security definer set search_path=''
as $$
declare season uuid;old_level integer;next_level integer;was_inserted bigint;
begin
 if p_client is null or p_source is null or p_key is null or
    p_key not in ('visit_base','quest:first_verified_visit','quest:salon_loyalty_3',
      'quest:avatar_completed','quest:review_verified','quest:visit_streak_3') or
    p_xp<1 or p_xp>500 then
  raise exception 'INVALID_PASSPORT_EVENT' using errcode='22023';
 end if;
 if not exists(select 1 from public.bc_portal_accounts where user_id=p_client and portal='client') then
  return false;
 end if;
 select id into season from public.bc_passport_seasons
 where now()>=starts_at and now()<ends_at
 order by starts_at desc limit 1;
 if season is null then return false;end if;
 insert into public.bc_passport_clients(user_id)values(p_client) on conflict do nothing;
 select nivel_passport into old_level from public.bc_passport_clients
 where user_id=p_client for update;
 insert into public.bc_passport_xp_ledger(user_id,season_id,event_key,source_id,xp)
 values(p_client,season,p_key,p_source,p_xp)
 on conflict(user_id,event_key,source_id) do nothing
 returning id into was_inserted;
 if was_inserted is null then return false;end if;
 update public.bc_passport_clients
 set xp_client=xp_client+p_xp,
     nivel_passport=public.bc_passport_level(xp_client+p_xp),
     updated_at=now()
 where user_id=p_client returning nivel_passport into next_level;
 if next_level>old_level then
  insert into public.bc_passport_unlocked_rewards(user_id,reward_id)
  select p_client,r.reward_id from public.bc_passport_reward_definitions r
  join public.bc_passport_clients c on c.user_id=p_client
  where r.active and r.min_level>old_level and r.min_level<=next_level
   and (r.tier='free' or c.tip_passport='premium')
  on conflict do nothing;
 end if;
 return true;
end $$;

create or replace function public.bc_passport_progress(
 p_client uuid,p_quest text,p_source uuid,p_scope text default 'all',p_override integer default null)
returns void language plpgsql security definer set search_path=''
as $$
declare active_season uuid;quest record;done_at timestamptz;counted integer;awarded boolean;
begin
 select id into active_season from public.bc_passport_seasons where now()>=starts_at and now()<ends_at
 order by starts_at desc limit 1;
 if active_season is null then return;end if;
 select * into quest from public.bc_passport_quests where quest_id=p_quest and active;
 if not found then return;end if;
 insert into public.bc_passport_quest_progress(user_id,season_id,quest_id,scope_key,progress)
 values(p_client,active_season,p_quest,p_scope,least(quest.target_count,coalesce(p_override,1)))
 on conflict(user_id,season_id,quest_id,scope_key)
 do update set progress=least(quest.target_count,greatest(0,coalesce(p_override,public.bc_passport_quest_progress.progress+1))),
 updated_at=now()
 returning progress,completed_at into counted,done_at;
 if counted>=quest.target_count and done_at is null then
  update public.bc_passport_quest_progress set completed_at=now()
   where user_id=p_client and season_id=active_season and quest_id=p_quest and scope_key=p_scope
   and completed_at is null;
  awarded:=public.bc_passport_award(p_client,'quest:'||p_quest,p_source,quest.bonus_xp);
 end if;
end $$;

-- The source of truth is bc_service_visits (staff-confirmed QR service), not a
-- merely reserved calendar slot and not a client-supplied completed flag.
create or replace function public.bc_passport_visit_verified()
returns trigger language plpgsql security definer set search_path=''
as $$
declare previous_visit timestamptz;old_streak integer:=0;gap_days numeric;new_streak integer;
begin
 if not exists(select 1 from public.bc_portal_accounts where user_id=new.user_id and portal='client') then
  return new;
 end if;
 if not public.bc_passport_award(new.user_id,'visit_base',new.id,60) then return new;end if;
 perform public.bc_passport_progress(new.user_id,'first_verified_visit',new.id);
 perform public.bc_passport_progress(new.user_id,'salon_loyalty_3',new.id,new.salon_id::text);
 select last_verified_visit_at,streak_days into previous_visit,old_streak
 from public.bc_passport_clients where user_id=new.user_id for update;
 if previous_visit is null then new_streak:=1;
 elsif new.verified_at<=previous_visit then new_streak:=old_streak;
 else
  gap_days:=extract(epoch from (new.verified_at-previous_visit))/86400.0;
  if gap_days>=14 and gap_days<=45 then new_streak:=least(3,old_streak+1);
  else new_streak:=1;end if;
 end if;
 if previous_visit is null or new.verified_at>previous_visit then
  update public.bc_passport_clients set streak_days=new_streak,
   last_verified_visit_at=new.verified_at where user_id=new.user_id;
 end if;
 perform public.bc_passport_progress(new.user_id,'visit_streak_3',new.id,'all',new_streak);
 return new;
end $$;
drop trigger if exists bc_passport_verified_visit_trigger on public.bc_service_visits;
create trigger bc_passport_verified_visit_trigger after insert on public.bc_service_visits
for each row execute function public.bc_passport_visit_verified();

create or replace function public.bc_passport_review_verified()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 -- Foreign-key trust alone is not enough: tie verified review to same client.
 if exists(select 1 from public.bc_service_visits v where v.id=new.visit_id and v.user_id=new.user_id) then
  perform public.bc_passport_progress(new.user_id,'review_verified',new.id);
 end if;
 return new;
end $$;
drop trigger if exists bc_passport_verified_review_trigger on public.bc_verified_reviews;
create trigger bc_passport_verified_review_trigger after insert on public.bc_verified_reviews
for each row execute function public.bc_passport_review_verified();

create or replace function public.bc_passport_avatar_completed()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.avatar_path is not null and new.avatar_path<>'' and
    (tg_op='INSERT' or old.avatar_path is distinct from new.avatar_path) then
   perform public.bc_passport_progress(new.user_id,'avatar_completed',new.user_id);
 end if;
 return new;
end $$;
drop trigger if exists bc_passport_client_avatar_trigger on public.bc_profiles;
create trigger bc_passport_client_avatar_trigger
after insert or update of avatar_path on public.bc_profiles
for each row execute function public.bc_passport_avatar_completed();

-- Dashboard returns only authenticated client's own progress, never arbitrary IDs.
create or replace function public.bc_passport_my_progress()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare u uuid:=(select auth.uid());result jsonb;
begin
 if u is null or not coalesce((public.bc_portal_access('client')->>'allowed')::boolean,false)
 then raise exception 'CLIENT_PORTAL_REQUIRED' using errcode='42501';end if;
 select jsonb_build_object(
  'xp_client',coalesce(c.xp_client,0),
  'nivel_passport',coalesce(c.nivel_passport,1),
  'tip_passport',coalesce(c.tip_passport,'free'),
  'next_level_xp',public.bc_passport_xp_next(coalesce(c.nivel_passport,1)),
  'streak',coalesce(c.streak_days,0),
  'quests',coalesce((select jsonb_agg(jsonb_build_object('id',q.quest_id,'title',q.title,
   'description',q.description,'target',q.target_count,'progress',coalesce(p.progress,0),
   'bonus_xp',q.bonus_xp,'completed',p.completed_at is not null) order by q.quest_id)
   from public.bc_passport_quests q
   left join public.bc_passport_quest_progress p
   on p.user_id=u and p.quest_id=q.quest_id and p.scope_key='all'
    and p.season_id=(select id from public.bc_passport_seasons where now()>=starts_at and now()<ends_at order by starts_at desc limit 1)
   where q.active),'[]'::jsonb),
  'rewards',coalesce((select jsonb_agg(jsonb_build_object('id',r.reward_id,'title',r.title,'kind',r.reward_kind,
   'tier',r.tier,'unlocked_at',r2.unlocked_at) order by r.min_level)
   from public.bc_passport_unlocked_rewards r2 join public.bc_passport_reward_definitions r on r.reward_id=r2.reward_id
   where r2.user_id=u),'[]'::jsonb)
 ) into result
 from (select u user_id) me
 left join public.bc_passport_clients c on c.user_id=me.user_id;
 return result;
end $$;

-- Strong deny-by-default: data changes happen exclusively through definer
-- triggers and a future verified payment webhook, never direct client UPDATE.
alter table public.bc_passport_clients enable row level security;
alter table public.bc_passport_seasons enable row level security;
alter table public.bc_passport_quests enable row level security;
alter table public.bc_passport_quest_progress enable row level security;
alter table public.bc_passport_xp_ledger enable row level security;
alter table public.bc_passport_reward_definitions enable row level security;
alter table public.bc_passport_unlocked_rewards enable row level security;
revoke all on public.bc_passport_clients,public.bc_passport_seasons,public.bc_passport_quests,
 public.bc_passport_quest_progress,public.bc_passport_xp_ledger,
 public.bc_passport_reward_definitions,public.bc_passport_unlocked_rewards
 from public,anon,authenticated;
revoke all on function public.bc_passport_award(uuid,text,uuid,integer),
 public.bc_passport_progress(uuid,text,uuid,text,integer) from public,anon,authenticated;
revoke all on function public.bc_passport_xp_next(integer),
 public.bc_passport_level(bigint) from public,anon;
grant execute on function public.bc_passport_xp_next(integer),
 public.bc_passport_level(bigint),public.bc_passport_my_progress() to authenticated;
revoke all on function public.bc_passport_my_progress() from public,anon;
