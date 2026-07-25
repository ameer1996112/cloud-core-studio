# Testing

The pure policy suite is `bun test tests/unit/conciergePolicy.test.mjs`. It covers guardian
resolution, booking lanes, quiet hours, payment-failure timing, urgent arbitration, contact
caps, consolidated payment outcomes, weekly keys, recommendation eligibility, and inactivity
closure.

The orchestration suite is `bun test tests/unit/conciergeOrchestration.test.mjs`. It covers
event normalization, payment consolidation, unsupported-schema handling, paused/shadow/live
safety, test allowlisting, batch materialization, postponement, and permanent failure handling.

The dispatch suite is `bun test tests/unit/conciergeDispatch.test.mjs`. It covers cross-journey
arbitration, first-versus-repeat booking lanes, exact-locale template enforcement, render
variables, channel controls, and quiet-hours postponement.

The materialization suite is `bun test tests/unit/conciergeMaterialization.test.mjs`.
`tests/integration/conciergeDatabase.test.mjs` runs against a disposable PostgreSQL/Supabase
database and proves deterministic delivery creation plus two-dispatcher frequency protection.

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

Local Concierge database gate:

```sh
supabase db reset --local --no-seed
MESSAGING_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  bun test tests/integration/conciergeDatabase.test.mjs
```
