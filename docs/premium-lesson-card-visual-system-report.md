# Premium Lesson Card Visual System Report

## Files changed

- `src/lib/lesson-card-variants.ts`
- `src/components/visual/VisualClassCard.tsx`
- `src/components/member/ClassDetailSheet.tsx`
- `src/routes/_authenticated/member/index.tsx`
- `src/routes/_authenticated/member/schedule.tsx`
- `src/styles.css`
- `tests/unit/lessonCardVariants.test.mjs`

## New card variants

- `hero`: rare, section-leading card. Uses a large image only when the image is useful and not repeated from the previous lesson.
- `standard`: default member schedule/home card. Text-first, premium, and brand-led without large photos.
- `compact`: dense-list variant supported by the shared card system. Uses minimal visuals and no photos.

## Visual mode strategy

- `image`: only for eligible `hero` cards.
- `artTile`: branded vector/CSS motif for hero fallback and home standard cards.
- `accent`: schedule/default standard treatment without photo fatigue.
- `minimal`: compact cards.

The helper is covered by `tests/unit/lessonCardVariants.test.mjs`.

## Image strategy

- Standard cards no longer render full photos.
- Compact cards never render photos.
- Hero cards can render a large image, but only when the current lesson has an image and it is not the same as the previous lesson.
- Repeated hero images automatically fall back to the Cloud & Core art tile.
- Member schedule passes `context="memberSchedule"` so normal schedule cards stay non-photo.
- Member home passes `context="memberHome"` so one hero card can be image-led and follow-up cards stay brand-led.

## Repeated-photo fatigue fix

- Replaced the old repeated large-card image path with a reusable `ClassArtTile`.
- Art tiles use inline SVG/CSS motifs for:
  - aerial/floating classes
  - mat/grounded classes
  - hot/heat classes
  - default flow/foundations classes
- Palette stays inside the requested brand colors: navy, ivory, gold, sand, slate, white.

## Class detail modal

- Reworked the detail sheet into a premium booking sheet:
  - header summary with title, date/time, primary chip, state badge
  - controlled visual strip using image only when useful, otherwise art tile
  - key details card for time, duration, instructor, location, spots, credits
  - about/chip section
  - notes/cancellation policy section
  - sticky CTA area
- Booking, waitlist, package, and confirmation logic was not changed.

## RTL/LTR results

- Hebrew/Arabic card content remains `dir="rtl"` and right-aligned.
- English remains `dir="ltr"` and left-aligned.
- Chips and metadata use direction-aware layout.
- Mixed branded titles continue to use the existing `MixedLessonTitle` / `bdi` path.
- Duration, time, and spot labels are formatted by language.

## Responsive results

- Mobile cards use controlled visual tile sizes and wrapping chips.
- Hero visual height is constrained.
- Existing member bottom-nav safe-area padding remains in place.
- Detail sheet has safe-area bottom padding and a sticky CTA area.

## Browser QA

Local dev server: `http://127.0.0.1:4187/`

Checked:

- `/member/schedule` at 390 x 844
- `/member/` at 430 x 932
- `/member/schedule` at 820 x 1180
- `/member/schedule` at 1440 x 900

Result:

- All protected member routes redirected to `/auth` because there was no authenticated local member session.
- Auth redirect had no console errors.
- Auth redirect had no horizontal overflow.
- Protected member card/detail visual QA remains pending behind an authenticated member session.

Screenshots:

- `/var/folders/gj/7lyzfjm53xnbpmnbn4q6v4t00000gp/T/premium-lesson-schedule-mobile.png`
- `/var/folders/gj/7lyzfjm53xnbpmnbn4q6v4t00000gp/T/premium-lesson-home-mobile.png`
- `/var/folders/gj/7lyzfjm53xnbpmnbn4q6v4t00000gp/T/premium-lesson-schedule-ipad.png`
- `/var/folders/gj/7lyzfjm53xnbpmnbn4q6v4t00000gp/T/premium-lesson-schedule-desktop.png`

## Commands run

- `rg "PremiumClassCard|ClassCard|LessonCard|ScheduleCard|CloudCard|class image|image_url|program_type|available_spots|duration|spots" src`
- `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/lessonCardVariants.test.mjs` - passed
- `/Users/ameeramer/.bun/bin/bun run lint` - passed with existing warnings
- `/Users/ameeramer/.bun/bin/bun run build` - passed
- `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs` - passed
- `/Users/ameeramer/.bun/bin/bunx tsc --noEmit` - blocked by existing unrelated dirty worktree errors

## Remaining issues

- `tsc --noEmit` is blocked by existing dirty files unrelated to this UI task:
  - Supabase generated types do not include `sweep_member_credits`.
  - Supabase generated types do not include `sweep_all_members_credits`.
  - `src/lib/dom-patches.ts` has existing TypeScript errors around an untyped `this` and argument count.
- I did not touch schema/migrations/RPC typing because this task explicitly said not to change database schema or run migrations.
- Authenticated member-session browser QA for the actual schedule and detail modal is still needed.
