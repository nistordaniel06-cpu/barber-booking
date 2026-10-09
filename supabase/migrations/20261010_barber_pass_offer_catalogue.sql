-- Explicit price catalogue; payment collection is NOT enabled until a
-- trusted payment-provider webhook is connected and tested.
create table if not exists public.bc_barber_pass_offers(
 offer_code text primary key,
 display_name text not null,
 audience text not null check(audience in('salon','barber','barber_addon')),
 amount_minor integer not null check(amount_minor>=0),
 currency char(3) not null default 'RON',
 billing_interval text not null default 'month' check(billing_interval='month'),
 checkout_enabled boolean not null default false,
 description text not null
);
insert into public.bc_barber_pass_offers(offer_code,display_name,audience,amount_minor,description)
values
('salon_pass_15','Barber Pass · Salon','salon',1500,'Stil vizual salon, profil premium, vitrină de produse după integrare'),
('barber_pass_8','Barber Pass · Barber','barber',800,'Nume colorat, badge decorativ, motto de maximum 25 caractere'),
('barber_addon_5','Barber Pass · Barber cu salon activ','barber_addon',500,'Aceleași decorațiuni, exclusiv cât un salon cu abonament este activ')
on conflict(offer_code) do nothing;
create table if not exists public.bc_barber_pass_memberships(
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 salon_id uuid references public.bc_salons(id),
 offer_code text not null references public.bc_barber_pass_offers(offer_code),
 status text not null default 'pending' check(status in('pending','active','expired','cancelled')),
 started_at timestamptz,
 valid_until timestamptz,
 provider_subscription_id text unique,
 verified_at timestamptz,
 created_at timestamptz not null default now(),
 check(status <> 'active' or (verified_at is not null and started_at is not null and valid_until>now()-interval '200 years'))
);
create index if not exists bc_barber_pass_active_idx on public.bc_barber_pass_memberships(owner_user_id,status,valid_until);
create table if not exists public.bc_barber_pass_style(
 user_id uuid primary key references auth.users(id) on delete cascade,
 name_color text not null default '#FFD36B' check(name_color ~ '^#[A-Fa-f0-9]{6}$'),
 motto text check(char_length(motto)<=25),
 motto_effect text not null default 'none' check(motto_effect in('none','pulse')),
 updated_at timestamptz not null default now()
);
create table if not exists public.bc_passport_cosmetic_catalog(
 item_code text primary key,
 label text not null,
 amount_minor integer not null check(amount_minor>=0),
 item_kind text not null check(item_kind in('passport_photo_frame','nickname_color','motto','badge')),
 checkout_enabled boolean not null default false,
 details jsonb not null default '{}'::jsonb
);
insert into public.bc_passport_cosmetic_catalog(item_code,label,amount_minor,item_kind,details)
values
('passport_frame_gold','Ramă foto aurie Barber Passport',300,'passport_photo_frame','{"color":"gold"}'),
('nickname_accent','Accent colorat pentru numele Client',200,'nickname_color','{}'),
('client_motto','Motto Client (25 caractere)',200,'motto','{}'),
('scissors_badge','Insignă decorativă foarfecă',150,'badge','{"icon":"✂"}')
on conflict(item_code) do nothing;
create or replace function public.bc_barber_pass_price_quote(p_offer text)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v record;u uuid:=(select auth.uid());
begin
 select * into v from public.bc_barber_pass_offers where offer_code=p_offer;
 if not found then raise exception 'PLAN_NOT_FOUND' using errcode='22023';end if;
 return jsonb_build_object('offer_code',v.offer_code,'amount_minor',v.amount_minor,
  'currency',v.currency,'interval',v.billing_interval,'checkout_enabled',v.checkout_enabled,
  'note','No checkout is enabled; payment must be processed by a trusted provider.');
end $$;
-- Future subscription webhook must call privileged DB code after verifying
-- PSP signature, paid invoice amount, currency, interval and reference.
alter table public.bc_barber_pass_offers enable row level security;
alter table public.bc_barber_pass_memberships enable row level security;
alter table public.bc_barber_pass_style enable row level security;
alter table public.bc_passport_cosmetic_catalog enable row level security;
revoke all on public.bc_barber_pass_offers,public.bc_barber_pass_memberships,
 public.bc_barber_pass_style,public.bc_passport_cosmetic_catalog from public,anon,authenticated;
revoke all on function public.bc_barber_pass_price_quote(text) from public,anon;
grant execute on function public.bc_barber_pass_price_quote(text) to authenticated;
