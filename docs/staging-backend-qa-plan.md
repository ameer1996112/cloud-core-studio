# Staging Backend QA Plan

Do not run mutating E2E scripts against Supabase project `banjmspemvzrqckajvwo`
or `iuxxebonaamwpgiwqkeq`.

Local docs identify `banjmspemvzrqckajvwo` as the backend used by the production
deployment path. A read-only classification audit found `iuxxebonaamwpgiwqkeq`
contains unrelated existing backend data, so it is not a Cloud & Core disposable
staging target.

## QA Status

- Frontend regression: PASS
- Build/typecheck: PASS
- Production project protected: PASS
- `iuxxebonaamwpgiwqkeq` safety audit: FAIL / unsafe
- Controlled dev database QA: PASS
- Mutating clean staging/release DB QA: BLOCKED
- Blocker: no confirmed disposable staging/release backend

## Controlled Dev Database QA

The current regular Supabase project `banjmspemvzrqckajvwo` was used temporarily
as a controlled development/QA database with explicit owner approval.

Rules applied:

- No destructive seed/reset scripts were run.
- No migrations were run.
- No truncates or table resets were run.
- No non-test data was deleted.
- New test data used `QA_TEST_` prefixes and test email patterns.

Result: controlled dev database QA completed.

This does not make the app production-release verified. Before public release,
create a clean staging or production database and rerun final migrations, RLS,
booking, payment, receipt, admin, member, and instructor QA there.

## Current Backend Classification

- `.env` points `SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PROJECT_ID`, `SUPABASE_URL`, and `VITE_SUPABASE_URL` at `banjmspemvzrqckajvwo`.
- `supabase/config.toml` uses `project_id = "banjmspemvzrqckajvwo"`.
- `docs/mobile-release-architecture.md` names `banjmspemvzrqckajvwo` as the backend for the production web/native deployment path.
- No `.env.local` was present in this checkout during inspection.
- No local `.lovable` env file was present in this checkout during inspection.

Conclusion: treat `banjmspemvzrqckajvwo` as production/protected unless the owner explicitly says it is disposable.

## Unsafe Project Classification

Project `iuxxebonaamwpgiwqkeq` must not be used for Cloud & Core staging.

Read-only audit evidence:

- It is not referenced by the local Cloud & Core env/docs/deploy config inspected.
- It has no auth users, storage buckets, or Edge Functions visible through read-only checks.
- It does have many existing non-Cloud & Core tables and row counts, including trading,
  optimizer, broker, risk, pipeline, document, and alert data.

Conclusion: treat `iuxxebonaamwpgiwqkeq` as an unrelated existing backend, not a
disposable staging/test backend.

## Preferred Staging Setup

1. Create a separate Supabase project for staging/testing.
2. Capture its project ref and keys.
3. Configure a staging-only env file outside production deploy secrets:

```bash
APP_ENV=staging
ALLOW_E2E_MUTATION=true
SUPABASE_PROJECT_ID="<staging-project-ref>"
SUPABASE_URL="https://<staging-project-ref>.supabase.co"
SUPABASE_PUBLISHABLE_KEY="<staging-publishable-key>"
SUPABASE_SERVICE_ROLE_KEY="<staging-service-role-key>"
VITE_SUPABASE_PROJECT_ID="<staging-project-ref>"
VITE_SUPABASE_URL="https://<staging-project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<staging-publishable-key>"
```

4. Link/apply migrations to staging only:

```bash
supabase link --project-ref "<staging-project-ref>"
supabase db push --dry-run
supabase db push
supabase migration list
```

5. Regenerate Supabase types if the project workflow requires it.

```bash
supabase gen types typescript --project-id "<staging-project-ref>" > src/integrations/supabase/types.ts
```

6. If deploying a Lovable/staging preview, configure the same staging values in that environment's secret manager/dashboard. Do not reuse production secrets.

## Local Supabase Alternative

If Docker/Supabase local dev is healthy, use local env values and `APP_ENV=test`.
The guard treats localhost Supabase URLs as project id `local`.

Required local E2E env:

```bash
APP_ENV=test
ALLOW_E2E_MUTATION=true
SUPABASE_PROJECT_ID=local
SUPABASE_URL="http://127.0.0.1:54321"
SUPABASE_PUBLISHABLE_KEY="<local-anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<local-service-role-key>"
VITE_SUPABASE_PROJECT_ID=local
VITE_SUPABASE_URL="http://127.0.0.1:54321"
VITE_SUPABASE_PUBLISHABLE_KEY="<local-anon-key>"
```

Do not commit the local env file.

## Guarded Mutating QA Commands

Run only after verifying the env file points at staging/test:

```bash
set -a
source .env.staging
set +a

node scripts/e2e-seed.mjs
node tests/e2e/core_balance_slice.spec.mjs
node tests/e2e/payments_receipts.spec.mjs
node tests/e2e/rpc.spec.mjs
```

Each mutating script prints the target Supabase URL and project id before running.
The scripts fail before mutation unless `ALLOW_E2E_MUTATION=true`,
`APP_ENV=staging|test`, and the project id is not `banjmspemvzrqckajvwo` or
`iuxxebonaamwpgiwqkeq`. `VITE_SUPABASE_PROJECT_ID=local` is accepted only when
the Supabase URL points to `localhost` or `127.0.0.1`.

## Manual Staging Verification

After automated suites pass on staging/test:

- Admin creates a class.
- Member books the class.
- Member credits decrease.
- Class capacity/booked count updates.
- Booking appears in member bookings.
- Booking appears in admin Studio Pulse.
- Booking appears in roster.
- Instructor sees roster without admin-only data exposure.
- Admin confirms payment.
- Receipt is issued.
- Member can view own receipt.
- Member cannot view another member's receipt.
- Attendance update persists.
- Hebrew, Arabic, English, RTL/LTR still work.

## Completion Criteria

Backend QA is not complete until all mutating E2E suites pass on an isolated
staging/test backend and the manual staging flow above passes.
