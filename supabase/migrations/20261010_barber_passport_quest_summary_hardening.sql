-- Barber Passport hardening: quest progress aggregates per salon for the
-- client dashboard and avatar XP requires an actual Client-owned object.
create or replace function public.bc_passport_avatar_completed()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.avatar_path is null or new.avatar_path='' or
    (tg_op='UPDATE' and old.avatar_path is not distinct from new.avatar_path) then
  return new;
 end if;
 if new.avatar_path !~* ('^'||new.user_id::text||'/[0-9a-f-]{36}[.](jpg|png|webp)$') then
  return new;
 end if;
 if not exists(
  select 1 from storage.objects o where o.bucket_id='bc-client-avatars'
  and o.name=new.avatar_path
 ) then
  return new;
 end if;
 if not exists(select 1 from public.bc_portal_accounts c where c.user_id=new.user_id and c.portal='client') then
  return new;
 end if;
 perform public.bc_passport_progress(new.user_id,'avatar_completed',new.user_id);
 return new;
end $$;

create or replace function public.bc_passport_my_progress()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare u uuid:=(select auth.uid());result jsonb;active_season uuid;
begin
 if u is null or not coalesce((public.bc_portal_access('client')->>'allowed')::boolean,false)
 then raise exception 'CLIENT_PORTAL_REQUIRED' using errcode='42501';end if;
 select id into active_season from public.bc_passport_seasons
 where now()>=starts_at and now()<ends_at
 order by starts_at desc limit 1;
 select jsonb_build_object(
  'xp_client',coalesce(c.xp_client,0),
  'nivel_passport',coalesce(c.nivel_passport,1),
  'tip_passport',coalesce(c.tip_passport,'free'),
  'season',coalesce((select title from public.bc_passport_seasons where id=active_season),'În pregătire'),
  'next_level_xp',public.bc_passport_xp_next(coalesce(c.nivel_passport,1)),
  'streak',coalesce(c.streak_days,0),
  'quests',coalesce((select jsonb_agg(jsonb_build_object(
    'id',q.quest_id,'title',q.title,'description',q.description,
    'target',q.target_count,'progress',coalesce(p.progress,0),
    'bonus_xp',q.bonus_xp,'completed',p.completed_at is not null
   ) order by q.quest_id)
   from public.bc_passport_quests q
   left join lateral(
    select p2.progress,p2.completed_at
    from public.bc_passport_quest_progress p2
    where p2.user_id=u and p2.quest_id=q.quest_id and p2.season_id=active_season
    order by (p2.completed_at is not null) desc,p2.progress desc limit 1
   )p on true
   where q.active),'[]'::jsonb),
  'rewards',coalesce((select jsonb_agg(jsonb_build_object(
    'id',r.reward_id,'title',r.title,'kind',r.reward_kind,
    'tier',r.tier,'unlocked_at',r2.unlocked_at
   ) order by r.min_level)
   from public.bc_passport_unlocked_rewards r2
   join public.bc_passport_reward_definitions r on r.reward_id=r2.reward_id
   where r2.user_id=u),'[]'::jsonb)
 ) into result
 from (select u user_id) me
 left join public.bc_passport_clients c on c.user_id=me.user_id;
 return result;
end $$;
revoke all on function public.bc_passport_my_progress() from public,anon;
grant execute on function public.bc_passport_my_progress() to authenticated;
