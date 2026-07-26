# Concierge Branded Messaging Design

## Objective

Make Concierge email and WhatsApp messages immediately recognizable as Cloud & Core while
preserving accessibility, deliverability, localization, consent, template approval, and safe
rollout behavior.

The visual direction is premium editorial: ivory surfaces, navy typography, restrained gold
accents, elegant spacing, and consistent Cloud & Core identity. Email and WhatsApp share the
same brand system but use channel-specific presentation appropriate to each provider.

## Scope

This project covers:

- a reusable premium email presentation shell;
- branded WhatsApp templates using one shared image header;
- contextual journey actions;
- consistent sender identity;
- branded previews in the Concierge Templates tab;
- approval, test-only validation, rollout, and rollback behavior.

It does not redesign in-app notifications or push notifications. It does not bypass consent,
frequency, locale, provider approval, or live-delivery gates.

## Visual System

### Email

Every Concierge email uses one reusable Cloud & Core shell:

- ivory page background;
- white editorial message card;
- thin gold accent;
- navy typography;
- Cloud & Core wordmark and studio descriptor;
- small localized journey category;
- localized headline and message;
- optional structured facts for booking, schedule, payment, or waitlist details;
- one contextual action button when the message has a useful destination;
- support link and studio footer;
- correct RTL layout for Hebrew and Arabic;
- accessible plain-text fallback.

The core message must remain branded and readable when remote images are blocked. The layout
uses email-safe markup and inline styles compatible with Gmail and Outlook.

### WhatsApp

WhatsApp uses Meta-supported template features rather than attempting arbitrary visual styling:

- one consistent Cloud & Core branded image header;
- concise localized headline and body;
- important details separated into readable lines;
- `Cloud & Core Studio` footer;
- one contextual button where supported;
- minimal functional emoji use;
- Cloud & Core business profile logo and completed business identity.

The shared header asset uses a stable production URL. A missing or invalid media asset must not
cause an invalid WhatsApp template send.

## Content Model

The approved database template remains the source of localized subject and body copy. Branding
is added by channel-specific presentation layers rather than duplicating full email HTML in every
template row.

Each presentation consumes:

- template key and version;
- journey type;
- locale;
- approved localized subject and body;
- validated variables;
- optional structured facts;
- optional safe action destination;
- sender and support configuration.

Email and WhatsApp renderers have separate, explicit contracts. Email markup never enters the
WhatsApp payload.

## Contextual Actions

Buttons appear only when they help the recipient complete a clear task:

| Journey | Default action |
| --- | --- |
| Booking confirmed | View booking |
| Payment requires attention | Review payment |
| Weekly schedule | Explore schedule |
| Waitlist offer | Claim spot |
| Recommendation | View recommendation |
| Informational confirmation | No button |

An unavailable or unsafe destination removes the button without suppressing an otherwise valid
informational message. Button labels and destinations are localized and journey-specific.

## Data Flow

1. Concierge selects the journey, recipient, locale, and approved template version.
2. Required variables and destination data are validated.
3. The presentation registry selects the email or WhatsApp presentation.
4. Email rendering applies the premium shell, structured facts, direction, and optional action.
5. WhatsApp rendering selects the approved Meta template version, header asset, ordered
   parameters, footer, and optional button.
6. The system snapshots the final content, variables, presentation version, and source template
   version with the delivery.
7. Existing provider delivery, retry, reconciliation, and receipt processing continues unchanged.

## Components and Boundaries

### Brand presentation registry

Owns journey category labels, supported facts, CTA labels, and safe destination rules. It exposes
one presentation description per journey and does not send messages.

### Premium email renderer

Accepts validated content and a presentation description. It returns subject, HTML, plain text,
and safe headers. It has no database or provider dependency.

### WhatsApp template payload builder

Accepts validated content, the approved provider deployment, and a presentation description. It
returns the exact Meta template name, language, media header, ordered parameters, and button
parameters. It does not call Meta directly.

### Concierge template preview

Renders the same presentation descriptions and fixtures used by delivery. The Templates tab
supports journey, channel, and language filtering and shows:

- branded email preview;
- WhatsApp header/body/footer/button preview;
- template lifecycle and provider approval status;
- source variables and source copy.

### Provider configuration

Sender-domain configuration, WhatsApp business-profile setup, and Meta approval remain separate
operational tasks documented in the runbook.

## Sender Identity

Email uses:

- sender name `Cloud & Core Studio`;
- a verified studio-domain sender address;
- a consistent reply-to address;
- SPF, DKIM, and DMARC;
- brand logo metadata where inbox providers support it.

WhatsApp uses:

- Cloud & Core logo as the business profile image;
- complete business name, description, contact details, and website;
- the shared branded image header for approved message templates.

Inbox-provider avatars are not guaranteed by HTML email. Sender authentication and provider
profile configuration are the authoritative identity mechanisms.

## Safety and Error Handling

- Missing required variable: suppress the affected channel and create an admin attention item.
- Missing locale approval: suppress the affected channel without locale fallback.
- Missing CTA destination: render the message without a button.
- Missing email image: retain the complete branded text and layout.
- Missing WhatsApp media or deployment approval: do not send the new media template.
- Meta rejection: keep the current approved template active.
- Ambiguous WhatsApp transmission: retain existing no-blind-retry reconciliation behavior.
- Provider delivery failure: retain existing bounded retry policy and delivery evidence.

No rollout step changes consent, recipient resolution, contact caps, quiet hours, test allowlists,
or live-delivery kill switches.

## Approval and Versioning

Branded content and presentations are versioned. Approval records the authenticated approver,
timestamp, content hash, and provider approval where applicable.

New WhatsApp templates receive new Meta names or versions. Existing approved templates remain
available until the replacements are approved and tested. Email presentation changes also receive
a presentation version so delivery evidence identifies the exact branded shell used.

## Testing

Automated tests cover:

- rendering every email journey in English, Hebrew, and Arabic;
- no unresolved variables in subject, body, facts, CTA, HTML, or plain text;
- correct RTL/LTR direction and alignment;
- email-safe escaped content and same-origin safe actions;
- contextual CTA selection and no-button fallbacks;
- deterministic WhatsApp parameter ordering;
- approved provider deployment selection;
- media-header failure behavior;
- template and presentation version snapshotting;
- no change to consent, cap, quiet-hour, or allowlist enforcement.

Manual test-only validation covers:

- Gmail desktop and mobile;
- Outlook rendering;
- images-disabled email;
- narrow mobile width;
- dark-mode tolerance;
- plain-text email;
- WhatsApp previews for all supported locales;
- provider accepted, sent, delivered, failed, and suppressed outcomes.

## Rollout

1. Deploy branded preview capability without changing delivery.
2. Review every email and WhatsApp preview in the Concierge Templates tab.
3. Verify email sender-domain identity.
4. Configure WhatsApp business identity and host the shared header asset.
5. Submit new WhatsApp templates to Meta.
6. Test branded email on the allowlisted recipient in `test_only`.
7. Test approved branded WhatsApp on the allowlisted recipient in `test_only`.
8. Review delivery evidence and content in all three languages.
9. Promote journeys individually after explicit approval.

Rollback selects the previous presentation/template version and does not require deleting delivery
evidence or changing recipient policy.

## Success Criteria

- Email looks recognizably Cloud & Core even when images are disabled.
- WhatsApp is recognizable through business identity, shared header, footer, and concise structure.
- Hebrew, Arabic, and English render correctly.
- Contextual actions are correct and absent when unsafe or unnecessary.
- Every branded version is previewable and auditable.
- No unapproved version reaches a live recipient.
- Existing safety policy and delivery reliability remain intact.
