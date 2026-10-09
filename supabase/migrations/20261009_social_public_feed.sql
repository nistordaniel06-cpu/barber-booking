-- BARBERCRAFT public opt-in community feed: reverse chronological, not follower-only.
-- Direct table writes are forbidden; profile public status checked on every operation.
create table if not exists public.bc_social_posts(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(length(trim(body)) between 3 and 1000),
 media_path text unique,
 created_at timestamptz not null default now()
);
create index if not exists bc_social_posts_latest on public.bc_social_posts(created_at desc,id desc);
create index if not exists bc_social_posts_author on public.bc_social_posts(user_id,created_at desc);
create table if not exists public.bc_social_post_reports(
 id uuid primary key default gen_random_uuid(),
 reporter uuid not null references auth.users(id) on delete cascade,
 post_id uuid not null references public.bc_social_posts(id) on delete cascade,
 reason text not null check(length(trim(reason)) between 10 and 350),
 created_at timestamptz not null default now(),
 unique(reporter,post_id)
);
alter table public.bc_social_posts enable row level security;
alter table public.bc_social_post_reports enable row level security;
revoke all on public.bc_social_posts from public,anon,authenticated;
revoke all on public.bc_social_post_reports from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bc-social-feed','bc-social-feed',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
drop policy if exists bc_social_feed_insert on storage.objects;
create policy bc_social_feed_insert on storage.objects for insert to authenticated
with check(bucket_id='bc-social-feed' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.bc_social_profiles p
 where p.user_id=(select auth.uid()) and p.is_public));
drop policy if exists bc_social_feed_delete on storage.objects;
create policy bc_social_feed_delete on storage.objects for delete to authenticated
using(bucket_id='bc-social-feed' and (storage.foldername(name))[1]=(select auth.uid())::text);

create or replace function public.bc_social_post_create(p_body text,p_path text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare u uuid;result uuid;
begin
 u:=(select auth.uid());
 if u is null or not exists(select 1 from public.bc_social_profiles p where p.user_id=u and p.is_public)
 then raise exception 'PUBLIC_PROFILE_REQUIRED';end if;
 if length(trim(coalesce(p_body,''))) not between 3 and 1000 then raise exception 'INVALID_CAPTION';end if;
 if (select count(*) from public.bc_social_posts where user_id=u and created_at>now()-interval '1 hour')>=5
 then raise exception 'POST_RATE_LIMIT';end if;
 if p_path is not null and (split_part(p_path,'/',1)<>u::text
 or not exists(select 1 from storage.objects where bucket_id='bc-social-feed' and name=p_path))
 then raise exception 'INVALID_MEDIA';end if;
 insert into public.bc_social_posts(user_id,body,media_path)
 values(u,trim(p_body),p_path) returning id into result;
 return result;
end;$$;
revoke all on function public.bc_social_post_create(text,text) from public,anon;
grant execute on function public.bc_social_post_create(text,text) to authenticated;

create or replace function public.bc_social_feed(p_before timestamptz default null,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare u uuid;
begin
 u:=(select auth.uid());
 return coalesce((select jsonb_agg(jsonb_build_object(
 'id',z.id,'author_id',z.user_id,'handle',z.handle,'author',z.display_name,'kind',
 case when public.bc_social_is_barber(z.user_id) then 'barber' else 'client' end,
 'body',z.body,'media_path',z.media_path,'created_at',z.created_at,'mine',z.user_id=u,
 'followed',exists(select 1 from public.bc_social_follows f where f.follower=u and f.followed=z.user_id))
 order by z.created_at desc,z.id desc)
 from (
 select x.id,x.user_id,x.body,x.media_path,x.created_at,p.display_name,p.handle
 from public.bc_social_posts x
 join public.bc_social_profiles p on p.user_id=x.user_id and p.is_public=true
 where (p_before is null or x.created_at<p_before)
 and not exists(select 1 from public.bc_social_blocks b
 where (b.blocker=u and b.blocked=x.user_id) or (b.blocker=x.user_id and b.blocked=u))
 order by x.created_at desc,x.id desc limit least(greatest(coalesce(p_limit,20),1),30)
 )z),'[]'::jsonb);
end;$$;
revoke all on function public.bc_social_feed(timestamptz,integer) from public;
grant execute on function public.bc_social_feed(timestamptz,integer) to anon,authenticated;

create or replace function public.bc_social_post_delete(p_post uuid)
returns text language plpgsql security definer set search_path=''
as $$declare path text;begin
 if (select auth.uid()) is null then raise exception 'LOGIN_REQUIRED';end if;
 delete from public.bc_social_posts where id=p_post and user_id=(select auth.uid())
 returning media_path into path;
 if not found then raise exception 'NOT_YOUR_POST';end if;
 return path;
end;$$;
revoke all on function public.bc_social_post_delete(uuid) from public,anon;
grant execute on function public.bc_social_post_delete(uuid) to authenticated;

create or replace function public.bc_social_post_report(p_post uuid,p_reason text)
returns boolean language plpgsql security definer set search_path=''
as $$declare u uuid;owner uuid;begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 select user_id into owner from public.bc_social_posts where id=p_post;
 if owner is null or owner=u then raise exception 'INVALID_REPORT';end if;
 if length(trim(coalesce(p_reason,''))) not between 10 and 350 then raise exception 'INVALID_REASON';end if;
 if (select count(*) from public.bc_social_post_reports where reporter=u and created_at>now()-interval '24 hours')>=5
 then raise exception 'REPORT_RATE_LIMIT';end if;
 insert into public.bc_social_post_reports(reporter,post_id,reason)values(u,p_post,trim(p_reason));
 return true;
end;$$;
revoke all on function public.bc_social_post_report(uuid,text) from public,anon;
grant execute on function public.bc_social_post_report(uuid,text) to authenticated;

-- Poll publishing was deliberately retired from the PRO interface.
revoke execute on function public.bc_barber_poll_create(text,jsonb,integer) from authenticated;
