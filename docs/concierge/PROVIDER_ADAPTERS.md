# Provider adapters

The system reuses APNs push, Resend email, the official Meta WhatsApp adapter, and in-app
records. OpenWA remains an explicit operational adapter with claim/report reconciliation.
Instagram inbound has a webhook contract and lead state model only; no live adapter is claimed.

Adapters accept an immutable snapshot and deterministic delivery key. They classify transient,
permanent, configuration, and ambiguous results. Transient errors use bounded exponential
retry with jitter. An ambiguous WhatsApp transmission moves to `delivery_unknown`, sets
`reconciliation_required`, and is never blindly retried.

Provider webhook bodies are signature-checked before processing, persisted under a unique
provider event key, and applied monotonically. Provider credentials stay server-side.
