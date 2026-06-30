# Lesson Availability Meter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a premium, RTL-safe availability meter to shared member lesson cards and class detail surfaces.

**Architecture:** Keep the feature inside the existing shared card pipeline. Add one formatting helper in `lesson-card-variants.ts`, one presentational `LessonAvailabilityMeter` in `VisualClassCard.tsx`, reuse it from `PremiumLessonReservationCard`, `LessonReservationCard`, and export it for `ClassDetailSheet`.

**Tech Stack:** React, TypeScript, existing Cloud & Core CSS, Bun, ESLint, Vite build.

## Global Constraints

- Do not change booking rules, payments, database schema, RLS, backend business logic, or admin redesigns.
- Use existing lesson fields only: `capacity` and `booked_count`.
- Hebrew and Arabic content must be RTL-safe and right-aligned.
- English content must remain LTR-safe and left-aligned.
- Missing or zero capacity must not render a misleading progress bar.
- Low availability triggers when `spotsLeft <= 2` or at least 75% of capacity is booked.
- Tone is boutique urgency, not aggressive warning copy.

---

### Task 1: Availability Formatting Helper

**Files:**
- Modify: `src/lib/lesson-card-variants.ts`
- Modify: `tests/unit/lessonCardVariants.test.mjs`

**Interfaces:**
- Consumes: `Lang` from `@/lib/i18n`.
- Produces:
  - `type LessonAvailabilityMeterModel = { shouldRender: boolean; spotsLeft: number; capacity: number; bookedCount: number; bookedRatio: number; fillPercent: number; isLow: boolean; label: string; assistiveLabel: string }`
  - `getLessonAvailabilityMeter(input: { capacity?: number | null; bookedCount?: number | null; lang: Lang }): LessonAvailabilityMeterModel`

- [ ] **Step 1: Write the failing unit tests**

Append these assertions to `tests/unit/lessonCardVariants.test.mjs`, near the existing lesson-card variant assertions:

```js
import { getLessonAvailabilityMeter } from "../../src/lib/lesson-card-variants";

assert.deepEqual(
  pickMeter(getLessonAvailabilityMeter({ capacity: 10, bookedCount: 3, lang: "he" })),
  {
    shouldRender: true,
    spotsLeft: 7,
    capacity: 10,
    bookedCount: 3,
    bookedRatio: 0.3,
    fillPercent: 30,
    isLow: false,
    label: "7 מקומות פנויים",
    assistiveLabel: "7 מקומות פנויים מתוך 10",
  },
);

assert.deepEqual(
  pickMeter(getLessonAvailabilityMeter({ capacity: 8, bookedCount: 6, lang: "he" })),
  {
    shouldRender: true,
    spotsLeft: 2,
    capacity: 8,
    bookedCount: 6,
    bookedRatio: 0.75,
    fillPercent: 75,
    isLow: true,
    label: "נותרו 2 מקומות בלבד",
    assistiveLabel: "נותרו 2 מקומות בלבד מתוך 8",
  },
);

assert.deepEqual(
  pickMeter(getLessonAvailabilityMeter({ capacity: 8, bookedCount: 7, lang: "en" })),
  {
    shouldRender: true,
    spotsLeft: 1,
    capacity: 8,
    bookedCount: 7,
    bookedRatio: 0.875,
    fillPercent: 88,
    isLow: true,
    label: "Only 1 spot left",
    assistiveLabel: "Only 1 spot left out of 8",
  },
);

assert.deepEqual(
  pickMeter(getLessonAvailabilityMeter({ capacity: 8, bookedCount: 8, lang: "ar" })),
  {
    shouldRender: true,
    spotsLeft: 0,
    capacity: 8,
    bookedCount: 8,
    bookedRatio: 1,
    fillPercent: 100,
    isLow: true,
    label: "قائمة الانتظار مفتوحة",
    assistiveLabel: "قائمة الانتظار مفتوحة",
  },
);

assert.equal(
  getLessonAvailabilityMeter({ capacity: 0, bookedCount: 0, lang: "he" }).shouldRender,
  false,
);

function pickMeter(model) {
  return {
    shouldRender: model.shouldRender,
    spotsLeft: model.spotsLeft,
    capacity: model.capacity,
    bookedCount: model.bookedCount,
    bookedRatio: model.bookedRatio,
    fillPercent: model.fillPercent,
    isLow: model.isLow,
    label: model.label,
    assistiveLabel: model.assistiveLabel,
  };
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bunx tsx tests/unit/lessonCardVariants.test.mjs
```

Expected: FAIL because `getLessonAvailabilityMeter` is not exported yet.

- [ ] **Step 3: Add the helper**

Add this code to `src/lib/lesson-card-variants.ts` after `formatSpots`:

