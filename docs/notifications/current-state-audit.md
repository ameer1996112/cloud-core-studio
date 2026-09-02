# Notification and cost audit

Audit date: 2026-09-02. This is a read-only inventory; no production resource or data was changed.

## Cost finding

The August invoice was ₪61.09, of which Cloud Run was ₪59.65. The September console forecast was ₪234.41, but that forecast extrapolated an early-day run rate and is not a fixed bill.

The dominant waste was idle/polling compute, not five active users:

- the production service was configured at minimum 1, maximum 3, 1 vCPU, 512 MiB, concurrency 80, with `rollback-smoke` and `new-release-smoke` traffic tags; each of the three serving revisions carried `minScale=1`;
- `cloud-core-unified-messaging-sweep` ran every minute (about 61,000 executions in the inspected period); short executions were billed using the Cloud Run Job minimum billing duration;
- a staging Sheets worker ran every five minutes (4,435 recorded executions) and a separate notification job every fifteen minutes (3,987 executions);
- Artifact Registry storage/egress, Secret Manager, and Cloud Storage were minor compared with Cloud Run.

At audit time the Cloud Tasks API was disabled, so there was no existing queue to reuse. The configuration script plans API enablement and queue creation but this branch did not apply either change.

Re-run the safe inventory with:

```bash
scripts/gcp/audit-cloud-run-cost-config.sh
```

The script contains only describe/list operations and never prints environment-variable values or secret contents.

## Existing application inventory

The repository already had a mature canonical messaging system. This implementation extends it rather than creating a second notification stack.

| Concern                 | Existing implementation retained                                        |
| ----------------------- | ----------------------------------------------------------------------- |
| Durable event facts     | `message_outbox` with a unique `deduplication_key`                      |
| Member-visible messages | `messages` plus in-app `message_deliveries`                             |
| Per-channel state       | `message_deliveries` and `message_delivery_attempts`                    |
| Provider adapters       | `messagingProviders.server.ts` for email, push, and WhatsApp policy     |
| Preferences/consent     | existing messaging policy and member preference tables                  |
| Localization/templates  | existing concierge/template catalogs for Hebrew, Arabic, and English    |
| Payment production      | database payment lifecycle trigger, plus post-commit delivery kick      |
| WhatsApp                | existing Mac-local OpenWA claim/report bridge; no Cloud Tasks send path |
| Admin monitoring        | existing delivery monitoring functions and console                      |

Payment outbox insertion is performed by a database trigger in the same database transaction as the payment state change. Its deterministic key (`payment:{payment_id}:{event}`) makes webhook replay safe. The browser-return path now also performs a best-effort post-commit kick; delivery failure cannot roll back or alter the payment result.

## Gaps closed in this change

- captured immutable template key/version/locale metadata on each outbox fact;
- added deterministic Cloud Tasks identity and task recovery metadata;
- added a token-bound single-delivery lease for duplicate-safe processing;
- added OIDC-only internal maintenance and delivery endpoints;
- separated durable preparation from delivery so Cloud Run can scale to zero;
- added a fifteen-minute bounded maintenance path instead of minute polling;
- added dry-run and disabled-by-default rollout controls;
- added a reproducible scale-to-zero/queue/scheduler configuration script.

## Known scope boundaries

- Cloud Tasks covers `in_app`, `push`, and `email` deliveries. WhatsApp remains on the local bridge because a successful browser send followed by a lost response is ambiguous and must not be retried blindly.
- This branch does not deploy infrastructure, migrate production data, enable flags, pause jobs, or change secrets.
- The old scheduled sweep remains available during rollout and must be paused only after the Cloud Tasks path is proven healthy.
