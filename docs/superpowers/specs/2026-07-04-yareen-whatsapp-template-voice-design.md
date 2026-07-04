# Yareen WhatsApp Template Voice Design

## Purpose

Upgrade the WhatsApp notification templates so they feel like a personal message from Yareen, not a system notification. The goal is to make automatic studio communication feel premium, warm, and human while keeping every message short enough for WhatsApp.

This design covers WhatsApp member-facing templates only. Email templates, admin-only notifications, queue mechanics, OpenWA session handling, and database schema are out of scope.

## Current Context

Notification copy is centralized in `src/lib/notificationTemplates.ts`. WhatsApp copy is currently generated from fallback bodies by event key and language. The current production direction is Hebrew-only WhatsApp sends, even when a member's preferred language is different.

The automatic OpenWA event set currently includes:

- `payment_confirmed`
- `booking_confirmed`
- `class_reminder_24h`
- `waitlist_spot_available`
- `class_cancelled_by_admin`
- `class_time_changed`
- `registered_no_action`
- `package_approved_no_booking`
- `first_lesson_followup`
- `low_credits`
- `package_expiring_soon`
- `no_upcoming_booking_14d`

Other templates such as `class_reminder_2h`, `waitlist_joined`, `receipt_issued`, and cancellation confirmations may still exist for draft/manual use, but should receive the same voice treatment when they are WhatsApp member messages.

## Voice Direction

Use a warm personal voice from Yareen.

The message should feel like Yareen wrote it directly:

- personal, calm, and caring
- polished but not corporate
- concise, with no marketing language
- clear about the action or update
- lightly emotional, not overly excited
- usually signed `ירין` when the message benefits from a personal close

The tone should avoid:

- system-like phrasing such as "הודעת מערכת", "בקשתך התקבלה", or "נרשמת בהצלחה"
- too many emojis
- long explanations
- mixed Hebrew/English except for the studio name or class/package names that are already stored that way
- pressure-heavy sales language

## Message Structure

Most WhatsApp messages should follow this shape:

```text
{{member_name}}, [warm human sentence]

[important class/package/detail block]

[small next step, reassurance, or close]
ירין
```

For operational updates where a signature may feel too heavy, the close can be omitted. For lifecycle and relationship messages, the signature should usually be included.

## Template Coverage

### Booking Confirmed

Purpose: confirm the member's place and make the upcoming visit feel personal.

Example:

```text
{{member_name}}, איזה כיף שהמקום שלך נשמר 🤍

{{class_name}}
{{class_date}} · {{class_time}}
עם {{instructor_name}}

מחכה לראות אותך בסטודיו
ירין
```

### Payment Confirmed

Purpose: confirm trust and package activation without sounding like a receipt.

Example:

```text
{{member_name}}, התשלום אושר והחבילה שלך פעילה ✨

{{package_name}}

תוכלי לבחור שיעור ולהמשיך בקצב שמתאים לך.
ירין
```

### Package Approved, No Booking

Purpose: nudge the member to use the active package.

Example:

```text
{{member_name}}, החבילה שלך כבר מחכה לך ✨

{{package_name}}

נשאר רק לבחור שיעור ראשון. אם תרצי עזרה להתחיל, אני כאן.
ירין
```

### Registered, No Action

Purpose: welcome the member and invite a first step without pressure.

Example:

```text
{{member_name}}, ברוכה הבאה ל-{{studio_name}} 🤍

ראיתי שפתחת חשבון ועדיין לא בחרת שיעור.
אם תרצי, אעזור לך למצוא התחלה שמתאימה לקצב שלך.

ירין
```

### 24 Hour Class Reminder

Purpose: calm reminder with class details.

Example:

```text
{{member_name}}, תזכורת קטנה למחר 🤍

{{class_name}}
{{class_date}} · {{class_time}}
עם {{instructor_name}}

מחכה לראות אותך בסטודיו
ירין
```

### Class Time Changed

Purpose: clear update, no panic, no excess emotion.

Example:

```text
{{member_name}}, עדכון קטן לשעת השיעור

{{class_name}}
{{class_date}} · {{class_time}}

אם השעה החדשה לא מסתדרת לך, כתבי לי.
ירין
```

### Class Cancelled By Admin

Purpose: apologize and keep trust.

Example:

```text
{{member_name}}, עדכון מהסטודיו

{{class_name}}
{{class_date}} · {{class_time}}

השיעור לא יתקיים הפעם.
אם תרצי, אעזור לך למצוא שיעור חלופי.
ירין
```

### Waitlist Spot Available

Purpose: make the opened spot feel special and time-sensitive without pressure.

Example:

```text
{{member_name}}, התפנה לך מקום 🤍

{{class_name}}
{{class_date}} · {{class_time}}

אם זה מתאים לך, אפשר להשלים את ההזמנה עכשיו.
ירין
```

### First Lesson Follow-Up

Purpose: relationship-building after attendance.

Example:

```text
{{member_name}}, שמחתי לראות אותך היום בסטודיו 🤍

מקווה שהשיעור הרגיש נעים וטוב בגוף.
כשתרצי להמשיך, אעזור לך לבחור את השיעור הבא.

ירין
```

### Low Credits

Purpose: useful account nudge, not hard sell.

Example:

```text
{{member_name}}, נשארו לך {{credits_remaining}} כניסות בחבילה

אם תרצי לשמור על רצף, אפשר לבחור את החבילה הבאה בזמן שנוח לך.
אני כאן אם תרצי עזרה.
ירין
```

### Package Expiring Soon

Purpose: timely reminder with continuity.

Example:

```text
{{member_name}}, החבילה שלך מסתיימת בקרוב

{{package_name}}
בתוקף עד {{expires_on}}

אם תרצי להמשיך ברצף, אני כאן לעזור.
ירין
```

### No Upcoming Booking For 14 Days

Purpose: gentle reactivation.

Example:

```text
{{member_name}}, התגעגענו אלייך בסטודיו 🤍

אם מתאים לך לחזור השבוע, אעזור לך למצוא שיעור שמתאים לקצב שלך.
ירין
```

## Delivery Constraints

The copy upgrade must not change queueing or delivery behavior. Current OpenWA testing showed reliable sending when replying to a member's existing WhatsApp chat id. Production automation should remain guarded by the existing dry-run/queue controls until chat-id based delivery is explicitly implemented and verified.

## Testing

Update unit tests that assert exact Hebrew WhatsApp copy in `tests/unit/notificationTemplates.test.mjs`.

Add or keep checks that:

- WhatsApp member copy for key events renders the new Yareen voice.
- Variables still render correctly.
- WhatsApp remains Hebrew-only where that behavior is already enforced.
- Email rendering is not accidentally changed.
- Admin notification copy is not changed.

## Non-Goals

- No database schema changes.
- No OpenWA delivery architecture changes.
- No UI redesign.
- No changes to email templates except where tests need to verify they remain unchanged.
- No broad rewrite of Arabic or English copy while WhatsApp is intentionally Hebrew-only.
