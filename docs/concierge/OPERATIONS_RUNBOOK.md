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

## Branded WhatsApp approval and rollback

The template provisioner is plan-only by default. Review the reconciliation report before any
provider write. For Concierge-only provider submission, use the exact confirmed WABA command:

```sh
bun scripts/create-whatsapp-templates.mjs --apply --waba-id 1009561255148806 --scope concierge
```

Do not use the tool to update drifted approved content in place. The Concierge catalog uses the
new `_branded_v2` template names; investigate and reconcile provider errors before a retry.

Promote branded templates only in this order:

1. Review plan output.
2. Submit to Meta.
3. Confirm the deployment row shows `APPROVED`.
4. Send to an allowlisted test-only recipient.
5. Review delivery evidence.
6. Promote one journey at a time.
7. If rollback is needed, select the prior approved template/presentation version.

Keep sender identity checks current: the email sender is **Cloud & Core Studio** on a verified
studio domain with the configured support Reply-To; SPF and DKIM must pass and DMARC must be
present. Confirm the WhatsApp display name is **Cloud & Core Studio**, and its profile includes
the logo, description, website, email, and address. Verify the header asset URL returns HTTPS
200 with the correct content type and a stable cache policy. Gmail avatars are provider-controlled
and cannot be guaranteed by email HTML.
