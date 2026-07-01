# Strict Premium Lesson Card Final Report

## Scope

Implemented the strict premium lesson card finalization for the real member card system. No migrations, schema changes, booking logic, payment logic, receipt logic, auth logic, RLS logic, or notification logic were changed.

## Files changed

- `src/components/visual/VisualClassCard.tsx`
- `src/components/member/ClassDetailSheet.tsx`
- `src/styles.css`
- `src/lib/i18n.ts`
- `docs/strict-premium-lesson-card-final-report.md`

## Canonical component

Canonical component name: `PremiumLessonReservationCard`

Existing member surfaces still import the older names where needed, but those names now resolve to the same canonical implementation:

- `VisualClassCard`
- `PremiumReservationLessonCard`
- `LessonCard`

Booking previews use the same `premium-lesson-card` shell through `LessonReservationCard`.

## Typography changes

- Promoted the lesson title to the strongest element in the card.
- Desktop title now uses a 26-32px range, `font-weight: 800`, navy color, and tight 1.14 line-height.
- Mobile title uses a 22-26px range with the same hierarchy.
- Metadata is smaller, slate, and tabular where numeric.
- Chips no longer compete with the title.

## Spacing and structure changes

- Replaced separate feature/list visual branches with one strict reservation layout.
- Desktop/tablet cards now use a two-zone grid:
  - LTR: media left, content right.
  - RTL: content right, media left.
- Card dimensions now target the requested 184-220px density.
- CTA and support copy live inside the content area, aligned with the title and metadata.
- Mobile hides the media thumbnail by default to avoid oversized schedule cards.
- No-image cards use a small line accent instead of a giant blank tile.

## Hebrew copy changes

- Changed low-credit state from `צריך לחדש קרדיטים` to `נדרש חידוש קרדיטים`.
- Card support copy now uses:
  - `נדרש חידוש קרדיטים כדי להשלים הזמנה.`
  - `אפשר לשמור מקום לשיעור הזה.`
  - `השיעור מלא כרגע.`
- Primary CTA copy now uses:
  - `חידוש קרדיטים`
  - `פרטים והרשמה`
  - `הצטרפות לרשימת המתנה`

## Image strategy

- Images are rendered only in a reserved media column.
- No image uses absolute positioning over title, chips, metadata, or CTA.
- The existing repeat-image suppression path through `getLessonVisualMode` is preserved.
- Repeated/no-image cards fall back to a small class accent mark.
- Detail modal image is now controlled inside the body and is no longer a dominant hero.

## Screenshots

Stored in `docs/screenshots/strict-premium-lesson-card/`.

- `unauth-member-he-desktop-1440x900.png`
- `unauth-schedule-he-mobile-390x844.png`
- `unauth-schedule-ar-mobile-430x932.png`
- `unauth-schedule-en-ipad-820x1180.png`

These screenshots prove protected route redirect behavior and no horizontal overflow on `/auth`. Authenticated card screenshots were not captured because the documented seeded member account was not valid in the linked Supabase project, and production-linked E2E seeding is blocked by project guardrails.

## Commands run

```bash
/Users/ameeramer/.bun/bin/bun install
/Users/ameeramer/.bun/bin/bunx tsc --noEmit
/Users/ameeramer/.bun/bin/bun run build
/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs
/Users/ameeramer/.bun/bin/bun run lint
git diff --check
```

## Results

- TypeScript: PASS
- Production build: PASS
- i18n unit test: PASS
- Lint: PASS with existing repo warnings, 0 errors
- Whitespace check: PASS
- Unauthenticated route screenshots: PASS, no horizontal overflow
- Console check: NOT FULLY PASSED. The dev server logged auth-page hydration mismatch errors while screenshots changed `cc_lang` in localStorage between Hebrew, Arabic, and English. This was observed on `/auth`, not on an authenticated lesson-card route.

## Remaining issues

- Authenticated visual screenshots for `/member`, `/member/schedule`, and the class detail modal still need a valid member session. The known `e2e_member@test.local` credentials returned invalid credentials in this linked project.
- I did not create or seed test users because this checkout is linked to the blocked production Supabase project.
- The existing auth-language hydration mismatch should be handled separately if the final QA checklist requires a clean console across language switching on `/auth`.
