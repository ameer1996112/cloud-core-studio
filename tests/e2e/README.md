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

Mutating E2E scripts are blocked unless all guardrails are explicit:

- `ALLOW_E2E_MUTATION=true`
- `APP_ENV=staging` or `APP_ENV=test`
- `SUPABASE_PROJECT_ID` / `VITE_SUPABASE_PROJECT_ID` must not be a known blocked project
- `VITE_SUPABASE_PROJECT_ID=local` is allowed only when `SUPABASE_URL` is localhost or `127.0.0.1`
- `SUPABASE_URL` is printed before any mutation runs

Known blocked project ids `banjmspemvzrqckajvwo` and `iuxxebonaamwpgiwqkeq` are hard-blocked.

```bash
APP_ENV=staging ALLOW_E2E_MUTATION=true node scripts/e2e-seed.mjs
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
APP_ENV=staging ALLOW_E2E_MUTATION=true node scripts/e2e-seed.mjs
APP_ENV=staging ALLOW_E2E_MUTATION=true node tests/e2e/rpc.spec.mjs
APP_ENV=staging ALLOW_E2E_MUTATION=true node tests/e2e/core_balance_slice.spec.mjs
APP_ENV=staging ALLOW_E2E_MUTATION=true node tests/e2e/payments_receipts.spec.mjs
node tests/e2e/playwright-routing.mjs   # route guard matrix, after seed
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
