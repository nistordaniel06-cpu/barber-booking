# BARBERCRAFT — Salon OS, MERO import, WhatsApp

## Actual implementation

- A single mobile-first client UI. The bottom navigation includes `Salon` and the service picker has category tabs.
- A full-screen bottom sheet shows all 4MEN Lujerului services from its **public MERO profile**, with price and duration ranges.
- Owner dashboard **preview** provides module entry points, service counts and an import preview.
- The MERO importer validates the input public URL and only supports the verified `https://mero.ro/p/4men` demonstration. Other links receive an explicit 'adapter unavailable' message.
- Owner can export the verified preview as JSON for inspection. No unauthorized server scraper, private bookings, or client records are imported.
- PostgreSQL owner tables `bc_salons`, `bc_salon_members`, `bc_salon_services` and `bc_salon_integrations` deployed to Supabase Domn, isolated from the legacy booking tables. RLS restricts reads to authenticated members and service edits to owners/managers.

## 4MEN profile data source

Public page: https://mero.ro/p/4men

Sample services at time of review:
- SPALAT + TUNS + ARANJAT: 45–60 min, 80–100 lei.
- SPALAT + TUNS + BARBĂ + ARANJAT: 60 min, 100–120 lei.
- ARANJAT BARBA: 20–30 min, 40 lei.
- ARANJATUL SPRANCENELOR: 15 min, 30 lei.

Publicly listed staff: Nistor Daniel, Stefan Stinga, Ivan. Names and prices are a reviewable demo only. They can change on MERO.

## Next security and integration work

1. **Owner authentication and provisioning**: Supabase Auth OAuth/email sign-in; secure server-side verification that the person adding a salon owns it. Link `auth.users.id` to `bc_salon_members` using service role only. Never publicly expose an 'assign myself owner' route.
2. **Multi-salon booking**: migrate booking engine to include salon_id on services, barbers, bookings and availability; enforce tenant isolation on each read/write. Current API is for the original single test shop and must NOT be silently wired to 4MEN demo.
3. **MERO importer**: investigate official partner API/export and applicable authorization. Alternative owner-submitted CSV/JSON with column mapping and validation. Public profile snapshots require manual owner approval and must never imply availability synchronization.
4. **WhatsApp Cloud API**: register Meta business phone number, configure approved templates, consent and webhook signature verification. Save per-salon encrypted credentials server-side. Send reminders and allow conversation-based booking with state machine, availability and collision checks; never use wa.me prefill links as evidence of auto-send.
5. **Calendar**: Google Calendar OAuth per barber, ICS subscription and CalDAV where supported, avoiding double-booking.
6. **Admin features**: CRUD services/team/schedules, booking dashboard, WhatsApp settings, publication controls and audit log.
7. **Public booking safety**: rate limit, Turnstile/CAPTCHA, optional phone verification, and robust privacy/retention controls.
8. **Testing**: run actual UI integration, database RLS tests with users belonging to different salons, WhatsApp sandbox webhook tests, and import regression tests before enabling production.

No claims of completed WhatsApp messaging, generic MERO imports or live booking are made at this stage.
