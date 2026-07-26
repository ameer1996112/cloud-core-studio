# Task 7 — Full Verification and Test-Only Rollout Report

Last updated: 2026-07-26

Implementation base: `7fa0a4e3af4b33e18c6de652ebeb01376f16e42b`

Branch: `codex/concierge-live-readiness`

## Decision

**NO-GO. Keep every Concierge journey `test_only`; do not promote any journey to `live`.**

The round-two code findings are addressed locally, but local code readiness is not production
delivery evidence. This pass did not apply a database migration, deploy a revision, create or
refresh a Meta template, send a provider message, move traffic, or change a journey mode.

The promotion blockers remain:

1. The local-only provisioning plan contains 33 Meta template creates. None was submitted.
2. The corrected 1200×628 PNG header is present in the repository but has not been deployed or
   verified at the production edge as `200 image/png`.
3. The last authorized production configuration evidence did not include
   `MESSAGING_EMAIL_REPLY_TO`; email delivery must continue to fail closed.
4. No disposable `MESSAGING_TEST_DATABASE_URL` was available. PostgreSQL tooling is installed, but
   `pg_isready` reported no server and the database-backed suites remained skipped.
5. No linked migration dry run/push, provider approval reconciliation, allowlisted provider send,
   delivery receipt, or mailbox/client inspection was performed.

## Test-only safety status

- Initial selections for both `test_only` and `live` remain on rollback-safe v1.
- A v2 candidate requires an authenticated preview approval and an explicit exact-candidate
  selection; approval or migration alone does not select v2.
- The 15 missing WhatsApp source variants seed as `draft` with null approval provenance.
- The migration is additive and has not been applied by this work.
- No external mutation occurred during this pass.

## Corrected local readiness

- The Meta-compatible header contract is PNG, RGB, 1200×628, 160,137 bytes, with SHA-256
  `b29c3947567fd874164ce7a7e24d1f230b6987183ea905fc13fbc7aebe830fb6`.
- Runtime selection is bound to an exact source template ID, source content hash, source approval
  provenance, one canonical immutable presentation contract/hash, and—on email—the exact shell
  version/hash. Admin preview approval renders that exact candidate instead of mutable current copy.
- v1 email uses the actual legacy event category and action while preserving payment facts.
- Exact stored materialization replay occurs before mutable source, selection, retirement,
  recipient, configuration, or provider checks.
- Only the explicitly configured production WABA is trusted; approved deployments from other
  WABAs cannot satisfy selection or materialization evidence, and the final send gate rejects a
  runtime `META_WABA_ID` that differs from the stored trusted WABA.
- Stale post-dispatch WhatsApp work becomes `delivery_unknown` and is not blindly retried.
- Payment evidence is bound to the recipient participant/member identity.
- Structured facts render in localized plain text with RTL/LTR handling.
- Payment subtype/subscription/`requires_action` and recommendation events now have concrete
  runtime emitters.
- The SQL provider catalog is generated from and exhaustively compared with the TypeScript
  contract to reduce drift.

## Command evidence

| Command/check | Result |
| --- | --- |
| `bun install` | PASS. Bun checked 524 installs / 595 packages; no dependency changes. |
| `bun test tests/unit tests/integration` | PASS: 374 passed, 3 skipped, 0 failed, 3,105 expectations across 74 files. All three skips require the absent disposable database URL. |
| `bun run lint` | PASS with zero errors and 727 repository-baseline warnings. |
| `bun run build` | PASS. Vite client and SSR production builds completed. |
| `bun run whatsapp:templates:check` | PASS. All 57 v2 templates validated. |
| `bun scripts/create-whatsapp-templates.mjs --plan --scope concierge --local-only` | PASS. It planned 33 creates and performed no provider or database write. |
| Header inspection | PASS locally: PNG, RGB, 1200×628, 160,137 bytes, exact SHA-256 above. |
| Disposable database integration | NOT RUN. `MESSAGING_TEST_DATABASE_URL` is absent and no local server is accepting connections. |
| Linked database/provider/deployment/send checks | NOT RUN. They require separate operator authority and external evidence. |

## Required follow-up before another go/no-go

1. Provide a disposable Supabase-compatible database URL and run all database integration suites
   against the full migration chain.
2. Under explicit operator authority, run and review a linked migration dry run before any push.
3. Configure and verify a monitored `MESSAGING_EMAIL_REPLY_TO`.
4. Deploy the exact reviewed commit as a zero-traffic revision and verify the PNG URL returns
   `200 image/png` with the intended cache policy.
5. Run authenticated read-only Meta reconciliation against the configured production WABA. Submit
   the 33 creates only under explicit authority, then require exact-hash `APPROVED` evidence.
6. With every journey still `test_only`, send only to the allowlisted test identity and collect
   provider receipts plus Gmail/Outlook/WhatsApp and plain-text/RTL/images-disabled evidence.
7. Repeat the decision gate. Any `live` selection or journey promotion is a separate explicit
   operator action.
