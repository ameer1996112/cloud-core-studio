# Task 7 — Full Verification and Test-Only Rollout Report

Run completed: 2026-07-26T21:00:31+03:00

Verified source commit: `69621be791e2c04aa704801ef48b0e2b2efd9677`

Branch: `codex/concierge-live-readiness`

## Decision

**NO-GO. Keep every Concierge journey `test_only`; do not promote any journey to `live`.**

No migration, deployment, provider template creation, provider send, database write, traffic
movement, or journey-mode change was performed during this verification.

The blocking evidence is:

1. `https://cloudandcorestudio.com/brand/concierge-whatsapp-header.webp` returns `404` with
   `text/html`, not `200 image/webp`.
2. The existing zero-traffic `concierge-e2e` tag also returns `404` for the branded header and does
   not identify the verified source commit.
3. Production Cloud Run has the required branded From display name, but
   `MESSAGING_EMAIL_REPLY_TO` is not configured. The email adapter therefore fails closed before a
   Resend request.
4. No disposable `MESSAGING_TEST_DATABASE_URL` or local provider credentials are configured, so
   the database integration suites, provider approval rows, provider receipts, and mailbox/client
   rendering cannot be verified.
5. The linked Supabase dry run was not authorized against the protected linked target. The
   non-dry-run push was intentionally not attempted.
6. A new exact-commit, zero-traffic Cloud Run revision was not authorized and was not deployed.

## Test-only safety status

- The worktree started clean at the required commit and no application source was changed.
- Production Cloud Run reports `CONCIERGE_LIVE_DELIVERY_ENABLED=false`.
- Production canonical delivery remains in `allowlist` mode with a non-empty recipient allowlist.
- `CONCIERGE_TEST_RECIPIENT_IDS` is configured in Cloud Run; its value was not read or printed.
- Email and WhatsApp channel switches are enabled, which makes the missing Reply-To and missing
  branded asset active blockers rather than deferred configuration.
- No row-level automation mode was changed or independently queried because no authorized
  production database session was available.

## Command-by-command evidence

