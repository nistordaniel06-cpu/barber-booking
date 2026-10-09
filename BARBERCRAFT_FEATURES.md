# BARBERCRAFT — Bătălia Zonelor, Recompense & Barber Passport

## What's included

- **Homepage:** calmer, booking-first copy, compact Bătălia Zonelor entry and Passport link.
- **Search:** accent-insensitive local catalog search, visible errors, city/county/zone selectors; only *listed* partner salons can be booked via BARBERCRAFT.
- **Location:** opt-in device GPS and optional Google Places Autocomplete (Romanian addresses), distinct from the partner catalogue. Selecting a Google place DOES NOT automatically onboard it as a partner or imply bookings are available there.
- **Competition:** renamed to Bătălia Zonelor; București is the only city with a linked engine. Cluj, Iași, Timișoara, Constanța and Brașov clearly show *în pregătire*. No fake leaderboard or earnings.
- **Barber Passport:** account-scoped XP, validated visits, loyalty, badges, pending awards, private personal review notes, and private photos (Supabase Storage signed URLs).
- **Admin → Recompense:** create/edit/toggle reward templates via admin-checked RPC; five proposed templates seeded as inactive.

## Configuration

1. GitHub Pages uses [`.github/workflows/pages.yml`](/.github/workflows/pages.yml) on `main`; merge the PR to publish the static UI.
2. The SQL migration `supabase/migrations/20261009_barbercraft_passport_rewards.sql` was applied to the Supabase project configured in `auth-config.js`. Don't run it against a different project without reviewing it.
3. For Google suggestions, create a Google Maps Platform project, enable **Maps JavaScript API** + **Places API (New)**, enable billing and set budget alerts. Restrict your **browser API key** to the actual GitHub Pages/custom-domain HTTPS referrers and the two APIs. Insert only the browser-restricted key in `maps-config.js`.
4. Geolocation requires HTTPS and explicit device permission. Without a Google key, manual salon search, city filters, Google's external map search and the rest of BARBERCRAFT still work. GPS coordinate detection works but reverse geocoding requires the Maps key.
5. Admin rewards are inactive by default, and changing `is_active` only displays a benefit as a proposed/participating offer. Actual redemption requires an audited claims ledger, eligible user points, stock, partner consent and payment verification. **Do not enable automated discounts without these controls.**

## Data ethics and identity

- Rank/XP are derived from existing server-verified `bc_tw_activity`, not browser clicks, reviews, nor submitted booking drafts.
- Existing pilot remains `bc_tw_settings.enabled=false`. Do not enable without backend rollout and published competition rules.
- Current `bc_appointments` and manually entered bookings are not yet securely linked to authenticated BARBERCRAFT client IDs. Do not import visit history using name/email matching; only verified activity appears in Passport.
- Photos use a private `bc-passport` bucket under `auth.uid()/...` paths, 5MB cap and expiring signed URLs. Personal notes are private and are **not** treated as publicly validated salon reviews.
- Users retain delete buttons for notes and uploaded photographs.

## Future additions (not claimed as implemented)

- Per-city/zone database modelling and verified location-to-zone assignment, dynamic rounds for all cities.
- Real checkout + auditable reward claim and point-debit transaction ledger.
- Verified booking identity linkage, salon review verification and consent-based profile photo sharing.
- Nearby ordering/distance (salon geocodes need verified coordinates) and a licensed Google Map with business attribution.
- Anti-fraud dashboards, balanced zone scoring and safe sponsor budgets.

## Smoke checks

Run `node tests/barbercraft-smoke.mjs` locally, or inspect **BARBERCRAFT feature checks** in the pull request checks.
