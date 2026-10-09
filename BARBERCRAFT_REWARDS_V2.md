# BARBERCRAFT — Loyalty + Passport QR + Bătălia Zonelor (Sprint 2)

## Delivered UI

- `passport.html`: personal Passport QR, verified check-in history, earned points vs **available** points, partner-filtered rewards, claim creation/cancel, one-time expiring QR, existing private photo/review log.
- `reward-redeem.html` via BARBERCRAFT PRO header: owner/manager partner opt-in per reward, staff validation for both reward QR and Passport check-in QR; optional camera scan with `BarcodeDetector`, manual code fallback; private, PII-minimized reward history.
- `admin.html`: existing rewards editor plus private request audit and new `Orașe & zone` editor (create/rename/show/hide).
- `territory-war.html`: dynamic city selector and publicly listed neighborhood directory. Non-Bucharest areas intentionally have **no scores or rewards** until enabled by a separate scoring rollout.

## SQL migrations applied to the BARBERCRAFT-connected project

- `20261009_barbercraft_rewards_redemption.sql`: `bc_reward_salon_offers`, `bc_reward_claims`, access-checked, transactional RPCs.
- `20261009_barbercraft_multi_city_zones.sql`: city/zone configuration (initial 6 cities, only zone drafts in Bucharest).
- `20261009_barbercraft_passport_checkin.sql`: identity QR codes and a separate check-in audit ledger.
- `20261009_barbercraft_rewards_audit.sql`: minimal-data redemption history for platform/salon staff.

## How reward claims work

1. **Platform admin** activates a template in Admin → Recompense.
2. **Salon owner/manager** opens PRO → Recompense & QR and opts in to the offer; only listed verified partner salons appear in client selection.
3. **Client** earns points only through `bc_tw_activity` written server-side after trusted completion. App never accepts user-entered XP.
4. **Client** opens Barber Passport, selects an available partner, and requests a reward. The server holds a transactional lock on the customer's wallet, checks total verified earned points minus active reservations/previous redemptions, locks the reward row for stock, and creates a pending claim valid for 7 days.
5. QR issuance rotates a random, hashed, **5-minute** token; no auth cookies, user IDs or private profile details are placed in the QR.
6. **Authenticated salon staff** checks the presented claim and marks the code redeemed once. The salon must match the claim. Replayed, expired, cancelled and mismatched tokens fail. Confirmation only records actual benefit fulfilment; it does not integrate with checkout or automatically discount a booking.
7. Client cancellation before redemption releases reserved points. Expiry also releases reserved points.

## Identity check-in is separate

- Client deliberately displays a **5-minute one-time Barber Passport QR** at the salon.
- Salon staff reads it and a server-side, access-controlled RPC records a check-in in a separate `bc_passport_checkins` audit table; repeat visits within an hour are deduplicated.
- This is only a confirmed presence/identity, **not proof of service completion**, and does not increase XP, convert reward points, or modify payment records.

## Security and deployment

- All sensitive tables have RLS with no direct client writes; functions check `auth.uid()` and role / salon membership.
- Admin reward and city modification RPCs validate platform-admin role.
- Browser only uses the Supabase publishable key. Token hashes are stored in PostgreSQL via `extensions.digest(...,'sha256')`, not in browser storage.
- No demo/reward transactions were inserted as production usage. `bc_tw_settings.enabled` remains **false** and no `bc_tw_activity` credit currently exists.
- Only **active rewards** and **opted-in listed salons** can receive requests.
- The Pages workflow publishes `main`; feature changes are submitted via PR.

## What still needs real-world QA / operational decisions

- Log in with an actual platform administrator and confirm editing a template/zone works.
- Log in with a real salon owner and opt in to at least one reward after testing partner consent and inventory.
- Use trusted server-side visit verification to generate legitimate points before exercising a claim; do not use mock XP.
- On two phones: issue QR from client's Passport and check in from authenticated salon staff; verify expiry and replay rejection.
- Confirm rewards inventory, eligibility terms, taxes, cancellation/disputes, customer support and staff training before offering benefits publicly.
- **No financial wallet or fiat conversion:** points are non-cash promotional loyalty units.
- Google Places full address autocomplete still needs a restricted Google Cloud browser API key, enabled billing and API quota. Location-based zone polygon assignment, city-wide scoring, checkout/receipt integration, automatic awards, full E2E authenticated testing and QR camera compatibility remain separate work.

## CI

`node tests/barbercraft-smoke.mjs`
`node tests/barbercraft-rewards-smoke.mjs`

These are syntax/wiring checks, not substitutes for signed-in mobile end-to-end testing.
