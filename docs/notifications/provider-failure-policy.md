# Provider failure policy

| Failure                                                                  | Delivery action                                   | Task response |
| ------------------------------------------------------------------------ | ------------------------------------------------- | ------------- |
| Timeout, network error, 408, 429, provider 5xx                           | record transient failure and bounded next attempt | 503           |
| Invalid recipient, rejected template, authentication/configuration error | dead-letter/suppress with safe code               | 200           |
| Delivery already terminal                                                | no provider call                                  | 200           |
| Another worker owns an unexpired lease                                   | no provider call; retry after the lease window    | 503           |
| Event expired or business state is no longer valid                       | expire/cancel                                     | 200           |
| WhatsApp provider result ambiguous                                       | `delivery_unknown`; operator reconciliation       | 200           |

Cloud Tasks is configured for no more than 8 transport attempts, exponential backoff from 10 seconds to one hour, and a 24-hour retry duration. Queue limits are environment-configurable, while provider calls retain the existing smaller per-channel retry limits. The database remains authoritative and the 15-minute maintenance pass recovers only work that is safe to retry.

Provider calls keep the existing channel adapters and existing policy gates:

- `MESSAGING_DELIVERY_MODE=disabled` sends nothing;
- `allowlist` limits real external sends to approved recipients;
- `live` still requires channel-specific enablement and the existing WhatsApp confirmation guard;
- member preferences and WhatsApp consent are evaluated before delivery;
- no fallback converts an email/push failure into an unsolicited WhatsApp message.

Alerts should be based on queue age, oldest pending delivery, dead-letter growth, enqueue failures, and provider failure rate. Alerts and logs must use IDs and error classes only.
