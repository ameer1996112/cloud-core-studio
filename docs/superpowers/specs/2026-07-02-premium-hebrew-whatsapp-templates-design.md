# Premium Hebrew WhatsApp Templates Design

## Summary

Upgrade the member-facing Hebrew WhatsApp notification copy from plain operational text to a premium boutique-studio voice.

This pass is intentionally narrow:

- Hebrew only
- WhatsApp only
- member-facing messages only
- the six highest-visibility actions only

The approved style direction is:

- neutral voice
- minimal emoji usage
- luxury boutique tone

## Goals

- Make key WhatsApp notifications feel premium, calm, and branded
- Keep messages fast to scan on mobile
- Standardize structure so the system feels coherent across events
- Preserve all current variables and business triggers
- Avoid chatty, noisy, or marketing-heavy wording

## Non-Goals

- No trigger-policy changes in this pass
- No email rewrite in this pass
- No Arabic or English copy changes in this pass
- No database or delivery-logic changes in this pass
- No admin/internal notification copy redesign

## Scope

Rewrite the Hebrew WhatsApp templates for these six events:

- `payment_confirmed`
- `booking_confirmed`
- `class_reminder_24h`
- `waitlist_spot_available`
- `class_cancelled_by_admin`
- `class_time_changed`

All other notification events keep their current wording for now.

## Current State

The current Hebrew WhatsApp bodies are functional but generic. They read like system notices:

- flat greeting-first structure
- little brand personality
- inconsistent emotional tone across events
- no shared premium template pattern

The notification system already supports per-event, per-language, per-channel templates. This work should reuse that structure and only replace copy in the existing default/fallback Hebrew WhatsApp definitions.

## Recommended Approach

Use a single premium writing system across the six selected events instead of treating each message as a standalone sentence rewrite.

That writing system should enforce:

1. short headline-style first line
2. one practical detail block
3. one soft closing line
4. at most one tasteful emoji, only when it adds warmth

This approach is better than ad hoc rewrites because it creates recognizable message quality across confirmations, reminders, and schedule changes.

## Voice Rules

### Tone

- calm
- polished
- elevated
- concise

### Tone to avoid

- loud excitement
- sales language
- excessive friendliness
- overuse of exclamation marks
- emoji chains

### Language choices

- Use neutral Hebrew that works for a broad member base
- Prefer short phrases over full dense paragraphs
- Keep practical details on separate lines when useful
- End with a soft studio sign-off rather than a bureaucratic closing

## Emoji Rules

Emoji use is minimal and intentional.

- zero or one emoji per message
- emoji should appear only in the opening line
- use soft premium symbols such as `✨`, `🕊️`, `🤍`, `⏰`
- do not use loud or promotional emoji such as `🔥`, `🚀`, `🎉`

Recommended emoji usage by event:

- `payment_confirmed`: `✨`
- `booking_confirmed`: `🕊️`
- `class_reminder_24h`: `⏰`
- `waitlist_spot_available`: `🤍`
- `class_cancelled_by_admin`: no emoji by default
- `class_time_changed`: no emoji by default

## Template Structure

Each premium WhatsApp message should follow one of two approved patterns.

### Pattern A: confirmation and reminder

Used for:

- `payment_confirmed`
- `booking_confirmed`
- `class_reminder_24h`
- `waitlist_spot_available`

Structure:

1. short premium opener
2. essential details block
3. soft closing line

### Pattern B: operational update

Used for:

- `class_cancelled_by_admin`
- `class_time_changed`

Structure:

1. clear update line
2. change details
3. calm next-step or reassurance line

## Event Designs

### 1. `payment_confirmed`

Purpose:
Confirm approval clearly while making the moment feel elevated.

Message shape:

```text
✨ התשלום שלך אושר
עבור {{package_name}}
נשמח להמשיך לארח אותך ב-{{studio_name}}
```

Notes:

- no receipt details here
- no over-celebration
- premium reassurance is the goal

### 2. `booking_confirmed`

Purpose:
Make the class confirmation feel elegant and welcoming.

Message shape:

```text
🕊️ ההזמנה שלך אושרה
{{class_name}} · {{class_date}} · {{class_time}}
עם {{instructor_name}}
נשמח לראות אותך ב-{{studio_name}}
```

Notes:

- practical details stay compact
- sign-off should feel boutique, not transactional

### 3. `class_reminder_24h`

Purpose:
Provide a gentle premium reminder without sounding urgent.

Message shape:

```text
⏰ תזכורת עדינה לקראת השיעור שלך
{{class_name}} · {{class_date}} · {{class_time}}
עם {{instructor_name}}
נשמח לראות אותך ב-{{studio_name}}
```

Notes:

- “תזכורת עדינה” fits the approved luxury tone
- no pressure language

### 4. `waitlist_spot_available`

Purpose:
Turn the waitlist offer into a high-value personal invitation.

Message shape:

```text
🤍 התפנה מקום עבורך
{{class_name}} · {{class_date}} · {{class_time}}
אם זה מתאים לך, אפשר להשלים את ההזמנה עכשיו
```

Notes:

- should feel personal and timely
- should not sound like a mass alert

### 5. `class_cancelled_by_admin`

Purpose:
Deliver a cancellation clearly, calmly, and with care.

Message shape:

```text
עדכון לגבי השיעור שלך
{{class_name}} בתאריך {{class_date}} בשעה {{class_time}} לא יתקיים
נעדכן אותך בכל אפשרות חלופית רלוונטית
```

Notes:

- no emoji by default
- avoid apology overload or cold system wording

### 6. `class_time_changed`

Purpose:
Communicate the time change with minimal friction.

Message shape:

```text
השעה של השיעור שלך עודכנה
{{class_name}} · {{class_date}} · {{class_time}}
נשמח לראות אותך ב-{{studio_name}}
```

Notes:

- the update must be unmistakable
- keep the new time prominent

## Components Affected

- `src/lib/notificationTemplates.ts`

Potentially also:

- `src/routes/_authenticated/admin/messages.tsx`

Only if the admin template-management screen contains duplicated seeded Hebrew copy that should match the new premium defaults. If the route only reads from the shared template layer, no route-level copy change is needed.

## Data Flow

No data-flow changes are required.

The existing notification generation path remains:

1. business event occurs
2. event resolves language and channel
3. template body is selected
4. variables are rendered
5. notification row is created or displayed

This work only changes the selected Hebrew WhatsApp text bodies for the scoped events.

## Error Handling

No new runtime error cases are expected because:

- template variables are unchanged
- event keys are unchanged
- channel and language keys are unchanged

Main implementation risk is copy drift between default templates and fallback templates. The implementation should keep both aligned wherever the system relies on both.

## Testing

### Unit and rendering checks

- scoped events render the new Hebrew WhatsApp bodies
- existing variables still interpolate correctly
- non-scoped events remain unchanged
- email templates remain unchanged
- Arabic and English templates remain unchanged

### Manual QA

1. Open the admin messages template view.
2. Verify the six Hebrew WhatsApp templates show the new premium copy.
3. Generate at least one draft for a booking confirmation and payment confirmation.
4. Confirm the final rendered message keeps line breaks and variable interpolation.
5. Confirm reminders and operational updates still read clearly on mobile.

## Rollout

Roll this out as a copy-only change.

- no migration
- no feature flag required
- no backfill required

Existing queued or already-rendered rows may keep old copy. New rows generated after deployment should use the premium Hebrew WhatsApp text.

## Success Criteria

- the six selected Hebrew WhatsApp notifications feel recognizably more premium
- messages remain clear in one quick read
- operators do not need new workflow training
- no regressions in rendering or variable substitution
