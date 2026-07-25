# Security and privacy

Concierge administration requires the existing admin role. New tables have RLS and service-role
worker access; worker RPCs are revoked from authenticated users. Studio identity is present in
all new keys and rows.

Logs contain correlation IDs, reason codes, status, latency, and redacted provider errors—not
message bodies, tokens, full phone numbers, or payment details. Push lock-screen copy avoids
sensitive payment and child information. Snapshots support `redact_after`/`redacted_at`; account
deletion must anonymize recipient addresses and snapshots while retaining non-personal audit
evidence.

Inbound webhooks require signatures and replay protection. Configuration/template changes
record the authenticated approver and must also be written to the existing admin audit log by
the admin service.
