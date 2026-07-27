# Premium WhatsApp Concierge Design

## Objective

Make every Cloud & Core Concierge WhatsApp message feel like personal service from a boutique
studio while remaining useful, quickly scannable, localized, and safe to deliver through Meta
templates.

The existing branded image header remains. This project improves the message itself: voice,
information hierarchy, event relevance, signature, and contextual action.

## Approved Direction

The selected direction is **Boutique Concierge Cards**:

- personal boutique-concierge voice;
- essential event details rather than full account data;
- signature `ירין | Cloud & Core`;
- at most one restrained, context-appropriate emoji;
- one contextual action button when it helps the member;
- native Hebrew, Arabic, and English copy rather than literal translations.

## Message Structure

Operational messages use this consistent rhythm:

1. Personal opening using the member's name.
2. Short journey-specific headline.
3. Essential facts grouped on separate lines.
4. One helpful closing sentence.
5. Localized personal signature.
6. One contextual action button when useful and safe.

Hebrew booking-confirmation example:

```text
היי נועה, המקום שלך נשמר 🤍

*פילאטיס מזרן*
יום שישי, 24.07 · 18:00
עם ירין · הסטודיו הראשי

הכול מוכן לקראת השיעור.
ירין | Cloud & Core
```

The action is `צפייה בהזמנה`.

Messages must not contain technical language, generic account-update wording, duplicated details,
long paragraphs, unresolved variables, literal escape sequences, or empty fact labels. Dates and
times use natural locale-aware formatting. Negative events use calm, direct language and do not
use celebratory phrasing.

## Journey Content

Each journey owns an explicit fact set and action:

| Journey | Essential facts | Default action |
| --- | --- | --- |
| Member welcome | Member name and one clear next step | View schedule |
| Booking confirmed | Class, localized date/time, instructor, location | View booking |
| Booking cancelled | Class, localized date/time, concise credit outcome | Optional booking review |
| Class cancelled | Class, cancelled date/time, location | View schedule |
| Class time changed | Class, revised date/time, instructor or location when useful | View schedule |
| Waitlist accepted | Class and confirmed date/time | View booking |
| Payment confirmed | Package, amount, receipt availability | View receipt when available |
| Payment requires attention | Package, amount or renewal date, calm next step | Review payment |
| Membership expiring | Package, expiration date, remaining credits | View packages |
| Recommendation | One or two concise class options | View schedule |
| Urgent announcement | Actual relevant announcement summary | View details when available |

Internal identifiers, receipt codes, duplicate dates, unrelated credit counts, raw database
fields, and empty optional values are excluded.

## Voice and Localization

The voice is warm, elegant, useful, and personal. It should feel as if Yareen is helping the
member directly without pretending that an automated message is a live conversation.

- Use one warm opening and one short closing.
- Prefer concrete next steps over promotional language.
- Keep the studio name out of the body when the header, business identity, or signature already
  establishes the sender.
- Use no more than one emoji, and omit it for sensitive payment or cancellation messages when it
  would feel inappropriate.
- Use localized signature equivalents while preserving the name and brand.
- Author copy natively for Hebrew, Arabic, and English.

## Components and Boundaries

### Journey presentation registry

Defines the headline, supported facts, required and optional variables, closing, emoji policy,
signature, action label, and safe destination for each journey and locale. It does not send
messages or call Meta.

### WhatsApp template definition builder

Transforms one presentation definition into the exact Meta template components: existing branded
image header, body text, footer when needed, and optional URL button. It publishes a deterministic
ordered parameter contract for each template.

### Delivery payload builder

Accepts validated event variables and an approved template deployment. It returns the exact
template name, language, image header, body parameters, and button parameters. It does not choose
copy or perform provider calls.

### Preview and test fixtures

The Concierge Journey Lab uses the same presentation definitions and parameter contracts as
production delivery. Preview fixtures contain realistic event-specific values and never introduce
preview-only copy paths.

## Data Flow

1. A Concierge event resolves the member, locale, preferences, and structured event variables.
2. The journey presentation registry selects the localized premium definition.
3. Required variables are validated; absent optional facts are omitted cleanly.
4. The payload builder selects an approved Meta deployment and applies deterministic parameters.
5. Delivery snapshots the presentation version, template version, rendered variables, action, and
   provider payload.
6. Existing provider delivery, receipt reconciliation, retry, consent, quiet-hour, and frequency
   controls continue unchanged.

## Error and Safety Behavior

- Missing optional variable: omit the entire optional line.
- Missing required variable: suppress only the WhatsApp delivery and create an administrator
  attention item.
- Replacement awaiting Meta approval: keep the current approved template active.
- Missing or unsafe destination: send the useful informational message without a button.
- Missing or invalid branded header: do not attempt the new template.
- Marketing opt-out: suppress recommendation and retention WhatsApp messages.
- Missing locale approval: suppress without silently falling back to another language.
- Ambiguous provider transmission: retain the existing no-blind-retry reconciliation behavior.

The work does not weaken consent, allowlist, live-mode, quiet-hour, frequency-cap, or provider
approval safeguards.

## Versioning and Meta Approval

Every changed WhatsApp body receives a new Meta template version/name. Existing approved templates
remain active throughout submission and review. A new version becomes eligible only when:

1. Meta marks the exact locale approved.
2. The local deployment registry matches the approved content hash.
3. Its Journey Lab preview is approved.
4. It passes allowlisted delivery testing.

Rollout occurs journey by journey. Rollback selects the previous approved template without
deleting delivery evidence.

## Testing

Automated tests cover:

- every required journey in Hebrew, Arabic, and English;
- required and optional fact selection;
- locale-aware dates, times, direction, signature, and action labels;
- no unresolved placeholders, literal escape sequences, empty lines, or duplicate facts;
- at most one permitted emoji;
- calm negative-event copy;
- deterministic Meta parameter ordering;
- approved deployment selection and previous-version fallback;
- safe action destinations and no-button behavior;
- unchanged consent, marketing opt-out, allowlist, cap, and quiet-hour behavior.

Allowlisted end-to-end testing covers:

- rendered body and image header;
- button destination and native application routing;
- Meta accepted, delivered, read, failed, and suppressed evidence;
- all operational journeys supported by WhatsApp;
- explicit confirmation that marketing opt-outs remain suppressed.

## Success Criteria

- A member can understand the event and next step without opening the application.
- The message is scannable in a few seconds.
- The body feels as premium and intentional as the branded header.
- Every fact is relevant to the triggering event.
- Copy feels personal without being misleading or overly promotional.
- Hebrew, Arabic, and English are natural and structurally consistent.
- Existing approved delivery continues while replacements await Meta approval.
- No new version reaches live recipients before allowlisted evidence is approved.
