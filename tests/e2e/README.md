# E2E Test Matrix — Cloud & Core

Two layers, both runnable from this sandbox:

1. **`rpc.spec.mjs`** — integration tests that hit the database RPCs as each role
   (admin / member / instructor) using real Supabase JWTs. Exercises booking,
   waitlist, credits, cancellation, RLS boundaries, and admin roster reflection.
   This is where the safety guarantees live, so it's the highest-signal test.

2. **`playwright-routing.mjs`** — headless Chromium covering:
   - signed-out `/admin` → `/auth`
   - admin/member/instructor land on the right home
   - member blocked from every admin URL
   - legacy redirects (`/schedule`, `/bookings`, `/plans`, `/admin/planner`,
     `/admin/templates`)

## Seed

```bash
node scripts/e2e-seed.mjs
```

Idempotent. Creates 4 users (password `E2ePass!23`):

| email                       | role                                        |
| --------------------------- | ------------------------------------------- |
| `e2e_admin@test.local`      | admin                                       |
| `e2e_instructor@test.local` | instructor                                  |
| `e2e_member@test.local`     | member (10 credits)                         |
| `e2e_member2@test.local`    | member (10 credits, seeded into Full Class) |

Plus a room, two plans (`E2E 10 Credits`, `E2E Unlimited`) and three classes
(`E2E Open Class`, `E2E Full Class`, `E2E Imminent Class`).

## Run

```bash
node scripts/e2e-seed.mjs           # always reseed first
node tests/e2e/rpc.spec.mjs         # integration matrix
node tests/e2e/playwright-routing.mjs   # route guard matrix
```

Each script exits non-zero on failure and prints `PASS`/`FAIL` per case.

## Deferred / manual cases

The following are listed in the QA checklist but are exercised in `rpc.spec.mjs`
at the data layer rather than the UI layer (UI for these flows is wired to
the same RPCs, so the safety contract holds):

- mark-attendance kiosk UI
- WhatsApp contact-studio CTA when cancellation window passed (link generation
  only — actual WhatsApp deep link cannot be auto-clicked)
- Stripe checkout (out of scope for this slice)
