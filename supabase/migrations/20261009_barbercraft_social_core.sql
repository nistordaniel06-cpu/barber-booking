-- BARBERCRAFT Social Passport 2026-10 — server-authoritative relationships.
-- Public profiles are OPT-IN, messages are mutual-follow only, and verified reviews
-- require user-present QR check-in PLUS a separately attested finished service.
-- No XP is minted by reviews, chat, check-ins or professional work history.
create table if not exists public.bc_social_profiles(
 user_id uuid primary key references auth.users(id) on delete cascade,
 handle text not null unique check(handle ~ '^[a-z0-9_]{3,25}$'),
 display_name text not null check(length(display_name) between 2 and 70),
 bio text not null default '' check(length(bio)<=300),
 kind text not null default 'client' check(kind in ('client','barber')),
 is_public boolean not null default false,
 allow_messages boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.bc_social_follows(
 follower uuid not null references auth.users(id) on delete cascade,
 followed uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower,followed),check(follower<>followed)
);
create index if not exists bc_social_follows_followed on public.bc_social_follows(followed,created_at desc);
create table if not exists public.bc_social_blocks(
 blocker uuid not null references auth.users(id) on delete cascade,
 blocked uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(blocker,blocked), check(blocker<>blocked)
);
create table if not exists public.bc_social_messages(
 id uuid primary key default gen_random_uuid(),
 sender uuid not null references auth.users(id) on delete cascade,
 recipient uuid not null references auth.users(id) on delete cascade,
 body text not null check(length(trim(body)) between 1 and 1000),
 sent_at timestamptz not null default now(),check(sender<>recipient)
);
create index if not exists bc_social_messages_inbox on public.bc_social_messages(recipient,sent_at desc);
create index if not exists bc_social_messages_sent on public.bc_social_messages(sender,sent_at desc);
create table if not exists public.bc_service_visits(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 salon_id uuid not null references public.bc_salons(id),
 checkin_id uuid not null unique references public.bc_passport_checkins(id),
 verified_by uuid not null references auth.users(id),
 verified_at timestamptz not null default now(),
 verification_method text not null default 'qr_and_staff' check(verification_method='qr_and_staff')
);
create index if not exists bc_service_visits_member on public.bc_service_visits(user_id,salon_id,verified_at);
create table if not exists public.bc_verified_reviews(
 id uuid primary key default gen_random_uuid(),
 visit_id uuid not null unique references public.bc_service_visits(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 salon_id uuid not null references public.bc_salons(id),
 stars integer not null check(stars between 1 and 5),
 body text not null check(length(body) between 10 and 1000),
 created_at timestamptz not null default now()
);
create index if not exists bc_verified_reviews_salon on public.bc_verified_reviews(salon_id,created_at desc);
create table if not exists public.bc_barber_jobs(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 salon_name text not null check(length(trim(salon_name)) between 2 and 110),
 role_title text not null check(length(trim(role_title)) between 2 and 80),
 start_year integer not null check(start_year between 1950 and 2100),
 end_year integer check(end_year between start_year and 2100),
 created_at timestamptz not null default now()
);
create index if not exists bc_barber_jobs_owner on public.bc_barber_jobs(user_id,created_at desc);
create table if not exists public.bc_barber_portfolio(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 object_path text not null unique,
 caption text not null default '' check(length(caption)<=160),
 created_at timestamptz not null default now(),
 check(split_part(object_path,'/',1)=user_id::text)
);
create index if not exists bc_barber_portfolio_owner on public.bc_barber_portfolio(user_id,created_at desc);
create table if not exists public.bc_barber_polls(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(trim(title)) between 10 and 180),
 options jsonb not null,
 created_at timestamptz not null default now(),
 closes_at timestamptz not null,
 check(jsonb_typeof(options)='array' and jsonb_array_length(options) between 2 and 4)
);
create index if not exists bc_barber_polls_owner on public.bc_barber_polls(user_id,closes_at desc);
create table if not exists public.bc_barber_votes(
 poll_id uuid not null references public.bc_barber_polls(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 option_index integer not null check(option_index between 0 and 3),
 created_at timestamptz not null default now(),
 primary key(poll_id,user_id)
);
create table if not exists public.bc_salon_ideas(
 id uuid primary key default gen_random_uuid(),
 salon_id uuid not null references public.bc_salons(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(trim(title)) between 10 and 110),
 detail text not null check(length(trim(detail)) between 15 and 600),
 status text not null default 'proposed' check(status in ('proposed','considering','planned','done','declined')),
 created_at timestamptz not null default now()
);
create index if not exists bc_salon_ideas_salon on public.bc_salon_ideas(salon_id,created_at desc);
-- All public social access MUST go through restrictive RPCs, never direct table grants.
do $$declare t text;begin
 foreach t in array array['bc_social_profiles','bc_social_follows','bc_social_blocks','bc_social_messages',
  'bc_service_visits','bc_verified_reviews','bc_barber_jobs','bc_barber_portfolio',
  'bc_barber_polls','bc_barber_votes','bc_salon_ideas'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bc-barber-portfolio','bc-barber-portfolio',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
drop policy if exists bc_barber_portfolio_insert on storage.objects;
create policy bc_barber_portfolio_insert on storage.objects for insert to authenticated
with check(bucket_id='bc-barber-portfolio' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.bc_salon_members where user_id=(select auth.uid())));
drop policy if exists bc_barber_portfolio_delete on storage.objects;
create policy bc_barber_portfolio_delete on storage.objects for delete to authenticated
using(bucket_id='bc-barber-portfolio' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- No browser ability to rename itself as a verified professional.
create or replace function public.bc_social_is_barber(p_user uuid)
returns boolean language sql stable security definer set search_path=''
as $$select exists(select 1 from public.bc_salon_members where user_id=p_user)$$;
revoke all on function public.bc_social_is_barber(uuid) from public,anon;
grant execute on function public.bc_social_is_barber(uuid) to authenticated;
create or replace function public.bc_social_profile_save(
 p_handle text,p_name text,p_bio text,p_public boolean,p_messages boolean
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid; k text;
begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 if coalesce(p_handle,'') !~ '^[a-z0-9_]{3,25}$'
 or length(trim(coalesce(p_name,''))) not between 2 and 70
 or length(coalesce(p_bio,''))>300 then raise exception 'INVALID_PROFILE';end if;
 k:=case when public.bc_social_is_barber(u) then 'barber' else 'client' end;
 insert into public.bc_social_profiles(user_id,handle,display_name,bio,kind,is_public,allow_messages)
 values(u,p_handle,trim(p_name),trim(coalesce(p_bio,'')),k,coalesce(p_public,false),coalesce(p_messages,false))
 on conflict(user_id) do update set handle=excluded.handle,display_name=excluded.display_name,
 bio=excluded.bio,kind=excluded.kind,is_public=excluded.is_public,
 allow_messages=excluded.allow_messages,updated_at=now();
 return jsonb_build_object('saved',true,'kind',k);
end;$$;
revoke all on function public.bc_social_profile_save(text,text,text,boolean,boolean) from public,anon;
grant execute on function public.bc_social_profile_save(text,text,text,boolean,boolean) to authenticated;
create or replace function public.bc_social_profile_read(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare u uuid; p record;allowed boolean; mine boolean;
begin
 u:=(select auth.uid());
 select * into p from public.bc_social_profiles where user_id=p_user;
 if not found then return null;end if;
 mine:=u=p_user;allowed:=mine or (p.is_public and not exists(
 select 1 from public.bc_social_blocks where (blocker=u and blocked=p_user) or (blocker=p_user and blocked=u)));
 if not allowed then return null;end if;
 return jsonb_build_object('user_id',p.user_id,'handle',p.handle,'display_name',p.display_name,
 'bio',p.bio,'kind',case when public.bc_social_is_barber(p_user) then 'barber' else 'client' end,
 'is_public',p.is_public,'allow_messages',case when mine then p.allow_messages else null end,
 'followers',(select count(*) from public.bc_social_follows f where f.followed=p_user),
 'following',(select count(*) from public.bc_social_follows f where f.follower=p_user),
 'is_following',exists(select 1 from public.bc_social_follows where follower=u and followed=p_user),
 'follows_me',exists(select 1 from public.bc_social_follows where follower=p_user and followed=u),
 'is_me',mine,'message_allowed',u is not null and u<>p_user and p.allow_messages
 and exists(select 1 from public.bc_social_follows where follower=u and followed=p_user)
 and exists(select 1 from public.bc_social_follows where follower=p_user and followed=u)
 and exists(select 1 from public.bc_social_profiles where user_id=u and is_public and allow_messages));
end;$$;
revoke all on function public.bc_social_profile_read(uuid) from public;
grant execute on function public.bc_social_profile_read(uuid) to anon,authenticated;
create or replace function public.bc_social_discover(p_search text default '')
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare u uuid; needle text;
begin
 u:=(select auth.uid());needle:=lower(left(trim(coalesce(p_search,'')),60));
 return coalesce((select jsonb_agg(jsonb_build_object(
 'user_id',p.user_id,'handle',p.handle,'display_name',p.display_name,
 'kind',case when public.bc_social_is_barber(p.user_id) then 'barber' else 'client' end,
 'followers',(select count(*) from public.bc_social_follows f where f.followed=p.user_id)) order by p.display_name)
 from (select * from public.bc_social_profiles p where is_public=true and user_id<>coalesce(u,'00000000-0000-0000-0000-000000000000'::uuid)
 and (needle='' or p.handle ilike '%'||needle||'%' or p.display_name ilike '%'||needle||'%')
 and not exists(select 1 from public.bc_social_blocks b where
 (b.blocker=u and b.blocked=p.user_id) or(b.blocker=p.user_id and b.blocked=u))
 order by p.created_at desc limit 35)p),'[]'::jsonb);
end;$$;
revoke all on function public.bc_social_discover(text) from public;
grant execute on function public.bc_social_discover(text) to anon,authenticated;
create or replace function public.bc_social_follow_set(p_target uuid,p_follow boolean)
returns boolean language plpgsql security definer set search_path=''
as $$
declare u uuid;
begin
 u:=(select auth.uid());
 if u is null or u=p_target then raise exception 'INVALID_FOLLOW';end if;
 if coalesce(p_follow,false) then
 if not exists(select 1 from public.bc_social_profiles where user_id=p_target and is_public)
 or not exists(select 1 from public.bc_social_profiles where user_id=u and is_public)
 or exists(select 1 from public.bc_social_blocks where (blocker=u and blocked=p_target)
 or (blocker=p_target and blocked=u)) then raise exception 'PROFILE_NOT_AVAILABLE';end if;
 insert into public.bc_social_follows(follower,followed) values(u,p_target) on conflict do nothing;
 else delete from public.bc_social_follows where follower=u and followed=p_target;end if;
 return true;
end;$$;
revoke all on function public.bc_social_follow_set(uuid,boolean) from public,anon;
grant execute on function public.bc_social_follow_set(uuid,boolean) to authenticated;
create or replace function public.bc_social_block_set(p_target uuid,p_block boolean)
returns boolean language plpgsql security definer set search_path=''
as $$declare u uuid;begin
 u:=(select auth.uid());if u is null or u=p_target then raise exception 'INVALID_BLOCK';end if;
 if coalesce(p_block,false) then
 insert into public.bc_social_blocks(blocker,blocked) values(u,p_target) on conflict do nothing;
 delete from public.bc_social_follows where (follower=u and followed=p_target) or(follower=p_target and followed=u);
 else delete from public.bc_social_blocks where blocker=u and blocked=p_target;end if;
 return true;end;$$;
revoke all on function public.bc_social_block_set(uuid,boolean) from public,anon;
grant execute on function public.bc_social_block_set(uuid,boolean) to authenticated;
create or replace function public.bc_social_can_message(p_from uuid,p_to uuid)
returns boolean language sql stable security definer set search_path=''
as $$
select p_from is not null and p_to is not null and p_from<>p_to
and (select count(*) from public.bc_social_profiles where user_id in (p_from,p_to) and is_public and allow_messages)=2
and exists(select 1 from public.bc_social_follows where follower=p_from and followed=p_to)
and exists(select 1 from public.bc_social_follows where follower=p_to and followed=p_from)
and not exists(select 1 from public.bc_social_blocks where
(blocker=p_from and blocked=p_to) or(blocker=p_to and blocked=p_from))
$$;
revoke all on function public.bc_social_can_message(uuid,uuid) from public,anon;
grant execute on function public.bc_social_can_message(uuid,uuid) to authenticated;
create or replace function public.bc_social_message_send(p_to uuid,p_body text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare u uuid;mid uuid;
begin
 u:=(select auth.uid());
 if not public.bc_social_can_message(u,p_to) then raise exception 'MUTUAL_FOLLOW_REQUIRED';end if;
 if length(trim(coalesce(p_body,''))) not between 1 and 1000 then raise exception 'INVALID_MESSAGE';end if;
 if (select count(*) from public.bc_social_messages where sender=u and sent_at>now()-interval '1 minute')>=12
 then raise exception 'RATE_LIMITED';end if;
 insert into public.bc_social_messages(sender,recipient,body) values(u,p_to,trim(p_body)) returning id into mid;
 return mid;
end;$$;
revoke all on function public.bc_social_message_send(uuid,text) from public,anon;
grant execute on function public.bc_social_message_send(uuid,text) to authenticated;
create or replace function public.bc_social_conversation(p_with uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$declare u uuid;begin
 u:=(select auth.uid());if not public.bc_social_can_message(u,p_with) then raise exception 'MUTUAL_FOLLOW_REQUIRED';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('mine',m.sender=u,'body',m.body,'at',m.sent_at) order by m.sent_at)
 from (select sender,body,sent_at from public.bc_social_messages
 where (sender=u and recipient=p_with) or (sender=p_with and recipient=u)
 order by sent_at desc limit 60)m),'[]'::jsonb);
end;$$;
revoke all on function public.bc_social_conversation(uuid) from public,anon;
grant execute on function public.bc_social_conversation(uuid) to authenticated;
