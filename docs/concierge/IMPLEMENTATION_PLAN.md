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
local Supabase database before rollout. No production migration or provider transmission is
part of repository implementation.
