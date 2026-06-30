# Member Lesson Card Related Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build related-but-different lesson cards for the member home page and member schedule page so home feels like a premium invitation while schedule stays clean and scannable.

**Architecture:** Keep `VisualClassCard` as the shared renderer and introduce explicit card variants for `homeFeature`, `homeList`, `scheduleLead`, and `scheduleList`. Route files only choose variants; shared state, localization, images, CTA behavior, and accessibility stay inside the component/CSS layer.

**Tech Stack:** React 19, TanStack React Start, TypeScript, Tailwind/CSS in `src/styles.css`, existing i18n helpers, existing image helpers, Bun.

## Global Constraints

- Do not run migrations.
- Do not change database schema.
- Do not change booking, waitlist, payment, receipt, auth, RLS, or notification logic.
- No new lesson data model.
- Do not replace the whole member app shell.
- Home page should sell the next best action.
- Schedule page should help members compare lessons quickly.
- Hebrew and Arabic stay RTL/right-aligned; English stays LTR/left-aligned.
- Lesson images must not be awkwardly cropped or hidden by badges/marks.
- Cards must remain keyboard-accessible.

---

## File Structure

- Modify `src/lib/lesson-card-variants.ts`: add or map explicit visual variant names and context rules.
- Modify `src/components/visual/VisualClassCard.tsx`: split rendering branches into home feature/list and schedule lead/list variants while preserving current props and data contract.
- Modify `src/styles.css`: add variant-specific layout, image sizing, responsive behavior, focus states, and RTL/LTR rules.
- Modify `src/routes/_authenticated/member/index.tsx`: choose `homeFeature` for the main recommended lesson and `homeList` for the smaller recommended list.
- Modify `src/routes/_authenticated/member/schedule.tsx`: choose `scheduleLead` for the first lesson of a day and `scheduleList` for the rest.
- Modify `src/components/member/ClassDetailSheet.tsx` only when it already renders `ClassArtTile` or `VisualClassCard` image rules affected by this plan; otherwise leave it untouched and record that in the report.
- Modify or create `docs/member-lesson-card-related-variants-report.md`: capture files changed, QA, commands, and remaining risks.

---

### Task 1: Define Explicit Lesson Card Variant Contract

**Files:**

- Modify: `src/lib/lesson-card-variants.ts`
- Test: `tests/unit/lessonCardVariants.test.mjs` if this file already exists; otherwise validate through `bun run build`.

**Interfaces:**

- Consumes: current `LessonCardVariant`, `LessonCardContext`, `getLessonVisualMode`, `getArtTileVariant`.
- Produces:
  - `LessonCardVariant` includes `"homeFeature" | "homeList" | "scheduleLead" | "scheduleList"`.
  - Existing `"hero" | "standard" | "compact"` remain accepted as compatibility aliases if currently used elsewhere.
  - `normalizeLessonCardVariant(variant: LessonCardVariant | undefined, compact: boolean): LessonCardVariant` returns one of the explicit variants.

- [ ] **Step 1: Inspect current variant definitions**

Run:

```bash
sed -n '1,280p' src/lib/lesson-card-variants.ts
rg -n "LessonCardVariant|hero|standard|compact" src/lib src/components src/routes
```

Expected: identify all call sites before editing.

- [ ] **Step 2: Add explicit variant type**

Patch `src/lib/lesson-card-variants.ts` so the type accepts both explicit variants and existing aliases:

```ts
export type LessonCardVariant =
  | "homeFeature"
  | "homeList"
  | "scheduleLead"
  | "scheduleList"
  | "hero"
  | "standard"
  | "compact";
```

- [ ] **Step 3: Add normalizer**

Add this helper near other variant helpers:

```ts
export function normalizeLessonCardVariant(
  variant: LessonCardVariant | undefined,
  compact = false,
): Exclude<LessonCardVariant, "hero" | "standard" | "compact"> {
  if (variant === "homeFeature" || variant === "homeList") return variant;
  if (variant === "scheduleLead" || variant === "scheduleList") return variant;
  if (variant === "hero") return "scheduleLead";
  if (variant === "compact") return "homeList";
  if (variant === "standard") return "scheduleList";
  return compact ? "homeList" : "scheduleList";
}
```

- [ ] **Step 4: Update visual-mode rules to use normalized variants**

