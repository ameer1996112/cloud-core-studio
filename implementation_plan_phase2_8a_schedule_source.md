# Phase 2.8A implementation plan — secure GoldMine schedule source

## Discovery

- API framework: TanStack Start file routes served by the existing Node/Bun Cloud Run image.
- Endpoint path: `GET /internal/goldmine/v1/schedule`.
- Authoritative data: `public.classes` joined to `public.program_types`.
- Capacity evidence: an aggregate of `public.bookings` rows whose status is exactly `booked`, matching the application booking/cancellation functions. Waitlist rows and payment rows are not queried.
- Visibility/status: customer-facing classes are `classes.member_visible = true`, `classes.status = 'scheduled'`, and their program type is active and includes the `adults` audience.
- Cancellation/deletion: cancellation sets `classes.status = 'cancelled'`; archival uses `archived`; hard deletion is allowed only when no dependent history exists.
- Private/internal representation: there is no separate private flag. `member_visible = false` is the authoritative non-public boundary. Returned rows therefore set `private=false` only after that filter succeeds.
- Kids representation: the committed kids program has slug `kids-aerial-yoga` and `age_groups=['kids']`; public source rows require the exact `adults` audience.
- Source timestamps: `classes.starts_at` is `timestamptz`; end time is `starts_at + duration_minutes`. PostgreSQL and the endpoint normalize them to UTC RFC3339 values.
- `classes.updated_at` does not exist. No column will be added. `source_revision` is a deterministic SHA-256 over normalized public session state.
- Existing internal automation authentication is a shared bearer secret and is not suitable for this endpoint. This endpoint will verify Google-signed OIDC ID tokens itself.
- Existing public schedule reads remain unchanged.

## Exact read-only join and filters

The database read model will select only safe class/program fields and an aggregated count:

```text
classes c
JOIN program_types pt ON pt.id = c.program_type_id
LEFT JOIN aggregate(count(bookings) WHERE status = 'booked') ON class_id = c.id
WHERE c.starts_at >= start_at AND c.starts_at < end_at
  AND c.status = 'scheduled'
  AND c.member_visible = true
  AND pt.active = true
  AND pt.age_groups contains 'adults'
ORDER BY c.starts_at, c.id
LIMIT configured_limit + 1
```

The extra row detects overflow and is never returned. The SQL function is `STABLE`, `SECURITY INVOKER`, has a statement timeout, is executable only by `service_role`, and does not select booking IDs or member fields.

## Class mapping

Mappings are exact identifier matches only. Committed source identifiers discovered locally:

- `aerial-yoga` → `aerial_adults`
- `mat-pilates` → `mat_pilates`

No committed HOT Pilates source slug was found. Staging must set `GOLDMINE_SCHEDULE_PROGRAM_MAP_JSON` with the exact staging `program_types.slug` after read-only inspection. Feature enablement fails closed unless all three canonical classes have an explicit exact-slug mapping. Unknown adult program slugs are excluded and counted only in safe structured telemetry.

## Authentication

- Header: `Authorization: Bearer <Google OIDC identity token>`.
- Verification: Google certificate/signature verification plus issuer, expiry, audience, `email_verified`, and caller-email checks.
- Configuration:
  - `GOLDMINE_SCHEDULE_SOURCE_ENABLED=false` by default.
  - `GOLDMINE_SCHEDULE_SOURCE_AUDIENCE` is required when enabled.
  - `GOLDMINE_SCHEDULE_ALLOWED_CALLERS` is required and empty means deny all.
- Allowed staging caller: `goldmine-schedule-pub-stg@cloudandcorestudio.iam.gserviceaccount.com`.
- Missing/invalid tokens return 401; valid but disallowed identities return 403; a disabled endpoint returns 404.
- Authorization headers and complete token claims are never logged.

## Response contract

The response contains only `generated_at`, `window_start`, `window_end`, `source_revision`, and normalized sessions. A session contains:

