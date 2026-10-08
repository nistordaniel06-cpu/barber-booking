-- WhatsApp sandbox integration: tenant-routed phone IDs, no personal phone automation.
create table if not exists public.bc_whatsapp_channels (
 id uuid primary key default gen_random_uuid(),
 salon_id uuid not null references public.bc_salons(id) on delete cascade,
 meta_phone_number_id text not null unique,
 display_phone_number text,
 mode text not null default 'sandbox' check(mode in ('sandbox','production')),
 enabled boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.bc_whatsapp_webhook_events (
 id bigint generated always as identity primary key,
 channel_id uuid not null references public.bc_whatsapp_channels(id) on delete cascade,
 meta_message_id text not null unique,
 sender_phone text not null,
 message_type text not null,
 text_body text,
 received_at timestamptz not null default now()
);
create index if not exists bc_wa_events_channel_created on public.bc_whatsapp_webhook_events(channel_id,received_at desc);
alter table public.bc_whatsapp_channels enable row level security;
alter table public.bc_whatsapp_webhook_events enable row level security;
revoke all on public.bc_whatsapp_channels, public.bc_whatsapp_webhook_events from anon;
grant select on public.bc_whatsapp_channels, public.bc_whatsapp_webhook_events to authenticated;
create policy bc_wa_channels_admin_read on public.bc_whatsapp_channels for select to authenticated using(public.bc_is_salon_admin(salon_id));
create policy bc_wa_events_admin_read on public.bc_whatsapp_webhook_events for select to authenticated using(
 exists (select 1 from public.bc_whatsapp_channels c where c.id=channel_id and public.bc_is_salon_admin(c.salon_id))
);
-- Provisioning requires a secure, authenticated backend flow. No browser writes.
