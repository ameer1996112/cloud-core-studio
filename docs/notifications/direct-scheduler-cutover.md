# Direct messaging scheduler: interim cost-saving cutover

This changes only how the existing minute sweep is invoked:

`Cloud Scheduler -> POST /api/internal/messages/sweep`

It removes the intermediate Cloud Run Job. The same bounded sweep, official WhatsApp provider, email/push adapters, delivery leases, consent checks, and reminder logic remain in use. It does **not** activate Cloud Tasks or the new outbox flags. The fifteen-minute fallback (including concierge and promotions) and daily payment renewals remain unchanged.

## Security and configuration

The website remains public; the sweep independently verifies Google's signed OIDC token, issuer, exact audience, verified service-account email, and expiry. Only this endpoint accepts the scheduler identity. Existing bearer-token authentication remains available to the fallback and rollback job; no secret is copied into Scheduler headers or bodies.

Deploy the code before changing Scheduler. Configure these server-only variables on the service using `--update-env-vars`, preserving all other configuration:

- `MESSAGING_SWEEP_OIDC_ENABLED=true`
- `MESSAGING_SWEEP_OIDC_AUDIENCE`: the exact Cloud Run service origin from `status.url`, no trailing slash/path.
- `MESSAGING_SWEEP_OIDC_SERVICE_ACCOUNT`: the existing Scheduler caller, verified from its current `oauthToken.serviceAccountEmail`.

Do not enable any `NOTIFICATIONS_*` transport flags for this cutover. Do not change instance limits, CPU, memory, concurrency, messaging mode, or provider secrets.

Cloud Scheduler must be able to mint tokens for its caller. Preserve the Scheduler service-agent role and existing service-account permissions. If needed, grant the caller `roles/run.invoker` on this **service only**, not on the whole project. See [Google's HTTP target authentication instructions](https://docs.cloud.google.com/scheduler/docs/http-target-auth).

## Readiness and rollout

1. Capture the existing scheduler target, OAuth caller/scope, JSON body, headers, schedule, timezone, deadline, retries and enabled state. Save the service revision and new-variable presence without printing secrets. Inspect the current job's sweep limit and canary setting.
2. Deploy the reviewed code through the existing main-branch Cloud Build pipeline. Confirm both legacy read-only deployment canaries pass.
3. Configure the three OIDC variables. Check the new revision is ready and public pages still load. Anonymous and forged-token POSTs must return 401, never run a sweep.
4. Create a temporary Scheduler canary with a future annual schedule, the same caller and audience, and body `{"limit":50,"canary":true}`. The limit must match the live job. Manually run it, then verify Scheduler success and a 200 response for the matching Cloud Run request. The canary performs only readiness SELECTs, no provider sends. Keep the existing minute job schedule running during this check. Pause the temporary canary after testing.
5. Only after this real Google-signed canary passes, update the **existing** minute scheduler in place. Do not create a second active delivery schedule. Preserve its schedule, timezone, enabled state, and retry limits. Switch OAuth to OIDC, target the service's `/api/internal/messages/sweep`, and set JSON body `{"limit":50}` (no canary flag). Set the HTTP attempt deadline to 300 seconds, matching the service timeout; the old ten-minute deadline only covered the Run Jobs API invocation.
6. Verify the stored target has OIDC and no OAuth, no static Authorization header, and no canary field. Observe at least two successful normal scheduled HTTP calls, then confirm the old job has no new scheduled executions. Allow already-started executions to finish. Existing database leases remain the duplicate-processing safeguard during overlap/retries.
7. Delete only the temporary canary schedule created for this rollout. Keep the Cloud Run Job definition and its credentials for rollback. Cloud Build may still execute its read-only canary once per deployment; that is not minute-by-minute polling.

Example update after verification (values must be resolved from the captured configuration):

```bash
gcloud scheduler jobs update http "$MESSAGING_SCHEDULER" \
  --project "$MESSAGING_PROJECT" --location "$MESSAGING_REGION" \
  --uri "$MESSAGING_SERVICE_URL/api/internal/messages/sweep" \
  --http-method POST \
  --oidc-service-account-email "$MESSAGING_CALLER" \
  --oidc-token-audience "$MESSAGING_SERVICE_URL" \
  --update-headers 'Content-Type=application/json' \
  --message-body '{"limit":50}' \
  --attempt-deadline 300s \
  --max-retry-attempts 1 --max-retry-duration 0s
```

The example's limit/retries match the inspected production setup; use captured values if they differ. Switching token type replaces the old OAuth config. Verify with `gcloud scheduler jobs describe` after updating. Do not combine `--clear-auth-token` with `--oidc-service-account-email`: these flags are mutually exclusive.

Scheduler waits for an outstanding HTTP call to finish, so a sweep taking over a minute can delay the next tick. This avoids scheduling another wrapper while the same invocation is still waiting. The request still uses the existing bounded batch and 300-second Cloud Run timeout. Observe latency and failure status, not just the schedule's ENABLED flag. A timed-out request may continue server-side; retain the existing leases and fallback.

## Verification and alerting

Use Scheduler `AttemptFinished` status and matching Cloud Run HTTP status/latency to verify the new path. A successful Scheduler call now means the application returned success; previously it meant the Run Jobs API accepted a start request. Provider acceptance/recipient receipt are separate facts. Do not fabricate messages to real members as a test.

The existing Cloud Run **job** failure alert does not cover direct HTTP calls. Operators must inspect Scheduler failures (or add a dedicated Scheduler failure alert under separate monitoring scope); the retained job alert only covers rollback/deployment executions. The production rollout report should explicitly record this monitoring difference.

## Rollback

Update the same Scheduler back to the captured `https://run.googleapis.com/v2/projects/.../locations/.../jobs/...:run` URI, OAuth service account and scope, body `{}`, and original 600-second deadline. Preserve the original cadence/retries. Verify a new job execution succeeds. No database restore or migration is required. The new OIDC variables may then be disabled, but do not remove legacy bearer credentials.

Do not run `scripts/configure-unified-messaging-cloud-run.sh` casually after this cutover: it provisions the legacy job target and can restore costly polling. Use it only for an intentional rollback/reprovisioning.

## Cost expectations

At one scheduled start per minute, removing the wrapper avoids 43,200 scheduled Cloud Run Job starts in a nominal 30-day month. Cloud Run Jobs have a one-minute billing minimum per started instance; request-based services bill active request time instead. The receiving service was already doing the sweep in both designs. [Cloud Run pricing](https://cloud.google.com/run/pricing).

This is **not** a zero-cost guarantee. The minute HTTP sweep still uses service CPU, Supabase queries, and provider calls when work is due. The fifteen-minute fallback and Sheets worker still start separate jobs. Full task-driven delivery remains a later cutover after its known provider/recovery blockers are resolved. Compare actual Billing by SKU and daily usage after this change; forecasts may lag and already-accrued charges remain.