`external_session_id`, `class_type`, `starts_at`, `ends_at`, `status`, `published`, `private`, `audience`, `booking_enabled`, `capacity`, `confirmed_booking_count`, `remaining_capacity`.

There are no names, contacts, member IDs, booking IDs, payment fields, notes, instructor data, or raw rows. `remaining_capacity = max(capacity - confirmed_booking_count, 0)`; null/unreliable capacity remains null.

## Validation and operational limits

- Required timezone-aware RFC3339 `start_at` and `end_at`; sessions that have already started at execution time remain excluded even if a past window is requested.
- `end_at > start_at`; maximum duration 14 days.
- Optional strict canonical `class_type` enum.
- Configured query timeout, maximum session count, and maximum serialized response bytes.
- Safe request IDs and structured logs contain only request ID, allowlisted caller, window duration, session/unmapped counts, revision prefix, status, and latency.

## Files

Create:

- `src/lib/goldmineScheduleSource.server.ts`
- `src/routes/internal/goldmine/v1/schedule.ts`
- `supabase/migrations/20260819190000_goldmine_schedule_source.sql`
- `tests/unit/goldmineScheduleSource.test.ts`
- `tests/unit/goldmineScheduleSourceMigration.test.mjs`
- `tests/unit/goldmineScheduleSourceCloudRun.test.mjs`
- `scripts/configure-phase2-8a-schedule-source-staging.sh`
- `scripts/run-phase2-8a-schedule-source-acceptance.sh`

Modify:

- `package.json` and `bun.lock` for the official Google token verifier.
- `.env.staging.example` to document safe non-secret configuration.
- generated route metadata only through the normal build generator.

The existing staging Cloud Build remains unchanged and therefore deploys the endpoint disabled. The dedicated configuration script enables only the already-deployed staging revision after the migration and exact mapping are verified.

## Test seams

The user-specified seams are treated as pre-agreed: the HTTP handler, its normalized public response, the read-only migration contract, and staging deployment guard. External OIDC verification and database RPC access are injected system boundaries. Tests cover authentication, query validation, filtering, capacity, revision stability, response/log privacy, SQL grants/read-only aggregation, and deployment defaults.

Baseline: `bun run test` = 587 passed, 3 skipped, 0 failed across 103 files. `bun run lint` = 0 errors and 745 pre-existing warnings. Plain unscoped `bun test` correctly stopped at the E2E mutation guard and performed no mutation.

## Staging deployment and acceptance

Read-only preflight on 2026-08-19 found the `cloud-core-studio-staging` service and confirmed its configured Supabase project differs from the two protected project references documented by this repository. The local Supabase CLI link does not point to that staging project, and the required `goldmine-schedule-pub-stg` service account did not exist at that time. No migration, service deployment, IAM mutation, or endpoint enablement was attempted.

1. Apply the new migration only to the confirmed non-production Supabase project.
2. Build an immutable staging image.
3. Update only `cloud-core-studio-staging` with the feature enabled, exact staging audience, exact allowed caller, and complete exact program map.
4. Grant `roles/run.invoker` on the staging Cloud Run service only to the publisher service account; do not grant project Owner/Editor and do not create a key.
5. Mint an OIDC token through workload identity/ADC and run the acceptance script.
6. Verify anonymous/wrong-caller rejection, filtered schedule/capacity, stable revision, changed revision after an approved staging-only edit, and safe logs.
7. Only after that evidence, point the GoldMine staging HTTP adapter to this endpoint and run validate-only and dry-run.

## Rollback and stop conditions

- Immediate kill switch: set `GOLDMINE_SCHEDULE_SOURCE_ENABLED=false` on the staging service and deploy a new revision.
- Revoke the publisher's service-level `roles/run.invoker` binding if caller access must be removed.
- Roll back application traffic to the previous staging revision; the read-only SQL function may remain because it is service-role-only and has no mutation path.
- Production remains disabled and unconfigured until explicit owner approval.
- Stop before staging deployment if a distinct staging Supabase project, Cloud Run deploy authority, exact HOT Pilates identifier, or service-account impersonation permission is unavailable.
