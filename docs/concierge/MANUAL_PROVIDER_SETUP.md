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
give its returned handle to the provisioner. Treat the handle as operator configuration and do
not paste access tokens into commands or logs.

```sh
bun scripts/create-whatsapp-templates.mjs --apply --waba-id 1009561255148806 \
  --scope concierge --header-handle "$META_TEMPLATE_IMAGE_HEADER_HANDLE"
```

After Meta approval, re-sync deployment status without creating templates:

```sh
bun scripts/create-whatsapp-templates.mjs --refresh --waba-id 1009561255148806 \
  --scope concierge --header-handle "$META_TEMPLATE_IMAGE_HEADER_HANDLE"
```

`--refresh` reads only from Meta, writes no templates, and updates the scoped deployment records
only when the Supabase service configuration is present. It fails closed for any WABA other than
the confirmed production WABA. Do not use it as a substitute for approval review.

Task 7 operational check: from the production edge, verify the public header URL returns HTTPS
200, `image/webp`, and the intended stable cache policy before promotion. This repository does
not perform that network check.
