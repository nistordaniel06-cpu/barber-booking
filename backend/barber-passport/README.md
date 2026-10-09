# Barber Passport — implementation notes

### Trusted sources
The existing `bc_service_visit_complete(p_checkin)` completes a salon-member-verified QR check-in, then inserts `bc_service_visits`. The new trigger awards **60 XP per verified visit**, atomically with quest progress, level-ups, and reward unlocks. Merely booking a calendar slot never grants XP. Verified reviews require a matching completed visit, and the Client avatar quest triggers on confirmed saved avatar.

### Levels and missions
20 individual levels. XP for level L → L+1: `100 + 50*(L-1) + 10*(L-1)^2`. See `xp-curve.ts`. Mission IDs:
- `first_verified_visit` — first confirmed visit, +80 XP
- `salon_loyalty_3` — third confirmed visit to the same salon, +120 XP
- `avatar_completed` — upload a Client avatar, +25 XP
- `review_verified` — verified review of a confirmed visit, +50 XP
- `visit_streak_3` — 3 visits with 14–45 day intervals, +150 XP

Quests reset each season; lifetime XP and levels never reset. Define the next season before the current one ends.

### Trust & idempotency
Client and PRO accounts cannot UPDATE the XP ledger, plan type or rewards tables. Every XP award uses an immutable UNIQUE event ledger and row-level locking. Level rewards unlock only after validated XP. A free account cannot unlock premium rewards. Premium is enabled **only after a verified payment webhook**, not by a user-facing toggle. Verified appointments alone are not finalized visits.

### What is not yet live
Punctuality and premium/VIP visit XP cannot be securely computed with current verified-visit fields. Require staff-confirmed booking timestamps, service tier and paid status before adding those. Cosmetic plans proposed: salon 15 RON/month, barber 8 RON/month, add-on barber 5 RON/month while an eligible salon plan is active. Plans, donations, payment processing, branded storefront and true generative AI require verified external services and are **not collecting payments** in this phase. A paid salon presentation badge must not imply independently verified identity.
