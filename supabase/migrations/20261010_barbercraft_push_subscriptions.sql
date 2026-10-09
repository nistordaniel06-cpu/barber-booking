-- A verified Web Push subscription belongs to the JWT account that installed it.
-- Delivery is intentionally not started until a VAPID private key and trusted
-- server sender are configured. Never store browser Push credentials in logs.
create table if not exists public.bc_push_subscriptions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null,
 p256dh text not null,
 auth_secret text not null,
 created_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 unique(user_id,endpoint),
 check(length(endpoint) between 40 and 1200),
 check(endpoint ~ '^https://'),
 check(length(p256dh) between 30 and 180),
 check(length(auth_secret) between 10 and 150)
);
create index if not exists bc_push_subscriptions_user_idx on public.bc_push_subscriptions(user_id);
alter table public.bc_push_subscriptions enable row level security;
revoke all on public.bc_push_subscriptions from public,anon,authenticated;
create or replace function public.bc_push_save_subscription(p_subscription jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid:=(select auth.uid());endpoint text;p256dh text;auth_secret text;
begin
 if u is null then raise exception 'LOGIN_REQUIRED' using errcode='42501';end if;
 endpoint:=p_subscription->>'endpoint';
 p256dh:=p_subscription->'keys'->>'p256dh';
 auth_secret:=p_subscription->'keys'->>'auth';
 if endpoint is null or endpoint not like 'https://%' or length(endpoint)>1200
 or length(p256dh) not between 30 and 180
 or length(auth_secret) not between 10 and 150 then
  raise exception 'INVALID_PUSH_SUBSCRIPTION' using errcode='22023';
 end if;
 insert into public.bc_push_subscriptions(user_id,endpoint,p256dh,auth_secret)
 values(u,endpoint,p256dh,auth_secret)
 on conflict(user_id,endpoint) do update set p256dh=excluded.p256dh,auth_secret=excluded.auth_secret,last_seen_at=now();
 return jsonb_build_object('saved',true);
end $$;
create or replace function public.bc_push_delete_subscription(p_endpoint text)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 delete from public.bc_push_subscriptions where user_id=(select auth.uid()) and endpoint=p_endpoint;
 return found;
end $$;
revoke all on function public.bc_push_save_subscription(jsonb),
 public.bc_push_delete_subscription(text) from public,anon,authenticated;
grant execute on function public.bc_push_save_subscription(jsonb),
 public.bc_push_delete_subscription(text) to authenticated;