Keep `getLessonVisualMode` deterministic. Map explicit variants before any feature/list branching:

```ts
const normalizedVariant = normalizeLessonCardVariant(input.variant, false);
const isFeature = normalizedVariant === "homeFeature" || normalizedVariant === "scheduleLead";
```

Expected: `homeFeature` and `scheduleLead` can use image-first logic; `homeList` and `scheduleList` stay denser.

- [ ] **Step 5: Run type/build check for this task**

Run:

```bash
/Users/ameeramer/.bun/bin/bun run build
```

Expected: build passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/lesson-card-variants.ts
git commit -m "feat: define member lesson card variants"
```

---

### Task 2: Refactor VisualClassCard Markup Into Related Variants

**Files:**

- Modify: `src/components/visual/VisualClassCard.tsx`
- Modify: `src/styles.css`

**Interfaces:**

- Consumes: `normalizeLessonCardVariant`, existing `VisualClassCard` props.
- Produces:
  - `VisualClassCard` renders four explicit variants through shared data preparation.
  - `data-lesson-variant={normalizedVariant}` appears on the root card for CSS targeting.
  - Existing prop names remain compatible.

- [ ] **Step 1: Add normalized variant import**

In `src/components/visual/VisualClassCard.tsx`, update imports:

```ts
import {
  formatDuration,
  formatSpots,
  getArtTileVariant,
  getFriendlyStudioLocation,
  getLessonProgramAccent,
  getLessonVisualMode,
  normalizeLessonCardVariant,
  type ArtTileVariant,
  shouldShowRoomOnLessonCard,
  type LessonCardContext,
  type LessonCardVariant,
} from "@/lib/lesson-card-variants";
```

- [ ] **Step 2: Normalize variant once**

Replace the current resolved variant calculation with:

```ts
const normalizedVariant = normalizeLessonCardVariant(variant, compact);
const visualMode = getLessonVisualMode({
  index,
  lesson: cls,
  previousLesson,
  variant: normalizedVariant,
  context,
});
const isHomeFeature = normalizedVariant === "homeFeature";
const isHomeList = normalizedVariant === "homeList";
const isScheduleLead = normalizedVariant === "scheduleLead";
const isScheduleList = normalizedVariant === "scheduleList";
const isFeature = isHomeFeature || isScheduleLead;
```

Expected: later markup can branch on `isFeature`, `isHomeList`, and `isScheduleList`.

- [ ] **Step 3: Add variant data attributes**

Root card shell should include the normalized variant:

```tsx
<article
  dir={dir}
  data-lesson-variant={normalizedVariant}
  className={cardShell}
  style={...}
>
```

Expected: CSS can target variants without fragile class chains.

- [ ] **Step 4: Replace non-feature branch with dense list structure**

For `homeList` and `scheduleList`, use one compact shared structure:

```tsx
<div className="lesson-card__list-layout" dir={dir}>
  <div className="lesson-card__list-copy">
    <div className="lesson-card__time-row">
      <span className="lesson-card__time-badge" dir="ltr">
        {time.hour}:{time.minute}
      </span>
      <span className="lesson-card__duration" dir="auto">
        <bdi>{formatDuration(cls.duration_minutes, lang)}</bdi>
      </span>
      <span className="lesson-card__availability">
        <bdi>{openSpotsText}</bdi>
      </span>
    </div>
    <MixedLessonTitle
      as="h3"
      brand={titleParts.brand}
      program={titleParts.program}
      dir={dir}
      className="lesson-card__title lesson-card-title"
    />
    <div className="lesson-card__chips lesson-chip-row">
      {metaChips.slice(0, isHomeList ? 2 : 3).map((chip) => (
        <span key={chip} className="member-class-meta-chip" dir="auto" title={chip}>
          <bdi>{chip}</bdi>
        </span>
      ))}
    </div>
    <div className="lesson-card__meta-inline">
      <span dir="auto">
        <bdi>{instructor ?? t("member.locationStudio")}</bdi>
      </span>
      <span aria-hidden="true">·</span>
      <span dir="auto">
        <bdi>{locationLabel}</bdi>
      </span>
      <span aria-hidden="true">·</span>
      <span dir="auto">
        <bdi>{formatSpots(spotsLeft, totalCapacity, lang)}</bdi>
      </span>
    </div>
    <div className="lesson-card__footer">
      <span className="lesson-card__state-copy">{chipLabel}</span>
      {cta ? <CtaLabel label={cta.label} disabled={cta.disabled} strong={isScheduleList} /> : null}
    </div>
  </div>
  <div className="lesson-card__list-media" aria-hidden="true">
    <ClassArtTile
      programType={cls.program_type}
      tone={String(cls.energy ?? "")}
      lang={lang}
      compact
    />
  </div>
