# Global Member Lesson Card Production Fix Report

Date: 2026-06-30

## Lesson-card inventory

Found member lesson/class card surfaces:

- `/member`: recommended class, recommended list, next booking Cloud Card, upcoming booking mini preview, class detail sheet.
- `/member/schedule`: day sections, schedule class rows, filter panel around the list, class detail sheet.
- `/member/bookings`: upcoming/past/cancelled booking cards, waitlist cards, cancel dialog preview, class detail sheet.
- `/member/packages`: no lesson/class card renderer; uses shared member empty-state helpers only.
- Shared visual components: `VisualClassCard`, `VisualClassCardMini`, `LessonReservationCard`, `ClassDetailSheet`, `ClassArtTile`, `ClassImage`, `CloudCardVisual`.

## Canonical component

Canonical production family:

- `src/components/visual/VisualClassCard.tsx`
- `LessonCard` alias for standard lesson cards.
- `VisualClassCardMini` for compact upcoming previews.
- `LessonReservationCard` for bookings and waitlist reservation cards.
- `ClassDetailSheet` uses the same visual-mode helpers and art/image rules.

The exported production contract is now:

```ts
type LessonCardVariant = "featured" | "standard" | "compact" | "booking";
type LessonCardContext =
  | "memberHome"
  | "memberSchedule"
  | "memberBookings"
  | "classDetail"
  | "bookingConfirmation"
  | "adminSchedule";
```

## Files changed

- `src/lib/lesson-card-variants.ts`
- `src/components/visual/VisualClassCard.tsx`
- `src/components/member/ClassDetailSheet.tsx`
- `src/components/member/PremiumClassCard.tsx`
- `src/routes/_authenticated/member/index.tsx`
- `src/routes/_authenticated/member/schedule.tsx`
- `src/routes/_authenticated/member/bookings.tsx`
- `src/styles.css`
- `src/integrations/supabase/types.ts`
- `src/lib/dom-patches.ts`

## Old layouts removed or retired

- Removed the unused image-heavy `PremiumClassCard` component implementation. The file still provides shared helpers such as state, image, empty-state, date, and duration utilities.
- Retired the separate `/member/bookings` full-photo `BookingCard` layout by rendering booking content through `LessonReservationCard`.
- Retired the separate waitlist photo grid by rendering waitlist entries through `LessonReservationCard`.
- Schedule and home now pass canonical variants instead of route-specific variant names.

## Image repetition strategy

- Only `featured` cards can use large class imagery.
- `standard`, `compact`, and `booking` cards avoid repeated full-photo panels.
- Schedule cards use brand art/accent tiles instead of repeated class photos.
- Bookings and waitlist use reservation-focused no-photo layouts.
- `getLessonVisualMode` prevents adjacent duplicate featured images and returns minimal modes for compact/booking cards.

## RTL/LTR and localization fixes

- Lesson card variants now receive explicit context and keep `dir={dir}` at card roots.
- Reservation cards use `text-start`, logical CSS, and `<bdi>` around mixed text.
- Duration and spots labels are produced by localized helpers: Hebrew, Arabic, and English use language-specific labels instead of raw database values.
- Detail sheet now uses the canonical `classDetail` context and keeps image positioning consistent with the shared image resolver.

## Screenshots

Screenshots were captured with Playwright using system Chrome:

- `docs/screenshots/member-mobile.png`
- `docs/screenshots/member-schedule-mobile.png`
- `docs/screenshots/member-desktop.png`
- `docs/screenshots/member-schedule-desktop.png`

Remaining screenshot limitation: local browser access to `/member` and `/member/schedule` redirected to `/auth` because there was no active local member session. No QA/test data was created and auth was not bypassed.

## Commands run

```bash
/Users/ameeramer/.bun/bin/bunx tsc --noEmit
/Users/ameeramer/.bun/bin/bun run lint
/Users/ameeramer/.bun/bin/bun run build
/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs
/Users/ameeramer/.bun/bin/bun run dev -- --host 127.0.0.1 --port 5173
```

Results:

- Typecheck passed.
- Lint passed with existing warnings.
- Build passed.
- i18n unit test passed.
- Browser screenshots captured, but protected routes redirected to auth.

## Remaining issues

- Visual QA inside authenticated member routes still needs an existing member session or production/staging credentials.
- The repo has many existing lint warnings unrelated to this card-system change.
- The working tree already contained unrelated modified files before this fix; they were not reverted.

## Production deployment

Deployment completed: YES

- Cloud Build id: `fe1283bb-4a4f-4ee6-a6a9-b39f46910ec0`
- Image: `me-west1-docker.pkg.dev/cloudandcorestudio/cloud-core/cloud-core-studio:20260630150449-lesson-cards`
- Cloud Run service: `cloud-core-studio`
- Cloud Run project: `cloudandcorestudio`
- Cloud Run region: `me-west1`
- Revision: `cloud-core-studio-00163-hqq`
- Traffic: 100%
- Cloud Run URL: `https://cloud-core-studio-190584124070.me-west1.run.app`
- Firebase front door: `https://cloudandcorestudio.web.app`

Post-deploy smoke:

- Cloud Run `/auth`: `200`
- Cloud Run `/member`: `307` to `/auth`
- Cloud Run `/member/schedule`: `307` to `/auth`
- Cloud Run `/admin`: `307` to `/auth`
- Firebase `/auth`: `200`
- Firebase `/member`: `307` to `/auth`
- Firebase `/member/schedule`: `307` to `/auth`
