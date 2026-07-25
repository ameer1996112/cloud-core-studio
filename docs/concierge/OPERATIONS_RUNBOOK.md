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

The dispatch endpoint is also shadow-only. Confirm its response reports `mode: "shadow"` and
inspect `concierge_decisions` plus admin attention before changing any automation configuration.
It does not reserve frequency capacity or create message deliveries.

For ambiguous WhatsApp, disable that delivery, reconcile using the provider ID/conversation,
and resolve manually. For duplicate concern, pause the journey and external channel before
investigation. Kill switches do not remove durable in-app evidence.

Rollback is operational first: pause journey, disable affected channel, drain no new work, then
revert application code if necessary. The additive schema remains for audit and compatibility.
