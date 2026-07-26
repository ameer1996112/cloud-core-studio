# Transactional email design and deliverability

## Runtime contract

The canonical worker renders email with `src/lib/transactionalEmail.ts` before calling Resend. The
renderer is provider-independent and returns a subject, compact Outlook-safe HTML, full plain text,
and a non-PII `X-Entity-Ref-ID`. The Resend adapter owns transport and retry only.

The visual system is deliberately text-led: ivory canvas, white 600px letter, navy text, restrained
gold rule, live-text wordmark, localized event kicker, one clear action, and a human studio closing.
It does not depend on remote images, web fonts, SVG, flexbox, grid, JavaScript, or background images.
It remains identifiable and usable when an email client blocks images or rewrites dark mode.

Hebrew and Arabic set `lang`, `dir=rtl`, and explicit right alignment. English sets `dir=ltr` and
left alignment. Dates, times, amounts, receipt numbers, subjects, bodies, variables, and URLs are
escaped or direction-isolated. Action links are accepted only when they resolve to HTTPS on the
configured `MESSAGING_PUBLIC_BASE_URL` origin.

## Current production audit (2026-07-22)

- Resend domain: `mail.cloudandcorestudio.com`
- Resend status: verified; sending enabled
- DKIM: verified
- Resend return-path SPF MX/TXT: verified
- Resend open tracking: disabled
- Resend click tracking: disabled
- DMARC: **missing** at `_dmarc.cloudandcorestudio.com`
- Current issue reproduced: a rapid 22-message all-events staff test reached Outlook's Junk folder
  and the old renderer showed only a single unformatted paragraph.

The code fix addresses presentation, multipart content, link safety, and stable message identity.
It cannot create DNS trust by itself. The missing DMARC record remains a production configuration
gate.

## Safe initial DMARC record

The authoritative DNS provider is Spaceship (`launch1.spaceship.net`, `launch2.spaceship.net`). Add
this monitoring-only record first:

| Field | Value                                         |
| ----- | --------------------------------------------- |
| Type  | `TXT`                                         |
| Host  | `_dmarc`                                      |
| Value | `v=DMARC1; p=none; sp=none; adkim=r; aspf=r;` |
| TTL   | Automatic/default                             |

Do not move directly to `quarantine` or `reject`. First send from every legitimate service that uses
`@cloudandcorestudio.com`, inspect headers for `spf=pass`, `dkim=pass`, and `dmarc=pass`, and monitor
for several days. Add a `rua` address only after a real mailbox exists to receive aggregate XML
reports. Then tighten the policy gradually.

## Sender configuration

Use one stable sender on the exact verified Resend domain:

```dotenv
MESSAGING_EMAIL_FROM="Cloud & Core Studio <studio@mail.cloudandcorestudio.com>"
MESSAGING_EMAIL_REPLY_TO="cloudandcorestudio@gmail.com"
MESSAGING_PUBLIC_BASE_URL="https://cloudandcorestudio.com"
```

The From address does not need an inbox because Resend sends for the verified domain. Reply-To is
required and must remain a real monitored mailbox; the adapter fails closed before contacting
Resend when it is absent or invalid. Replace the Gmail Reply-To with a branded mailbox only after
that mailbox has been created and a reply test succeeds.

## Controlled verification

1. Keep `MESSAGING_DELIVERY_MODE=allowlist` and email limited to the verified staff address.
2. Publish DMARC and wait for public DNS resolution.
3. Deploy the premium renderer and stable From identity.
4. Send one subscription-renewal-failed Journey Lab email.
5. In Resend, confirm both HTML and Plain Text previews exist and delivery reaches `delivered`.
6. In Outlook, inspect message source and confirm SPF, DKIM, and DMARC pass.
7. If Outlook still places the authenticated message in Junk, mark that single legitimate message
   as Not Junk and avoid another burst. Reputation improves from consistent, low-complaint traffic;
   it is not guaranteed by HTML or DNS alone.
8. Repeat with one booking confirmation and one receipt, several minutes apart. Confirm the CTA
   remains on `https://cloudandcorestudio.com`.

## Rollback

Set `MESSAGING_EMAIL_ENABLED=false` for the immediate kill switch. Revert the application image to
the previous revision if rendering must be rolled back. Leave the monitoring-only DMARC record in
place unless it was malformed; it does not reject mail. Canonical message and delivery records stay
intact, so failed/suppressed deliveries can be reconciled with their existing idempotency keys.