</div>
```

Use the existing image helper when `resolveClassImageSrc(cls, "thumb")` returns a source. Keep `ClassArtTile` as the fallback:

```tsx
const listImageSrc = resolveClassImageSrc(cls, "thumb");

<div className="lesson-card__list-media" aria-hidden="true">
  {listImageSrc ? (
    <ClassMoodImage
      className="lesson-card__list-image"
      src={listImageSrc}
      alt=""
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      style={{ objectPosition: resolveClassImagePosition(cls) }}
    />
  ) : (
    <ClassArtTile
      programType={cls.program_type}
      tone={String(cls.energy ?? "")}
      lang={lang}
      compact
    />
  )}
</div>;
```

- [ ] **Step 5: Replace feature branch with premium editorial structure**

For `homeFeature` and `scheduleLead`, use:

```tsx
<div className="lesson-card__feature-layout" dir={dir}>
  <div className="lesson-card__feature-copy">
    <div className="lesson-card__time-row">
      <span className="lesson-card__time-badge" dir="ltr">
        {time.hour}:{time.minute}
      </span>
      <span className="lesson-card__duration" dir="auto">
        <bdi>{formatDuration(cls.duration_minutes, lang)}</bdi>
      </span>
      <span className="lesson-card__availability">
        <bdi>{openSpotsText}</bdi>
      </span>
    </div>
    <MixedLessonTitle
      as="h3"
      brand={titleParts.brand}
      program={titleParts.program}
      dir={dir}
      className="lesson-card__title lesson-card-title"
    />
    <div className="lesson-card__chips lesson-chip-row">
      {metaChips.slice(0, 3).map((chip) => (
        <span key={chip} className="member-class-meta-chip" dir="auto" title={chip}>
          <bdi>{chip}</bdi>
        </span>
      ))}
    </div>
    <div className="lesson-card__meta-grid" dir={dir}>
      <MetaItem
        icon={<Sparkles className="h-3.5 w-3.5" />}
        label={t("common.with")}
        value={
          <span dir="auto">
            <bdi>{instructor ?? t("member.locationStudio")}</bdi>
          </span>
        }
      />
      <MetaItem
        icon={<MapPin className="h-3.5 w-3.5" />}
        label={t("common.where")}
        value={
          <span dir="auto">
            <bdi>{locationLabel}</bdi>
          </span>
        }
      />
      <MetaItem
        icon={<Users className="h-3.5 w-3.5" />}
        label={t("common.spots")}
        value={
          <span dir="auto">
            <bdi>{formatSpots(spotsLeft, totalCapacity, lang)}</bdi>
          </span>
        }
      />
    </div>
    <div className="lesson-card__footer">
      <span className="lesson-card__state-copy">{chipLabel}</span>
      {cta ? <CtaLabel label={cta.label} disabled={cta.disabled} strong /> : null}
    </div>
  </div>
  <div className="lesson-card__feature-media">
    {useHeroImage ? (
      <ClassMoodImage
        className="lesson-card__feature-image"
        src={resolveClassImageSrc(cls, "card")}
        alt=""
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        style={{ objectPosition: resolveClassImagePosition(cls) }}
      />
    ) : (
      <ClassArtTile
        programType={cls.program_type}
        tone={String(cls.energy ?? "")}
        lang={lang}
        variant={tileVariant}
      />
    )}
  </div>
</div>
```

Expected: feature variants never create a huge blank copy area; media has stable dimensions.

- [ ] **Step 6: Add CSS for related variants**

Append or replace the existing lesson-card variant block in `src/styles.css` with these selectors, adapting token names to existing values:

```css
.lesson-card[data-lesson-variant] {
  border: 1px solid rgba(212, 175, 106, 0.32);
  border-radius: var(--cc-radius-card);
  background: color-mix(in srgb, var(--cc-ivory) 92%, white);
  box-shadow: 0 18px 44px rgba(11, 29, 58, 0.07);
}