```ts
export type LessonAvailabilityMeterModel = {
  shouldRender: boolean;
  spotsLeft: number;
  capacity: number;
  bookedCount: number;
  bookedRatio: number;
  fillPercent: number;
  isLow: boolean;
  label: string;
  assistiveLabel: string;
};

export function getLessonAvailabilityMeter({
  capacity,
  bookedCount,
  lang,
}: {
  capacity?: number | null;
  bookedCount?: number | null;
  lang: Lang;
}): LessonAvailabilityMeterModel {
  const safeCapacity = Math.max(0, Number(capacity ?? 0));
  const safeBooked = Math.min(safeCapacity, Math.max(0, Number(bookedCount ?? 0)));
  const spotsLeft = Math.max(0, safeCapacity - safeBooked);

  if (safeCapacity <= 0) {
    return {
      shouldRender: false,
      spotsLeft: 0,
      capacity: 0,
      bookedCount: 0,
      bookedRatio: 0,
      fillPercent: 0,
      isLow: false,
      label: formatSpots(0, 0, lang),
      assistiveLabel: formatSpots(0, 0, lang),
    };
  }

  const bookedRatio = safeBooked / safeCapacity;
  const fillPercent = Math.round(bookedRatio * 100);
  const isFull = spotsLeft === 0;
  const isLow = isFull || spotsLeft <= 2 || bookedRatio >= 0.75;
  const label = availabilityMeterLabel(spotsLeft, isLow, lang);
  const assistiveLabel =
    isFull || !isLow
      ? lang === "he"
        ? `${label} מתוך ${safeCapacity}`
        : lang === "ar"
          ? `${label} من ${safeCapacity}`
          : `${label} out of ${safeCapacity}`
      : lang === "he"
        ? `${label} מתוך ${safeCapacity}`
        : lang === "ar"
          ? `${label} من ${safeCapacity}`
          : `${label} out of ${safeCapacity}`;

  return {
    shouldRender: true,
    spotsLeft,
    capacity: safeCapacity,
    bookedCount: safeBooked,
    bookedRatio: Number(bookedRatio.toFixed(3)),
    fillPercent,
    isLow,
    label,
    assistiveLabel: isFull ? availabilityMeterLabel(0, true, lang) : assistiveLabel,
  };
}

function availabilityMeterLabel(spotsLeft: number, isLow: boolean, lang: Lang) {
  if (spotsLeft <= 0) {
    return fallbackByLang(lang, "Waitlist open", "רשימת המתנה פתוחה", "قائمة الانتظار مفتوحة");
  }
  if (!isLow) return formatSpots(spotsLeft, spotsLeft, lang);

  if (lang === "he") return spotsLeft === 1 ? "נותר מקום אחד בלבד" : `נותרו ${spotsLeft} מקומות בלבד`;
  if (lang === "ar") return spotsLeft === 1 ? "تبقى مكان واحد فقط" : `تبقى ${spotsLeft} أماكن فقط`;
  return spotsLeft === 1 ? "Only 1 spot left" : `Only ${spotsLeft} spots left`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
bunx tsx tests/unit/lessonCardVariants.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/lesson-card-variants.ts tests/unit/lessonCardVariants.test.mjs
git commit -m "Add lesson availability meter model"
```

### Task 2: Shared Meter Component and Usage

**Files:**
- Modify: `src/components/visual/VisualClassCard.tsx`
- Modify: `src/components/member/ClassDetailSheet.tsx`

**Interfaces:**
- Consumes: `getLessonAvailabilityMeter`.
- Produces: `LessonAvailabilityMeter` component exported from `VisualClassCard.tsx`.

- [ ] **Step 1: Import the helper**

In `src/components/visual/VisualClassCard.tsx`, add `getLessonAvailabilityMeter` to the existing import from `@/lib/lesson-card-variants`.

In `src/components/member/ClassDetailSheet.tsx`, import `LessonAvailabilityMeter` from `@/components/visual/VisualClassCard`.

- [ ] **Step 2: Add the component**

Add this component in `src/components/visual/VisualClassCard.tsx` after `StudioLocationInline`:

```tsx
export function LessonAvailabilityMeter({
  capacity,
  bookedCount,
  lang,
  dir,
  compact = false,
}: {
  capacity?: number | null;
  bookedCount?: number | null;
  lang: Lang;
  dir: "rtl" | "ltr";
  compact?: boolean;
}) {
  const model = getLessonAvailabilityMeter({ capacity, bookedCount, lang });
  if (!model.shouldRender) return null;

  return (
    <div
      className={`lesson-availability-meter ${model.isLow ? "lesson-availability-meter--low" : ""} ${
        compact ? "lesson-availability-meter--compact" : ""
      }`}
      dir={dir}
      aria-label={model.assistiveLabel}
    >
      <div className="lesson-availability-meter__row">
        <span className="lesson-availability-meter__label" dir="auto">
          <bdi>{model.label}</bdi>
        </span>
        <span className="lesson-availability-meter__count" dir="ltr">
          {model.bookedCount}/{model.capacity}
        </span>
      </div>
      <div className="lesson-availability-meter__track" aria-hidden="true">
        <span
          className="lesson-availability-meter__fill"
          style={{ inlineSize: `${model.fillPercent}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Use it in the main card**

