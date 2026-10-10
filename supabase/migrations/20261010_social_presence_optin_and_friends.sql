-- Public Online indicator is opt-in and short-lived. Never expose a person's
-- session location, phone, email or raw last_seen timestamp.
create table if not exists public.bc_social_presence(
 user_id uuid primary key references auth.users(id) on delete cascade,
 share_online boolean not null default false,
 last_seen timestamptz not null default now()
);
alter table public.bc_social_presence enable row level security;
revoke all on public.bc_social_presence from public,anon,authenticated;

create or replace function public.bc_social_presence_ping(p_share boolean default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid());sharing boolean;
begin
 if u is null then raise exception 'LOGIN_REQUIRED' using errcode='42501';end if;
 if not exists(select 1 from public.bc_social_profiles where user_id=u and is_public=true) then
  return jsonb_build_object('share_online',false,'online',false);
 end if;
 -- Do not change an existing preference on heartbeat.
 insert into public.bc_social_presence(user_id,share_online,last_seen)
 values(u,coalesce(p_share,false),now())
 on conflict(user_id) do update set
  last_seen=now(),
  share_online=coalesce(p_share,public.bc_social_presence.share_online);
 select share_online into sharing from public.bc_social_presence where user_id=u;
 return jsonb_build_object('share_online',sharing,'online',sharing);
end $$;

create or replace function public.bc_social_online_for(p_users uuid[])
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if coalesce(array_length(p_users,1),0)>100 then raise exception 'TOO_MANY_PROFILES';end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object('user_id',x.uid,'online',
    exists(select 1 from public.bc_social_presence s
      join public.bc_social_profiles p on p.user_id=s.user_id and p.is_public
      where s.user_id=x.uid and s.share_online is true and s.last_seen>now()-interval '120 seconds'
    )))
  from (select distinct unnest(p_users) uid) x
 ),'[]'::jsonb);
end $$;

create or replace function public.bc_social_friends_list()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=(select auth.uid());
begin
 if u is null then raise exception 'LOGIN_REQUIRED' using errcode='42501';end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object('user_id',p.user_id,'name',p.display_name,
   'handle',p.handle,'kind',case when public.bc_social_is_barber(p.user_id) then 'barber' else 'client' end,
   'online',coalesce(s.share_online,false) and s.last_seen>now()-interval '120 seconds',
   'can_message',public.bc_social_can_message(u,p.user_id)) order by
      (coalesce(s.share_online,false) and s.last_seen>now()-interval '120 seconds') desc,p.display_name)
  from public.bc_social_profiles p
  join public.bc_social_follows a on a.followed=p.user_id and a.follower=u
  join public.bc_social_follows b on b.follower=p.user_id and b.followed=u
  left join public.bc_social_presence s on s.user_id=p.user_id
  where p.is_public=true
  and not exists(select 1 from public.bc_social_blocks block
    where (block.blocker=u and block.blocked=p.user_id)
       or (block.blocker=p.user_id and block.blocked=u))
 ),'[]'::jsonb);
end $$;

revoke all on function public.bc_social_presence_ping(boolean) from public,anon;
revoke all on function public.bc_social_online_for(uuid[]) from public,anon;
revoke all on function public.bc_social_friends_list() from public,anon;
grant execute on function public.bc_social_presence_ping(boolean) to authenticated;
grant execute on function public.bc_social_online_for(uuid[]) to authenticated,anon;
grant execute on function public.bc_social_friends_list() to authenticated;
