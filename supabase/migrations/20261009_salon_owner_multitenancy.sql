-- BARBERCRAFT owner control plane, isolated from legacy bc_* booking tables and Amanet.
create table if not exists public.bc_salons (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check (slug ~ '^[a-z0-9-]{3,70}$'),
 name text not null, address text not null default '',
 source_url text, created_at timestamptz not null default now()
);
create table if not exists public.bc_salon_members (
 salon_id uuid not null references public.bc_salons(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','manager','staff')),
 primary key (salon_id,user_id)
);
create table if not exists public.bc_salon_services (
 id uuid primary key default gen_random_uuid(),
 salon_id uuid not null references public.bc_salons(id) on delete cascade,
 external_source text,
 external_id text,
 category text not null default 'Altele',
 name text not null check (length(trim(name)) >= 2),
 price_min integer check (price_min >= 0),
 price_max integer check (price_max >= 0),
 duration_min integer not null check (duration_min between 5 and 360),
 duration_max integer not null check (duration_max between 5 and 360),
 enabled boolean not null default true,
 created_at timestamptz not null default now(),
 constraint bc_valid_service_range check (price_min is null or price_max is null or price_min <= price_max),
 constraint bc_valid_duration_range check(duration_min <= duration_max)
);
create unique index if not exists bc_external_service_unique
 on public.bc_salon_services(salon_id,external_source,external_id) where external_id is not null;
create table if not exists public.bc_salon_integrations (
 salon_id uuid not null references public.bc_salons(id) on delete cascade,
 provider text not null check(provider in ('whatsapp','google_calendar','apple_calendar','mero_import')),
 state text not null default 'not_connected' check(state in ('not_connected','pending','connected','error')),
 last_sync_at timestamptz,
 primary key(salon_id,provider)
);
alter table public.bc_salons enable row level security;
alter table public.bc_salon_members enable row level security;
alter table public.bc_salon_services enable row level security;
alter table public.bc_salon_integrations enable row level security;
-- Lock down all owner views by default, then grant only owner/member-specific access.
revoke all on public.bc_salons, public.bc_salon_members, public.bc_salon_services, public.bc_salon_integrations from anon;
grant select on public.bc_salons, public.bc_salon_members, public.bc_salon_services, public.bc_salon_integrations to authenticated;
grant insert,update,delete on public.bc_salon_services to authenticated;
create or replace function public.bc_is_salon_member(p_salon uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.bc_salon_members m where m.salon_id=p_salon and m.user_id=(select auth.uid()))
$$;
revoke all on function public.bc_is_salon_member(uuid) from public,anon;
grant execute on function public.bc_is_salon_member(uuid) to authenticated,service_role;
create or replace function public.bc_is_salon_admin(p_salon uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.bc_salon_members m where m.salon_id=p_salon and m.user_id=(select auth.uid()) and m.role in ('owner','manager'))
$$;
revoke all on function public.bc_is_salon_admin(uuid) from public,anon;
grant execute on function public.bc_is_salon_admin(uuid) to authenticated,service_role;
create policy bc_member_view_salon on public.bc_salons for select to authenticated using (public.bc_is_salon_member(id));
create policy bc_member_view_team on public.bc_salon_members for select to authenticated using(public.bc_is_salon_member(salon_id));
create policy bc_member_view_services on public.bc_salon_services for select to authenticated using(public.bc_is_salon_member(salon_id));
create policy bc_owner_edit_services on public.bc_salon_services for all to authenticated
using(public.bc_is_salon_admin(salon_id)) with check(public.bc_is_salon_admin(salon_id));
create policy bc_admin_view_integrations on public.bc_salon_integrations for select to authenticated using(public.bc_is_salon_admin(salon_id));
-- Provisioning of first owner is service-role-only and must confirm ownership out of band.
