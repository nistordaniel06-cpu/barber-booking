-- Client anti-spam upload ledger survives post deletion.
create table if not exists public.bc_social_client_post_log(
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 posted_at timestamptz not null default now()
);
create index if not exists bc_social_client_post_log_user_time
 on public.bc_social_client_post_log(user_id,posted_at desc);
alter table public.bc_social_client_post_log enable row level security;
revoke all on public.bc_social_client_post_log from public,anon,authenticated;
insert into public.bc_social_client_post_log(id,user_id,posted_at)
select id,user_id,created_at from public.bc_social_posts p
where not public.bc_social_is_barber(p.user_id)
on conflict(id) do nothing;

-- Feed anti-spam applies only to client identities; professionals retain their existing 5/hour limit.
-- All enforcement lives server-side and is serialized per author.
create or replace function public.bc_social_post_cooldown()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare u uuid; last_at timestamptz; count_daily integer; next_at timestamptz;
begin
 u:=(select auth.uid());
 if u is null then return jsonb_build_object('allowed',false,'reason','LOGIN_REQUIRED');end if;
 if public.bc_social_is_barber(u) then
  return jsonb_build_object('allowed',true,'pro',true,'wait_seconds',0);
 end if;
 select max(posted_at) into last_at from public.bc_social_client_post_log where user_id=u;
 select count(*) into count_daily from public.bc_social_client_post_log
  where user_id=u and posted_at>now()-interval '24 hours';
 next_at:=last_at+interval '15 minutes';
 if count_daily>=6 then
  select greatest(coalesce(next_at,now()),coalesce(min(posted_at)+interval '24 hours',now()))
   into next_at from public.bc_social_client_post_log where user_id=u
   and posted_at>now()-interval '24 hours';
 end if;
 return jsonb_build_object('allowed',count_daily<6 and (next_at is null or next_at<=now()),
  'reason',case when count_daily>=6 then 'CLIENT_DAILY_POST_LIMIT'
    when next_at>now() then 'CLIENT_POST_COOLDOWN' else 'OK' end,
  'wait_seconds',case when next_at>now() then ceil(extract(epoch from next_at-now()))::integer else 0 end,
  'next_at',next_at,'used_today',count_daily,'daily_limit',6,'pro',false);
end;$$;
revoke all on function public.bc_social_post_cooldown() from public,anon;
grant execute on function public.bc_social_post_cooldown() to authenticated;

create or replace function public.bc_social_post_create(p_body text,p_path text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare u uuid;result uuid;latest_at timestamptz;
begin
 u:=(select auth.uid());
 if u is null or not exists(select 1 from public.bc_social_profiles p where p.user_id=u and p.is_public)
 then raise exception 'PUBLIC_PROFILE_REQUIRED';end if;
 if length(trim(coalesce(p_body,''))) not between 3 and 1000 then raise exception 'INVALID_CAPTION';end if;
 perform pg_advisory_xact_lock(hashtextextended('bc-social-author:'||u::text,0));
 if public.bc_social_is_barber(u) then
  if (select count(*) from public.bc_social_posts where user_id=u and created_at>now()-interval '1 hour')>=5
  then raise exception 'POST_RATE_LIMIT';end if;
 else
  select max(posted_at) into latest_at from public.bc_social_client_post_log where user_id=u;
  if latest_at is not null and latest_at>now()-interval '15 minutes'
  then raise exception 'CLIENT_POST_COOLDOWN';end if;
  if (select count(*) from public.bc_social_client_post_log where user_id=u and posted_at>now()-interval '24 hours')>=6
  then raise exception 'CLIENT_DAILY_POST_LIMIT';end if;
 end if;
 if p_path is not null and (
  split_part(p_path,'/',1)<>u::text or
  not exists(select 1 from storage.objects where bucket_id='bc-social-feed' and name=p_path))
 then raise exception 'INVALID_MEDIA';end if;
 insert into public.bc_social_posts(user_id,body,media_path)
 values(u,trim(p_body),p_path) returning id into result;
 if not public.bc_social_is_barber(u) then
  insert into public.bc_social_client_post_log(id,user_id,posted_at) values(result,u,now());
 end if;
 return result;
end;$$;
revoke all on function public.bc_social_post_create(text,text) from public,anon;
grant execute on function public.bc_social_post_create(text,text) to authenticated;
