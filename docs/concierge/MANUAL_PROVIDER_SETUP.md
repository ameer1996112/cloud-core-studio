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

## Production sender identity checklist

- Email sender: Cloud & Core Studio
- Sender domain: verified studio domain
- Reply-To: configured support inbox
- DNS: SPF pass, DKIM pass, DMARC present
- WhatsApp display name: Cloud & Core Studio
- WhatsApp profile: logo, description, website, email, address complete
- Header asset URL: HTTPS 200, correct content type, stable cache policy

Gmail avatars are controlled by Gmail and related identity providers; they are not guaranteed by
email HTML. Do not represent an avatar as a delivery requirement or rely on HTML to set one.

## WhatsApp template header media

The public HTTPS header URL remains the runtime delivery image. Meta template creation is
different: Meta requires an uploaded media handle in an IMAGE header example, not that URL.
Before an authorized apply, upload the approved WebP through the current Graph API media flow and
store its returned handle as `META_TEMPLATE_IMAGE_HEADER_HANDLE` in the protected operator
environment (or the ignored `.env.whatsapp.local`). The provisioner deliberately rejects media
handles passed in process arguments so they do not appear in shell history or process listings.
As a one-shot alternative, pipe the handle to an apply command that includes
`--header-handle-stdin`; the handle itself must never appear in argv.

An authenticated plan performs a read-only Meta reconciliation when `META_WABA_ID`,
`META_GRAPH_API_VERSION`, and `META_ACCESS_TOKEN` are available:

```sh
bun scripts/create-whatsapp-templates.mjs --plan --waba-id 1009561255148806 \
  --scope concierge
```

Use `--local-only` only when an explicitly offline plan is intended. Neither plan form writes Meta
or deployment records.

```sh
bun scripts/create-whatsapp-templates.mjs --apply --waba-id 1009561255148806 \
  --scope concierge
```

After Meta approval, re-sync deployment status without creating templates:

```sh
bun scripts/create-whatsapp-templates.mjs --refresh --waba-id 1009561255148806 \
  --scope concierge
```

`--refresh` reads only from Meta, writes no templates, and updates the scoped deployment records
only when the Supabase service configuration is present. It fails closed for any WABA other than
the confirmed production WABA. Refresh does not require the private media handle because provider
IMAGE-header handles are canonicalized to the public catalog content hash. Do not use it as a
substitute for approval review.

Task 7 operational check: from the production edge, verify the public header URL returns HTTPS
200, `image/webp`, and the intended stable cache policy before promotion. This repository does
not perform that network check.
