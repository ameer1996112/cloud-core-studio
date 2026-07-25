# Operations runbook

Monitor outbox depth/oldest age, intent drift, suppression reasons, reservation caps, delivery
acceptance/latency/failure/unknown, push coverage, locale coverage, conversions, and opt-outs.
Targets are p95 provider acceptance under 60 seconds for urgent class operations and p95
materialization under two minutes for bookings and scheduled work.

For a stuck event, inspect correlation ID, lease, attempt count, current aggregate state, and
decision evidence. Release only an expired lease. Dead-letter after bounded retries and create
an attention item. Never bulk replay rows marked `historical`, especially promotional events.

Run one safe worker batch with:

```sh
curl -X POST \
  -H "Authorization: Bearer $NOTIFICATION_AUTOMATION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit":25}' \
  "$APP_URL/api/internal/concierge/run"
```

The endpoint cannot send live traffic. `CONCIERGE_TEST_RECIPIENT_IDS` is a comma-separated list
of communication-recipient UUIDs allowed through test-only evaluation. Keep it empty outside an
explicit staff test.

Evaluate up to 25 eligible recipient intents against current state with:

```sh
curl -X POST \
  -H "Authorization: Bearer $NOTIFICATION_AUTOMATION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit":25}' \
  "$APP_URL/api/internal/concierge/dispatch"
```

The dispatch endpoint follows each journey's current mode. Shadow creates evidence only.
Test-only creates canonical deliveries only for `CONCIERGE_TEST_RECIPIENT_IDS`. Live requires a
versioned, approved configuration and `CONCIERGE_LIVE_DELIVERY_ENABLED=true`. Inspect decisions,
reservations, snapshots, deliveries, and attention items after every mode change.

The scheduled job runs in this order: domain orchestration, recipient dispatch, then canonical
provider delivery. Keep the Cloud Scheduler job paused until migrations, templates, allowlists,
and runtime flags have been checked. A deployed application with paused/shadow journeys and the
live gate disabled cannot generate new external Concierge deliveries.

For ambiguous WhatsApp, disable that delivery, reconcile using the provider ID/conversation,
and resolve manually. For duplicate concern, pause the journey and external channel before
investigation. Kill switches do not remove durable in-app evidence.

Rollback is operational first: pause journey, disable affected channel, drain no new work, then
revert application code if necessary. The additive schema remains for audit and compatibility.
