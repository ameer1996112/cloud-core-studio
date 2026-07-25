# Premium Concierge implementation plan

## Foundation

- Add the studio-scoped recipient, relationship, consent, canonical domain outbox, journey,
  intent, arbitration decision, reservation, config, template, snapshot, inactivity, weekly
  schedule, attention, and lead tables in
  `supabase/migrations/20260726120000_premium_concierge_foundation.sql`.
- Reuse `message_deliveries`, `message_delivery_attempts`, and webhook events, extending them
  with studio/snapshot/reconciliation metadata.
- Emit canonical booking, payment, class, and receipt events through transaction-local triggers.
- Claim outbox work with leases and `SKIP LOCKED`; reserve contact capacity under a locked
  recipient row.
- Keep every automation paused and every external channel disabled.

## Policy and orchestration

- Put deterministic, provider-free rules in `src/lib/conciergePolicy.ts`.
- Route all future journey workers through recipient resolution and
  `chooseNextRecipientAction`, then call the database reservation RPC in the same
  materialization transaction.
- Adapt the existing canonical worker rather than introduce another runtime.
- Normalize provider payment/receipt/subscription events to one stable business outcome before
  journey creation.

Implemented runtime: `src/lib/conciergeOrchestration.ts`,
`src/lib/conciergeOrchestrator.server.ts`, `src/routes/api/internal/concierge/run.ts`, and
`20260726150000_concierge_orchestration_runtime.sql`. External delivery materialization remains
intentionally gated until state reload, template resolution, and reservation are joined in one
transaction. Live and allowlisted test-only events are postponed rather than consumed until
that path exists.

Implemented shadow dispatch evaluation:
`src/lib/conciergeDispatch.ts`, `src/lib/conciergeEngagement.server.ts`,
`src/lib/conciergeDispatch.server.ts`, `src/routes/api/internal/concierge/dispatch.ts`, and
`20260726180000_concierge_shadow_dispatch.sql`. It reloads current engagement state, arbitrates
all eligible actions, resolves approved templates only in the recipient's exact locale, and
records deterministic evidence atomically. It intentionally creates no delivery side effects.

Implemented guarded test/live materialization:
`src/lib/conciergeMaterialization.ts`, `20260726190000_concierge_live_intents.sql`,
`20260726200000_concierge_atomic_delivery.sql`, and
`20260726210000_concierge_activation_guard.sql`. The transaction reserves capacity before
creating channel snapshots and canonical deliveries. Live promotion is versioned and audited,
requires exact typed confirmation plus complete approved locale coverage, and remains subject
to the deployment-level live gate.

## Operational journeys

Booking confirmation/cancellation, class change, waitlist, payment outcome, and receipt will
consume the new outbox. Scheduled actions reload booking/class/payment state immediately before
decision. Existing delivery adapters remain responsible only for transport.

## Growth, retention, and leads

Weekly publication uses one initial key and explicit reasoned revisions. Recommendation
eligibility runs hard filters before ranking. Inactivity uses open/closed episodes with one
WhatsApp timestamp. Instagram/WhatsApp inbound leads use the `lead_journeys` state model; the
live inbound adapter remains gated on Meta setup.

## Admin

Extend the existing Messages center with a business Automations surface backed by config,
channel controls, attention items, delivery health, shadow evaluation, simulator, schedule
preview/publication, and daily briefing. Simulator and shadow requests execute the same pure
policy code but never reserve capacity or create deliveries.

## Verification

Use focused Bun unit tests throughout, then `bun run lint`, `bun test tests/unit
tests/integration`, and `bun run build`. Run database concurrency/RLS tests against a disposable
local Supabase database before rollout. Production activation follows `ROLLOUT.md`; application
deployment and schema installation do not themselves activate a customer journey.
