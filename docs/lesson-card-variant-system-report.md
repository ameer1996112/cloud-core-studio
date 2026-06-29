# Lesson Card Variant System Report

## Files changed

- `src/lib/lesson-card-variants.ts`
- `src/components/visual/VisualClassCard.tsx`
- `src/routes/_authenticated/member/index.tsx`
- `src/routes/_authenticated/member/schedule.tsx`
- `src/styles.css`
- `tests/unit/lessonCardVariants.test.mjs`

## Variant system implemented

- Added `featured`, `standard`, and `compact` lesson-card variants.
- `featured` keeps a large image-led card for the first/highlighted lesson.
- `standard` is a premium text-first card with chips, time, state, duration, instructor/location, and capacity copy.
- `compact` is supported by the shared component and helper layer for denser future use.
- Added the requested CSS hooks:
  - `.lesson-card`
  - `.lesson-card--featured`
  - `.lesson-card--standard`
  - `.lesson-card--compact`
  - `.lesson-card__media`
  - `.lesson-card__content`
  - `.lesson-card__chips`
  - `.lesson-card__meta`
  - `.lesson-card__time-badge`

## Image repetition strategy

- Added `getLessonVisualMode(...)` and `shouldUseImageCard(...)`.
- Rules:
  - first featured card with an image uses `featured-image`
  - adjacent repeated images fall back to `accent`
  - every fourth non-repeated standard card may use `thumbnail`
  - compact cards use `accent`
- Member home:
  - first recommendation is `featured`
  - following recommendations are `standard`
- Member schedule:
  - first class per day is `featured`
  - remaining classes in that day are `standard`

## Localization and RTL/LTR

- Added helpers:
  - `getLocalizedProgramName`
  - `getLocalizedLessonTitle`
  - `getLocalizedIntensity`
  - `getLocalizedTone`
  - `formatDuration`
  - `formatSpots`
  - `formatTime`
- Hebrew and Arabic cards use `dir="rtl"` and right-aligned metadata/chips.
- English cards use `dir="ltr"` and left-aligned metadata/chips.
- Technical time/duration values are isolated with `bdi`/LTR-safe formatting.
- Single-room member cards use friendly studio location copy instead of a big room field.

## Responsive and safe-area notes

- Standard cards use constrained thumbnail/accent dimensions on mobile.
- Chips wrap instead of clipping.
- Existing member-page safe-area bottom padding remains in place for the bottom nav.

## Browser QA

- Dev server: `http://127.0.0.1:4187/`
- Checked `/member/schedule` at:
  - 390 x 844
  - 1440 x 900
- Result: route redirected to `/auth` because no authenticated local session was available.
- Auth redirect had no console errors and no horizontal overflow.
- Protected schedule visual QA is still pending behind an authenticated member session.
- Screenshots captured:
  - `/var/folders/gj/7lyzfjm53xnbpmnbn4q6v4t00000gp/T/lesson-card-mobile-he.png`
  - `/var/folders/gj/7lyzfjm53xnbpmnbn4q6v4t00000gp/T/lesson-card-desktop-he.png`

## Commands run

- `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/lessonCardVariants.test.mjs` - passed
- `/Users/ameeramer/.bun/bin/bunx tsc --noEmit` - blocked by unrelated existing dirty credit-sweep RPC type errors
- `/Users/ameeramer/.bun/bin/bun run lint` - passed with existing warnings
- `/Users/ameeramer/.bun/bin/bun run build` - passed
- `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs` - passed

## Typecheck blocker

`tsc --noEmit` currently fails outside this lesson-card UI work because existing dirty files call Supabase RPCs that are not present in generated Supabase types:

- `sweep_member_credits`
- `sweep_all_members_credits`

Related existing dirty files:

- `src/lib/admin.functions.ts`
- `src/lib/member.functions.ts`
- `src/lib/members.functions.ts`
- untracked credit-sweep migrations under `supabase/migrations/`

I did not modify those migration/schema-related files because this task explicitly said not to run migrations or change database schema.

## Remaining issues

- Protected member schedule visual QA still needs an authenticated local member session.
- Typecheck requires resolving the unrelated credit-sweep RPC type mismatch in the existing dirty worktree.
