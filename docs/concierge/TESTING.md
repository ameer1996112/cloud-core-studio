# Testing

The pure policy suite is `bun test tests/unit/conciergePolicy.test.mjs`. It covers guardian
resolution, booking lanes, quiet hours, payment-failure timing, urgent arbitration, contact
caps, consolidated payment outcomes, weekly keys, recommendation eligibility, and inactivity
closure.

The orchestration suite is `bun test tests/unit/conciergeOrchestration.test.mjs`. It covers
event normalization, payment consolidation, unsupported-schema handling, paused/shadow/live
safety, test allowlisting, batch materialization, postponement, and permanent failure handling.

Before release run:

```sh
bun install
bun run lint
bun test tests/unit tests/integration
bun run build
```

Against a disposable local Supabase database, additionally test transaction rollback, two-worker
claims, stale leases, duplicate events, two-dispatcher reservations, schedule/template
uniqueness, webhook order/deduplication, and RLS. Provider contracts must use mocks or sandbox
allowlists. Shadow/simulator tests must assert no snapshot delivery or reservation is created.
