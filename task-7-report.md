# Task 7 — Full Verification and Test-Only Rollout Report

Last updated: 2026-07-26

Implementation base: `7e1c36d1231d1860333d03805edcd003454d8c15`

Branch: `codex/concierge-live-readiness`

## Decision

**NO-GO. Keep every Concierge journey `test_only`; do not promote any journey to `live`.**

The final code-review blockers have been addressed locally, but code readiness is not production
delivery evidence. This correction pass did not apply a database migration, deploy a revision,
write provider templates, send a message, move traffic, or change a journey mode.

The operational blockers remain:

1. The last authorized production-edge check returned `404 text/html` for
   `https://cloudandcorestudio.com/brand/concierge-whatsapp-header.webp`, not `200 image/webp`.
2. The existing zero-traffic `concierge-e2e` tag also returned `404` for the branded header and
   did not identify the corrected source commit.
3. The last authorized production configuration check found the exact branded From identity but
   no `MESSAGING_EMAIL_REPLY_TO`; the email adapter must continue to fail closed.
4. No Supabase-version disposable `MESSAGING_TEST_DATABASE_URL`, provider credentials/approval
   rows, delivery receipts, or mailbox access were available. A local PostgreSQL 14 compatibility
   harness parsed/applied the final migration and passed the invalid-shape integration case, but it
   does not replace the full Supabase-version suite.
5. No linked migration dry run or push was authorized.
6. No exact-commit zero-traffic deployment was authorized.

## Test-only safety status

- No external mutation was performed during the final-fixes pass.
- The new migration file is not applied anywhere by this work.
- Initial live delivery selections remain v1; test-only selections use v2 only where a complete
  candidate exists.
- Payment and recommendation WhatsApp reachability is gated to `test_only`.
- The previous read-only production check reported
  `CONCIERGE_LIVE_DELIVERY_ENABLED=false`, allowlist delivery, and a configured test recipient
  list; this pass did not re-query or change production configuration.
- No row-level automation mode was changed.

## Corrected local readiness

- Provider IMAGE-header handles are excluded from canonical hashes, so local catalog, Meta
  reconciliation, runtime evidence, and SQL candidate hashes can match exactly.
- The expand-only migration seeds the 15 missing WhatsApp source variants without inventing
  approval provenance, adds immutable v1/v2 candidates and append-only mode selections, retains a
  bounded legacy RPC adapter, and backfills already-queued positional payloads.
- Runtime rendering is selection-bound and single-pass. Email content marked final is not rendered
  again; WhatsApp requires exact WABA/name/locale/`APPROVED`/hash evidence.
- Both materialization RPC entry points reject SQL `NULL`, JSON `null`, objects, and empty arrays.
- Legacy official-WhatsApp post-dispatch uncertainty is persisted as `delivery_unknown` and is not
  blindly retried.
- Admin preview shows candidate, current test-only selection, and current live selection. Rollback
  is an authenticated append-only selection guarded by exact confirmation text.
- Runtime journey facts come from canonical member, class, payment, and allowlisted event data.
- Provisioning plan mode performs authenticated read-only Meta reconciliation when credentials are
  available, has an explicit `--local-only` fallback, accepts private apply handles only from a
  protected environment/file or explicit stdin, and rejects handle values in argv.
- Sender configuration and documentation require the exact `Cloud & Core Studio <…>` From identity
  and a monitored Reply-To.

## Command-by-command evidence

| Command/check | Result |
| --- | --- |
| `git rev-parse HEAD` before fixes | PASS. Required implementation base: `7e1c36d1231d1860333d03805edcd003454d8c15`. |
| `bun install` | PASS. Bun 1.3.12 checked 524 installs / 595 packages; no dependency changes. |
| Focused final-fix unit suites | PASS. Canonical hash, selection, rendering, materialization, real facts, legacy ambiguity, provisioning CLI, and migration parity cases pass. |
| `bun test tests/unit tests/integration` | PASS: 357 passed, 3 database-backed cases skipped, 0 failed, 3,012 expectations. The skips are gated by the absent Supabase-version disposable `MESSAGING_TEST_DATABASE_URL`. |
| `bun run lint` | PASS with zero errors and 727 repository-baseline warnings. |
| `bun run build` | PASS. Vite client and SSR production builds completed; existing non-fatal warnings remain. |
| `git diff --check` | PASS. |
| `bun run whatsapp:templates:check` | PASS. All 57 v2 templates validated. |
| `bun scripts/create-whatsapp-templates.mjs --plan --scope concierge --local-only` | PASS. Explicit local-only plan reported 33 branded variants and no provider/database write. |
| `file public/brand/concierge-whatsapp-header.webp` | PASS. Valid WebP, 1200×628, 24,036 bytes. |
| Source/build asset SHA-256 comparison | PASS. Both are `a4d0326462476e8efc235ac8e5acefc4a8d02911c274fdad51d71c8911e402b2`. |
| Disposable database integration | PARTIAL. The final migration parsed and applied in an isolated local PostgreSQL 14 compatibility harness, and the invalid-materialization-shape integration case passed. The full Supabase-version materialization suite remains required. |
| Linked migration dry run/push | NOT RUN. The protected linked target was outside this correction pass and no mutation was authorized. |
| Zero-traffic exact-commit deployment | NOT RUN. No deployment or traffic mutation was authorized. |
| Authenticated Meta plan/apply/refresh and test sends | NOT RUN. Provider credentials, approvals, test identity, and mutation authority were unavailable. |
| Resend/Gmail/Outlook/WhatsApp receipts and client inspection | BLOCKED. Reply-To and external delivery evidence remain incomplete. |

An optional `bunx tsc --noEmit` diagnostic still reports unrelated repository-baseline type
errors outside this change set. The required test, lint, and production-build gates pass.

## Required follow-up before another go/no-go

1. Provide a disposable database URL and run both database integration suites with the new
   migration.
2. Under explicit operator authority, run the linked migration dry run and review the exact
   expand-only delta before any push.
3. Configure a monitored `MESSAGING_EMAIL_REPLY_TO`.
4. Deploy the corrected commit as a zero-traffic revision and verify the tagged asset returns
   `200 image/webp`.
5. Run authenticated read-only Meta reconciliation; submit/refresh only under explicit authority
   and require exact-hash `APPROVED` evidence.
6. Send only to the allowlisted test recipient while every journey remains `test_only`; collect
   email, mailbox, WhatsApp, and delivery-receipt evidence.
7. Repeat the decision gate. Any promotion to `live` remains a separate explicit operator action.