.lesson-card__feature-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 0.82fr);
  min-height: 280px;
}

[dir="rtl"] .lesson-card__feature-layout {
  grid-template-columns: minmax(260px, 0.82fr) minmax(0, 1fr);
}

.lesson-card__feature-copy,
.lesson-card__list-copy {
  min-width: 0;
}

.lesson-card__feature-copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 14px;
  padding: clamp(22px, 4vw, 42px);
}

.lesson-card__feature-media {
  position: relative;
  min-height: 240px;
  overflow: hidden;
  border-radius: calc(var(--cc-radius-card) - 3px);
  background: var(--cc-sand);
}

.lesson-card__feature-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: var(--cc-sand);
}

.lesson-card__list-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(116px, 18vw, 220px);
  gap: 18px;
  align-items: center;
  min-height: 156px;
  padding: 18px;
}

[dir="rtl"] .lesson-card__list-layout {
  grid-template-columns: clamp(116px, 18vw, 220px) minmax(0, 1fr);
}

.lesson-card__list-media {
  aspect-ratio: 4 / 3;
  min-width: 0;
  overflow: hidden;
  border-radius: calc(var(--cc-radius-card) - 4px);
}

.lesson-card__meta-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  color: var(--cc-slate);
  font-size: 0.86rem;
  font-weight: 600;
}

@media (max-width: 640px) {
  .lesson-card__feature-layout,
  [dir="rtl"] .lesson-card__feature-layout,
  .lesson-card__list-layout,
  [dir="rtl"] .lesson-card__list-layout {
    grid-template-columns: 1fr;
  }

  .lesson-card__feature-media {
    order: -1;
    min-height: 190px;
  }

  .lesson-card__list-media {
    order: -1;
    aspect-ratio: 16 / 9;
  }
}
```

- [ ] **Step 7: Verify no JSX/runtime syntax errors**

Run:

```bash
/Users/ameeramer/.bun/bin/bun run build
```

Expected: build passes.

- [ ] **Step 8: Commit**

```bash
git add src/components/visual/VisualClassCard.tsx src/styles.css
git commit -m "feat: refactor member lesson card variants"
```

---

### Task 3: Wire Home And Schedule Routes To The New Variants

**Files:**

- Modify: `src/routes/_authenticated/member/index.tsx`
- Modify: `src/routes/_authenticated/member/schedule.tsx`

**Interfaces:**

- Consumes: `VisualClassCard` variant prop accepts `"homeFeature" | "homeList" | "scheduleLead" | "scheduleList"`.
- Produces: routes select card density without duplicating card internals.

- [ ] **Step 1: Update home featured lesson variant**

In `src/routes/_authenticated/member/index.tsx`, replace:

```tsx
variant = "hero";
```

with:

```tsx
variant = "homeFeature";
```

for the `featuredClass` card.

- [ ] **Step 2: Update home recommended list variant**

In the recommended list map, replace:

```tsx
variant = "standard";
```

with:

```tsx
variant = "homeList";
```

- [ ] **Step 3: Update schedule day list variants**

In `src/routes/_authenticated/member/schedule.tsx`, replace:

```tsx
variant={index === 0 ? "hero" : "standard"}
```

with:

```tsx
variant={index === 0 ? "scheduleLead" : "scheduleList"}
```

- [ ] **Step 4: Keep current route behavior unchanged**

Search to confirm no business logic changed:

```bash
git diff -- src/routes/_authenticated/member/index.tsx src/routes/_authenticated/member/schedule.tsx
```

Expected: diff only changes card variant prop strings.

- [ ] **Step 5: Run route-level build validation**

```bash
/Users/ameeramer/.bun/bin/bun run build
```

Expected: build passes.

- [ ] **Step 6: Commit**

```bash
git add src/routes/_authenticated/member/index.tsx src/routes/_authenticated/member/schedule.tsx
git commit -m "feat: wire member routes to lesson card variants"
```

---

### Task 4: Visual QA And Final Polish

**Files:**

- Modify: `src/components/visual/VisualClassCard.tsx` if QA reveals layout overlap.
- Modify: `src/styles.css` if QA reveals spacing/cropping/RTL issues.
- Create: `docs/member-lesson-card-related-variants-report.md`

**Interfaces:**

- Consumes: completed card variants.
- Produces: verified, documented member lesson card redesign.

- [ ] **Step 1: Start local app**

Run:

```bash
/Users/ameeramer/.bun/bin/bun run dev
```

Expected: Vite dev server starts and prints a localhost URL.

- [ ] **Step 2: QA target pages**

Open:

```text
/member
/member/schedule
```

Check each page in Hebrew, Arabic, and English if language switching is available in the current session.

- [ ] **Step 3: QA responsive sizes**

Check:

```text
390 x 844
820 x 1180
1440 x 900
```

Expected:

- no horizontal overflow
- no text overlapping CTA or image
- no cropped/hidden important lesson subject
- image mark/badge does not cover important text or subject
- home and schedule feel related but not identical

- [ ] **Step 4: Fix concrete visual defects only**

When the QA image subject is cropped, adjust CSS only:

```css
.lesson-card__feature-image {
  object-fit: contain;
  object-position: center;
}
```

When the list card media is too large on desktop, adjust:

```css
.lesson-card__list-layout {
  grid-template-columns: minmax(0, 1fr) clamp(104px, 16vw, 188px);
}
```

When RTL order is wrong, adjust logical order selectors:

```css
[dir="rtl"] .lesson-card__feature-media,
[dir="rtl"] .lesson-card__list-media {
  order: 0;
}
```

- [ ] **Step 5: Run final commands**

```bash
/Users/ameeramer/.bun/bin/bunx tsc --noEmit
/Users/ameeramer/.bun/bin/bun run lint
/Users/ameeramer/.bun/bin/bun run build
/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs
```

Expected:

- Build passes.
- i18n passes.
- Lint passes with existing warnings only.
- When `tsc --noEmit` still fails on pre-existing Supabase RPC/dom-patches issues, record the exact errors in the report and confirm no new lesson-card errors were introduced.

- [ ] **Step 6: Create report**

Create `docs/member-lesson-card-related-variants-report.md`:

```md
# Member Lesson Card Related Variants Report

