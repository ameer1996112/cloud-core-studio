# Lesson Availability Meter Design

## Goal

Add a premium availability meter to member lesson cards so members can quickly see how many spots are left and feel appropriate urgency when a class is close to full.

The tone should be boutique urgency, not cheap fear. Copy should encourage action without sounding like a system warning or discount funnel.

## Scope

In scope:

- Member dashboard lesson cards.
- Member schedule lesson cards.
- Booking and continuation lesson cards that reuse the shared card system.
- Class detail modal summary.
- Hebrew, Arabic, and English copy.
- RTL-safe alignment for copy, numbers, and the progress fill.

Out of scope:

- Booking rules.
- Payments.
- Database schema.
- RLS.
- Backend business logic.
- Admin screen redesign.

## Design

Create one shared `LessonAvailabilityMeter` UI unit fed by the existing lesson fields:

- `capacity`
- `booked_count`
- derived `spotsLeft`
- derived `bookedRatio`
- current language and direction

The meter appears below the chips/status area and above the CTA or detail grid. It uses the Cloud & Core palette:

- Soft ivory surface.
- Sand border.
- Warm gold progress fill.
- Deep navy for strong urgency text.
- Soft slate for supporting text.

The meter includes:

- A short right-aligned label.
- A slim rounded progress bar.
- Optional low-availability emphasis when spots are close to full.

For RTL languages, the whole meter uses `dir="rtl"` and `text-align: start`. Numeric fragments may use isolated LTR spans where needed. The progress fill should feel natural in the card direction: Hebrew/Arabic fill anchors from the right, English from the left.

## Copy Rules

Hebrew:

- Normal availability: `{count} מקומות פנויים`
- Low availability: `נותרו {count} מקומות בלבד`
- One spot: `נותר מקום אחד בלבד`
- Full: `רשימת המתנה פתוחה`

Arabic:

- Normal availability: `{count} أماكن متاحة`
- Low availability: `تبقى {count} أماكن فقط`
- One spot: `تبقى مكان واحد فقط`
- Full: `قائمة الانتظار مفتوحة`

English:

- Normal availability: `{count} spots open`
- Low availability: `Only {count} spots left`
- One spot: `Only 1 spot left`
- Full: `Waitlist open`

Low availability triggers when `spotsLeft <= 2` or when at least 75% of capacity is booked. Classes with missing or zero capacity should fall back to the existing availability text and avoid rendering a misleading progress bar.

## Components

`LessonAvailabilityMeter`

- Pure presentational component.
- Accepts `capacity`, `bookedCount`, `lang`, and `dir`.
- Computes safe display values locally or via a small helper in `lesson-card-variants.ts`.
- Does not fetch, mutate, or change booking state.

Use it in:

- `VisualClassCard` / `PremiumLessonReservationCard`.
- `LessonReservationCard`.
- `ClassDetailSheet`.

## Testing

Run targeted formatting and lint checks on changed files, then build:

- `bunx prettier --check ...`
- `bunx eslint ...`
- `bun run build`

Manual QA targets:

- Mobile width around 390px.
- Tablet width.
- Desktop width.
- Hebrew RTL: label starts from the right, fill anchors from the right.
- English LTR: label starts from the left, fill anchors from the left.
- Modal detail: meter is visible without crowding the summary.

## Acceptance Criteria

- Every shared member lesson card shows a consistent availability meter when capacity is known.
- Low availability copy adds premium urgency without aggressive wording.
- Hebrew and Arabic meter content is right-aligned and directionally correct.
- The meter does not change booking behavior or backend logic.
- The CTA remains visually dominant and tappable.