In `PremiumLessonReservationCard`, place this after the chip row and before `premium-lesson-card__actions`:

```tsx
<LessonAvailabilityMeter
  capacity={totalCapacity}
  bookedCount={cls.booked_count}
  lang={lang}
  dir={dir}
/>
```

- [ ] **Step 4: Use it in booking cards**

In `LessonReservationCard`, place this after the chip row and before `lesson-card__meta-inline`:

```tsx
<LessonAvailabilityMeter
  capacity={totalCapacity}
  bookedCount={cls.booked_count}
  lang={lang}
  dir={dir}
  compact
/>
```

- [ ] **Step 5: Use it in class detail**

In `ClassDetailSheet`, place this after the chip row in `lesson-detail__summary`:

```tsx
<LessonAvailabilityMeter
  capacity={cls.capacity}
  bookedCount={cls.booked_count}
  lang={lang}
  dir={dir}
/>
```

- [ ] **Step 6: Run TypeScript check**

Run:

```bash
bunx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/visual/VisualClassCard.tsx src/components/member/ClassDetailSheet.tsx
git commit -m "Add lesson availability meter to member cards"
```

### Task 3: Premium Meter Styling and QA

**Files:**
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `.lesson-availability-meter` markup from Task 2.
- Produces: RTL-safe visual styling.

- [ ] **Step 1: Add CSS**

Add this CSS near the premium lesson-card styles in `src/styles.css`:

```css
.lesson-availability-meter {
  width: 100%;
  margin-top: 0.9rem;
  padding: 0.72rem 0.78rem;
  border: 1px solid rgba(232, 223, 209, 0.92);
  border-radius: 16px;
  background: rgba(250, 247, 242, 0.76);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.74);
  color: #0b1d3a;
  text-align: start;
}

.lesson-availability-meter--compact {
  margin-top: 0.7rem;
  padding: 0.62rem 0.68rem;
  border-radius: 14px;
}

.lesson-availability-meter__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-width: 0;
}

.lesson-availability-meter__label {
  min-width: 0;
  color: #0b1d3a;
  font-size: 0.84rem;
  font-weight: 800;
  line-height: 1.25;
}

.lesson-availability-meter__count {
  flex: 0 0 auto;
  color: #6f7a8c;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1;
}

.lesson-availability-meter__track {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 0.42rem;
  margin-top: 0.55rem;
  border-radius: 999px;
  background: rgba(11, 29, 58, 0.08);
}

.lesson-availability-meter__fill {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(212, 175, 106, 0.78), #d4af6a);
  box-shadow: 0 0 16px rgba(212, 175, 106, 0.22);
}

[dir="rtl"] .lesson-availability-meter__fill {
  background: linear-gradient(270deg, rgba(212, 175, 106, 0.78), #d4af6a);
}

.lesson-availability-meter--low {
  border-color: rgba(212, 175, 106, 0.58);
  background: linear-gradient(180deg, rgba(250, 247, 242, 0.98), rgba(255, 248, 236, 0.86));
}

.lesson-availability-meter--low .lesson-availability-meter__label {
  color: #0b1d3a;
}

.lesson-detail .lesson-availability-meter {
  margin-inline: auto;
  max-width: 32rem;
}
```

- [ ] **Step 2: Format and lint changed files**

Run:

```bash
bunx prettier --check src/lib/lesson-card-variants.ts src/components/visual/VisualClassCard.tsx src/components/member/ClassDetailSheet.tsx src/styles.css tests/unit/lessonCardVariants.test.mjs
bunx eslint src/lib/lesson-card-variants.ts src/components/visual/VisualClassCard.tsx src/components/member/ClassDetailSheet.tsx
```

Expected: PASS.

- [ ] **Step 3: Run build**

Run:

```bash
bun run build
```

Expected: PASS.

- [ ] **Step 4: Manual QA**

Inspect the app at mobile, tablet, and desktop widths. Confirm:

- Hebrew card meter text starts from the right.
- Hebrew and Arabic fill anchors from the right.
- English fill anchors from the left.
- Meter does not crowd chips or CTA.
- Modal detail meter appears under chips and above the detail grid.

- [ ] **Step 5: Commit**

```bash
git add src/styles.css
git commit -m "Style lesson availability meter"
```