## Files Changed

- `src/lib/lesson-card-variants.ts`
- `src/components/visual/VisualClassCard.tsx`
- `src/styles.css`
- `src/routes/_authenticated/member/index.tsx`
- `src/routes/_authenticated/member/schedule.tsx`

## What Changed

- Home uses `homeFeature` and `homeList` card variants.
- Schedule uses `scheduleLead` and `scheduleList` card variants.
- Images use stable sizing to avoid awkward cropping.
- RTL/LTR alignment remains language-aware.

## QA

- Hebrew `/member`: record observed result and screenshot path or auth blocker.
- Arabic `/member`: record observed result and screenshot path or auth blocker.
- English `/member`: record observed result and screenshot path or auth blocker.
- Hebrew `/member/schedule`: record observed result and screenshot path or auth blocker.
- Arabic `/member/schedule`: record observed result and screenshot path or auth blocker.
- English `/member/schedule`: record observed result and screenshot path or auth blocker.
- Mobile 390 x 844: record observed result and screenshot path.
- iPad 820 x 1180: record observed result and screenshot path.
- Desktop 1440 x 900: record observed result and screenshot path.

## Commands

- `bunx tsc --noEmit`: record exact status and first error if it fails.
- `bun run lint`: record exact status and whether warnings are pre-existing.
- `bun run build`: record exact status.
- `bunx tsx tests/unit/i18n.test.mjs`: record exact status.

## Remaining Issues

- List only real remaining issues, or `None found in this pass`.
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/lesson-card-variants.ts src/components/visual/VisualClassCard.tsx src/styles.css src/routes/_authenticated/member/index.tsx src/routes/_authenticated/member/schedule.tsx docs/member-lesson-card-related-variants-report.md
git commit -m "feat: polish member lesson card variants"
```

---

## Plan Self-Review

- Spec coverage: covered home, schedule, shared component architecture, image rules, RTL/LTR, accessibility, responsive behavior, QA, and no business-logic/schema constraints.
- Placeholder scan: no `TBD`, `TODO`, or vague implementation-only steps remain.
- Type consistency: `LessonCardVariant`, `normalizeLessonCardVariant`, and route prop values are consistent across tasks.