| Command/check | Result |
| --- | --- |
| `git status --short --branch` | PASS. Clean worktree at the start; branch was ahead of `origin/main` by the prior task commits. |
| `git rev-parse HEAD` | PASS. Exact requested base: `69621be791e2c04aa704801ef48b0e2b2efd9677`. |
| Environment-name and local env-file check | PASS for secrecy; BLOCKED for integration. No credential values were printed. No `.env.whatsapp.local` exists. No `MESSAGING_TEST_DATABASE_URL`, Supabase, Meta, Resend, or GCP provider variables are exported in the task shell. Linked Supabase metadata exists. |
| `bun install` | PASS. Bun 1.3.12 checked 524 installs / 595 packages; no changes. |
| `bun test tests/unit tests/integration` | PASS for all runnable tests: 334 passed, 0 failed, 2 skipped. The skipped suites were `unifiedMessagingDatabase` and `conciergeDatabase`, both gated by the absent disposable DB URL. |
| `bun run test:integration` | BLOCKED as designed: exited 1 with `MESSAGING_TEST_DATABASE_URL is required`. No database connection was attempted. |
| `bun run lint` | PASS. Exit 0 and zero errors. |
| `bunx eslint . --format json` summary | PASS. 349 files, 0 errors, 0 fatal errors, 729 pre-existing warnings. |
| `bun run build` | PASS. Vite client and SSR production builds completed. Existing module-externalization, deprecation, and large-chunk warnings remain non-fatal. |
| `git diff --check` | PASS before report creation. |
| `bun run whatsapp:templates:check` | PASS. Validated all 57 v2 templates. |
| `bun run whatsapp:templates:plan` | PASS, local-only. Output reported `mode=plan`, `remoteLookup=false`, deployment sync disabled for `plan_only`, and image-header prerequisites. No Meta or database request occurred. |
| Concierge-only reconciliation summary using the public catalog/planner seam | PASS. 33 Concierge WhatsApp locale variants; all 33 require an image header and plan as `create` against an intentionally empty local remote set. |
| Full local branded-preview matrix using the public preview functions | PASS. 10 grouped journeys; 54 supported external variants: 21 email and 33 WhatsApp. Every supported Hebrew, Arabic, and English variant resolved variables, used `v2` presentation evidence, selected the correct RTL/LTR direction, and rendered its channel shell. Synthetic exact-hash `APPROVED` fixtures were used only to test badge logic; they are not production approval evidence. |
| `file public/brand/concierge-whatsapp-header.webp` | PASS. Valid WebP, 1200×628, 24,036 bytes. |
| Source/build asset SHA-256 comparison | PASS. `public/brand/concierge-whatsapp-header.webp` and `dist/client/brand/concierge-whatsapp-header.webp` are byte-identical (`a4d0326462476e8efc235ac8e5acefc4a8d02911c274fdad51d71c8911e402b2`). |
| Local production server smoke (`PORT=4173 bun run start`) | PASS after localhost binding was permitted. `/` returned 200; the branded asset returned `200 image/webp` with `public, max-age=3600`; signed-out requests to `/admin/messages` and `/admin/templates` returned 307 to `/auth` with safe `returnTo` values. The repository integration test verifies that `/admin/messages` opens Concierge as its default tab, while the `/admin/templates` route source redirects authenticated navigation to `/admin/messages`. |
| Public branded asset request | **FAIL.** Custom-domain URL returned `404`, `text/html`, `cache-control: max-age=600`. |
| Redacted `gcloud auth list` | PASS. An active gcloud credential exists; account identity was not printed. |
| Read-only Cloud Run service description | PASS. An existing zero-percent `concierge-e2e` tag exists and the service has a ready revision. This was read-only. |
| Existing `concierge-e2e` tag smoke | PARTIAL. `/` returned 200; signed-out `/admin/messages` and `/admin/templates` requests returned 307 to `/auth`; the branded asset returned `404 text/html`. The tag points to an older revision, not a newly built exact-commit revision. |
| Redacted Cloud Run safety/config check | PASS for safety, **FAIL** for email readiness. Live delivery is false; delivery mode is allowlist; recipient allowlists are configured; Meta, Resend, and Supabase production credential references are present without reading values; required branded From display name is valid; Reply-To is absent. |
| Public DNS presence/syntax checks | PASS. DMARC version/policy, Resend return-path SPF MX/TXT, and the expected Resend DKIM public key are present. Record values were not printed. This does not replace inspection of an actually delivered message's authentication results. |
| `bunx supabase db push --linked --dry-run` | BLOCKED. Initial sandbox run could not write CLI telemetry. The escalated read-only request was rejected because the linked target is protected and the task had no explicit authority to contact it. No migration comparison or write occurred. |
| `bunx supabase db push --linked` | NOT RUN. This is a remote mutation and was outside the verification-only authorization. |
| Zero-traffic exact-commit deployment | NOT RUN. Building a Cloud Run image/revision is an external mutation and was not authorized. The local exact-commit production build and local route smoke passed. |
| WhatsApp `--apply` provision command | NOT RUN. It creates provider templates and requires an uploaded private media handle; neither mutation authority nor a local handle was provided. |
| WhatsApp `--refresh` | NOT RUN. Although Meta-side refresh is read-only, it writes deployment rows and requires provider/database credentials that are not available locally. |
| Branded email event triggers / Resend receipts | NOT RUN. No explicit allowlisted test identity or mutation authority was supplied, and production Reply-To is missing. |
| Gmail desktop/mobile, Outlook, images-disabled, RTL, and plain-text inspection | BLOCKED. Requires delivered test messages and mailbox access. Local renderer tests passed but are not mailbox evidence. |
| Branded WhatsApp test sends / delivery receipts | NOT RUN. Production `_branded_v2` approval rows could not be verified, so the required no-send-until-approved rule applied. |

## Preview coverage notes

The UI groups the database templates into 10 journey groups. The supported external-channel
matrix is intentionally sparse:

- booking: WhatsApp only;
- class change: email and WhatsApp;
- lead to trial: email only;
- payment outcome: email and WhatsApp;
- recommendation, retention, and waitlist: WhatsApp only;
- booking cancellation, daily briefing, and weekly schedule: no branded email/WhatsApp variant in
  the catalog.

The automated matrix verified every supported variant. A real Admin Templates review of lifecycle
badges and production provider approval badges remains blocked without authenticated Admin/database
access.

## Required follow-up before another go/no-go

1. Deploy the exact verified commit as a zero-traffic revision and repoint `concierge-e2e`, without
   moving production traffic.
2. Confirm the tagged header URL returns `200 image/webp` and the expected cache policy.
3. Configure `MESSAGING_EMAIL_REPLY_TO` to a monitored address.
4. Provide an explicitly disposable `MESSAGING_TEST_DATABASE_URL`; run both database integration
   suites.
5. Run the linked migration dry run under explicit operator authority and verify that only
   `20260727120000_concierge_branded_presentation_evidence.sql` is pending before any push.
6. Review all supported production preview rows and confirm lifecycle plus exact-hash provider
   approval badges.
7. Submit or refresh `_branded_v2` WhatsApp deployments under explicit operator authority; do not
   send until each selected locale is `APPROVED`.
8. Send only to the explicitly allowlisted test recipient while all journeys remain `test_only`;
   collect Resend, Gmail, Outlook, Meta, and delivery-receipt evidence.
9. Repeat the decision gate. Promotion to `live` remains a separate explicit operator action.
