# Durable notification outbox and low-idle-cost design

## Goal

Keep the existing professional notification capabilities while removing continuous Cloud Run compute for a roughly five-user application. Business transactions must commit independently of notification providers, important messages must survive restarts, and duplicate execution must not create duplicate business events or routine duplicate sends.

## Accepted design

- Extend the canonical `message_outbox`, `messages`, `message_deliveries`, and `message_delivery_attempts` schema.
- Write outbox events in the business transaction with deterministic deduplication keys.
- Materialize messages/deliveries, then enqueue one deterministic Cloud Task per non-WhatsApp delivery.
- Send Cloud Tasks to a private OIDC-verified Cloud Run endpoint with a UUID-only payload.
- Atomically claim by delivery ID with a token-bound lease before provider I/O.
- Reuse the existing email, push, localization, preferences, consent, audit, and admin monitoring implementation.
- Keep WhatsApp on the Mac-local OpenWA claim/report bridge.
- Use a post-commit kick for low latency and one bounded fifteen-minute scheduler for recovery/reminders.
- Run Cloud Run with min instances 0, request-based CPU, max instances 3, and conservative queue concurrency.
- Roll out behind disabled-by-default and dry-run flags. Do not deploy or mutate production as part of implementation.

## Acceptance criteria

- Payment webhook replay creates one outbox fact and never changes a committed payment to failed because notification delivery fails.
- A duplicate task cannot acquire an active lease or resend a terminal delivery.
- Retryable provider failures are retried with bounded backoff; terminal/configuration failures are acknowledged and visible.
- Tasks and logs contain no recipient, message body, credentials, or payment payload.
- Wrong/missing OIDC identity and malformed payloads are rejected.
- Maintenance and task batches are bounded and Cloud Run can scale to zero.
- Current-state audit, architecture, provider policy, cost plan, rollout, rollback, health queries, tests, and reproducible infrastructure commands are documented.
