# Manual provider setup

No credentials are created by this implementation.

- APNs: verify bundle/topic, key/team IDs, environment, and allowlisted test device.
- Resend: configure sender/domain and webhook secret; verify signature tests before enabling.
- Meta WhatsApp: configure WABA/phone ID, access token, app secret, verify token, approved
  locale templates, and sandbox/allowlisted recipients. Reconcile ambiguous delivery manually.
- Instagram: connect the studio Page/Instagram account to the Meta app, subscribe official
  messaging webhooks, map provider IDs to `lead_journeys`, verify signatures, conversation
  windows, and acknowledgment templates. Until then the lead integration is a contract/test
  model only.
- OpenWA: follow the existing local worker runbook; it is not a substitute for official inbound
  Instagram support.

Keep all external channel controls disabled until provider contract tests and allowlisted
end-to-end tests pass.
