# Cloud & Core Member Experience Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the authenticated Cloud & Core member experience into a premium, task-first, accessible interface across Home, Schedule, Bookings, Packages, Profile, and shared navigation without changing member business rules.

**Architecture:** Introduce a small set of shared member presentation primitives, keep route loaders and mutations authoritative, and refactor each route around one primary task. Pure presentation helpers and server-renderable components provide automated public seams; responsive order, RTL/LTR behavior, focus management, and motion are verified in the browser against the approved audit baseline.

**Tech Stack:** React 19, TypeScript, TanStack Router/Query/Start, Tailwind CSS v4 plus `src/styles.css`, Radix Dialog/Sheet, Bun tests, Vite.

---

## Scope and file map

### Create

- `src/lib/member-ui.ts` — pure schedule filter counting and empty-state classification.
- `src/components/member/MemberPage.tsx` — shared page introduction, semantic section, and action-bar primitives.
- `src/components/member/MemberSegmentedControl.tsx` — accessible RTL-safe booking tab control.
- `src/components/member/MemberRouteSkeleton.tsx` — route-shaped member loading skeletons.
- `src/components/member/MemberField.tsx` — accessible label/control association for member forms.
- `tests/unit/memberUi.test.mjs` — pure public presentation behavior.
- `tests/unit/memberPresentationComponents.test.mjs` — server-rendered semantics for shared components.
- `tests/unit/memberNavigation.test.mjs` — five-destination member navigation behavior and concise labels.
- `tests/unit/memberScheduleFilters.test.mjs` — mobile filter trigger, localized option rendering, reset behavior, and active count.
- `tests/unit/memberProfileFields.test.mjs` — label/input association and control semantics.

### Modify

- `src/lib/i18n.ts` — concise navigation labels and new member copy in English, Hebrew, and Arabic.
- `src/components/app-shell/useRoleNav.ts` — use concise member-only navigation labels.
- `src/components/app-shell/AppShell.tsx` — compact member header/navigation, 44 px controls, route transition wrapper, and route-shaped hydration state.
- `src/components/member/MemberScheduleFilterPanel.tsx` — compact date/search bar plus mobile bottom sheet for secondary filters.
- `src/routes/_authenticated/member/index.tsx` — task-first Home hierarchy.
- `src/routes/member.schedule.tsx` — authenticated Schedule hierarchy and truthful empty states; preserve the guest branch.
- `src/routes/_authenticated/member/bookings.tsx` — compact introduction, accessible tabs, nearest booking priority, and quieter secondary actions.
- `src/routes/_authenticated/member/packages.tsx` — package inventory and purchase actions before explanation/history.
- `src/routes/_authenticated/member/account.tsx` — semantic grouped settings, associated labels, larger controls, and local status feedback.
- `src/styles.css` — member-shell layout, typography, surfaces, responsive behavior, motion, safe areas, and focus styles.
- `tests/unit/i18n.test.mjs` — exact copy and cross-language key coverage.

### Preserve

- All server functions, query keys, mutations, authentication decisions, booking/cancellation rules, checkout behavior, package eligibility, and profile persistence.
- The unauthenticated public schedule presentation and guest-to-auth handoff.
- Admin and instructor shell behavior.
- Yoga promotion, SEO remediation, App Store release work, migrations, and deployment state.

## Task 1: Localized presentation rules

**Files:**
- Create: `src/lib/member-ui.ts`
- Create: `tests/unit/memberUi.test.mjs`
- Modify: `src/lib/i18n.ts`
- Modify: `tests/unit/i18n.test.mjs`

- [ ] **Step 1: Write failing tests for filter counting, empty-state classification, and concise localized copy**

Add this public behavior to `tests/unit/memberUi.test.mjs`:

```js
import { describe, expect, test } from "bun:test";
import {
  countActiveScheduleFilters,
  getScheduleEmptyStateKind,
} from "../../src/lib/member-ui.ts";

describe("member schedule presentation", () => {
  test("counts search, date, and secondary filters", () => {
    expect(countActiveScheduleFilters(" aerial ", "week", { level: "all-levels" })).toBe(3);
    expect(countActiveScheduleFilters("", "all", {})).toBe(0);
  });

  test("distinguishes missing inventory from filtered results", () => {
    expect(getScheduleEmptyStateKind(0, 0, 0)).toBe("inventory");
    expect(getScheduleEmptyStateKind(8, 0, 2)).toBe("filtered");
    expect(getScheduleEmptyStateKind(8, 3, 0)).toBeNull();
  });
});
```

Extend `tests/unit/i18n.test.mjs` with exact expectations:

```js
assert.equal(tForLang("en", "nav.memberBookings"), "Bookings");
assert.equal(tForLang("he", "nav.memberBookings"), "הזמנות");
assert.equal(tForLang("ar", "nav.memberBookings"), "الحجوزات");
assert.equal(tForLang("en", "member.schedule.filter.open"), "Filters");
assert.equal(tForLang("he", "member.schedule.empty.filtered.title"), "אין שיעורים בסינון הזה");
assert.equal(tForLang("ar", "member.schedule.empty.inventory.title"), "لا توجد حصص في هذا اليوم");
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
bun test tests/unit/memberUi.test.mjs tests/unit/i18n.test.mjs
```

Expected: FAIL because `src/lib/member-ui.ts` and the new message keys do not exist.

- [ ] **Step 3: Add the pure presentation helpers**

Create `src/lib/member-ui.ts`:

```ts
export type DateScope = "today" | "tomorrow" | "week" | "all";

export type ScheduleFilterState = {
  level?: string;
  energy?: string;
  instructor?: string;
  room?: string;
};

export function countActiveScheduleFilters(
  search: string,
  dateScope: DateScope,
  filters: ScheduleFilterState,
) {
  return (
    (search.trim() ? 1 : 0) +
    (dateScope === "all" ? 0 : 1) +
    Object.values(filters).filter(Boolean).length
  );
}

export function getScheduleEmptyStateKind(
  totalClassCount: number,
  filteredClassCount: number,
  activeFilterCount: number,
): "inventory" | "filtered" | null {
  if (filteredClassCount > 0) return null;
  if (totalClassCount === 0) return "inventory";
  return activeFilterCount > 0 ? "filtered" : "inventory";
}
```

- [ ] **Step 4: Add exact English, Hebrew, and Arabic messages**

Add each key to all three catalogs in `src/lib/i18n.ts`:

```ts
"nav.memberBookings": "Bookings",
"member.schedule.filter.open": "Filters",
"member.schedule.filter.count": "{count} active",
"member.schedule.filter.apply": "Show classes",
"member.schedule.empty.inventory.title": "No classes scheduled for this day",
"member.schedule.empty.inventory.body": "Choose another day to continue browsing.",
"member.schedule.empty.filtered.title": "No classes match these filters",
"member.schedule.empty.filtered.body": "Adjust or reset the filters to see more classes.",
"member.error.title": "We couldn't load this page",
"member.error.body": "Check your connection and try again.",
```

```ts
"nav.memberBookings": "הזמנות",
"member.schedule.filter.open": "סינון",
"member.schedule.filter.count": "{count} פעילים",
"member.schedule.filter.apply": "הצגת שיעורים",
"member.schedule.empty.inventory.title": "אין שיעורים ביום הזה",
"member.schedule.empty.inventory.body": "בחרי יום אחר כדי להמשיך לחפש.",
"member.schedule.empty.filtered.title": "אין שיעורים בסינון הזה",
"member.schedule.empty.filtered.body": "שני או אפסי את הסינון כדי לראות שיעורים נוספים.",
"member.error.title": "לא הצלחנו לטעון את העמוד",
"member.error.body": "בדקי את החיבור ונסי שוב.",
```

```ts
"nav.memberBookings": "الحجوزات",
"member.schedule.filter.open": "التصفية",
"member.schedule.filter.count": "{count} مفعّلة",
"member.schedule.filter.apply": "عرض الحصص",
"member.schedule.empty.inventory.title": "لا توجد حصص في هذا اليوم",
"member.schedule.empty.inventory.body": "اختاري يوماً آخر لمتابعة التصفح.",
"member.schedule.empty.filtered.title": "لا توجد حصص مطابقة لهذه التصفية",
"member.schedule.empty.filtered.body": "عدّلي التصفية أو أعيدي ضبطها لرؤية حصص إضافية.",
"member.error.title": "تعذّر تحميل هذه الصفحة",
"member.error.body": "تحققي من الاتصال وحاولي مجدداً.",
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
bun test tests/unit/memberUi.test.mjs tests/unit/i18n.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit the localized presentation rules**

```bash
git add src/lib/member-ui.ts src/lib/i18n.ts tests/unit/memberUi.test.mjs tests/unit/i18n.test.mjs
git commit -m "feat: add localized member presentation rules"
```

## Task 2: Shared member presentation primitives

**Files:**
- Create: `src/components/member/MemberPage.tsx`
- Create: `src/components/member/MemberSegmentedControl.tsx`
- Create: `src/components/member/MemberRouteSkeleton.tsx`
- Create: `tests/unit/memberPresentationComponents.test.mjs`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing server-render tests for semantic sections, tabs, and loading status**

Create `tests/unit/memberPresentationComponents.test.mjs` with router `Link` mocked as an anchor and these assertions:

```js
import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as actualRouter from "@tanstack/react-router";

mock.module("@tanstack/react-router", () => ({
  ...actualRouter,
  Link: ({ to, children, ...props }) => React.createElement("a", { href: String(to), ...props }, children),
}));

const { MemberPageIntro, MemberSection } = await import(
  "../../src/components/member/MemberPage.tsx"
);
const { MemberSegmentedControl } = await import(
  "../../src/components/member/MemberSegmentedControl.tsx"
);
const { MemberRouteError, MemberRouteSkeleton } = await import(
  "../../src/components/member/MemberRouteSkeleton.tsx"
);

describe("member presentation primitives", () => {
  test("renders one page heading and an immediately reachable primary action", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemberPageIntro, {
        eyebrow: "Today",
        title: "Welcome",
        body: "Your next class is ready.",
        action: { label: "Find a class", to: "/member/schedule" },
      }),
    );
    expect(html.match(/<h1/g)?.length).toBe(1);
    expect(html).toContain('href="/member/schedule"');
    expect(html).toContain("Find a class");
  });

  test("associates a section heading with its region", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemberSection, { id: "next", title: "Next class" }, "Class"),
    );
    expect(html).toContain('aria-labelledby="next-title"');
    expect(html).toContain('id="next-title"');
  });

  test("renders tabs with one selected keyboard stop", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemberSegmentedControl, {
        label: "Bookings",
        value: "upcoming",
        dir: "ltr",
        items: [
          { value: "upcoming", label: "Upcoming", count: 2 },
          { value: "past", label: "Past", count: 4 },
        ],
        onChange() {},
      }),
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('tabindex="-1"');
  });

  test("exposes loading status without announcing decorative skeletons", () => {
    const html = renderToStaticMarkup(React.createElement(MemberRouteSkeleton, { route: "home" }));
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-hidden="true"');
  });

  test("exposes a recoverable route error", () => {
    const html = renderToStaticMarkup(React.createElement(MemberRouteError, { onRetry() {} }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Retry");
  });
});
```

- [ ] **Step 2: Run the component test and verify RED**

Run:

```bash
bun test tests/unit/memberPresentationComponents.test.mjs
```

Expected: FAIL because the three component modules do not exist.

- [ ] **Step 3: Implement the page and section primitives**

Create `src/components/member/MemberPage.tsx` with typed props, one semantic `h1`, optional router action, section `aria-labelledby`, and an action-bar wrapper:

```tsx
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

type MemberAction = { label: string; to: "/member/schedule" | "/member/bookings" | "/member/packages" };

export function MemberPageIntro({
  eyebrow,
  title,
  body,
  action,
  aside,
}: {
  eyebrow?: string;
  title: ReactNode;
  body?: ReactNode;
  action?: MemberAction;
  aside?: ReactNode;
}) {
  return (
    <header className="member-page-intro">
      <div className="member-page-intro__copy">
        {eyebrow ? <p className="member-eyebrow">{eyebrow}</p> : null}
        <h1 className="member-page-intro__title">{title}</h1>
        {body ? <div className="member-page-intro__body">{body}</div> : null}
        {action ? <Link to={action.to} className="btn-navy member-page-intro__action">{action.label}</Link> : null}
      </div>
      {aside ? <div className="member-page-intro__aside">{aside}</div> : null}
    </header>
  );
}

export function MemberSection({ id, eyebrow, title, action, children }: {
  id: string;
  eyebrow?: string;
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="member-section" aria-labelledby={`${id}-title`}>
      <div className="member-section__heading">
        <div>{eyebrow ? <p className="member-eyebrow">{eyebrow}</p> : null}<h2 id={`${id}-title`} className="member-section__title">{title}</h2></div>
        {action ? <div className="member-section__action">{action}</div> : null}
      </div>
      <div className="member-section__content">{children}</div>
    </section>
  );
}

export function MemberActionBar({ children }: { children: ReactNode }) {
  return <div className="member-action-bar">{children}</div>;
}
```

- [ ] **Step 4: Implement the segmented control and route skeleton**

Create `src/components/member/MemberSegmentedControl.tsx`:

```tsx
import type { KeyboardEvent } from "react";

type Segment<Value extends string> = { value: Value; label: string; count?: number };

export function MemberSegmentedControl<Value extends string>({ label, value, items, onChange, dir }: {
  label: string;
  value: Value;
  items: Segment<Value>[];
  onChange: (value: Value) => void;
  dir: "rtl" | "ltr";
}) {
  function move(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    const visualDelta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const delta = dir === "rtl" ? -visualDelta : visualDelta;
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (currentIndex + delta + items.length) % items.length;
    if (delta !== 0 || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      onChange(items[nextIndex].value);
      const next = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex];
      next?.focus();
      next?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  return <div className="member-segmented-control no-scrollbar" role="tablist" aria-label={label} dir={dir}>
    {items.map((item, index) => {
      const selected = item.value === value;
      return <button key={item.value} type="button" role="tab" aria-selected={selected} tabIndex={selected ? 0 : -1} className="member-segmented-control__tab" onClick={() => onChange(item.value)} onKeyDown={(event) => move(event, index)}>
        <span>{item.label}</span>{typeof item.count === "number" ? <span aria-label={`${item.count}`}> · {item.count}</span> : null}
      </button>;
    })}
  </div>;
}
```

Create `src/components/member/MemberRouteSkeleton.tsx`:

```tsx
import { t } from "@/lib/i18n";

type MemberRoute = "home" | "schedule" | "bookings" | "packages" | "account";
const rowCount: Record<MemberRoute, number> = { home: 2, schedule: 4, bookings: 3, packages: 3, account: 4 };

export function MemberRouteSkeleton({ route }: { route: MemberRoute }) {
  return <div className={`member-route-skeleton member-route-skeleton--${route}`} role="status" aria-live="polite">
    <span className="sr-only">{t("common.loading")}</span>
    <div aria-hidden="true" className="member-route-skeleton__intro skeleton-brand" />
    <div aria-hidden="true" className="member-route-skeleton__rows">{Array.from({ length: rowCount[route] }, (_, index) => <div key={index} className="member-route-skeleton__row skeleton-brand" />)}</div>
  </div>;
}

export function MemberRouteError({ onRetry }: { onRetry: () => void }) {
  return <section className="member-route-error" role="alert">
    <h2 className="member-section__title">{t("member.error.title")}</h2>
    <p>{t("member.error.body")}</p>
    <button type="button" className="btn-outline min-h-11" onClick={onRetry}>{t("common.retry")}</button>
  </section>;
}
```

- [ ] **Step 5: Add the shared editorial utility styles**

Append focused classes to the member section of `src/styles.css`:

```css
.member-page-intro { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:end; gap:clamp(1rem,3vw,2.5rem); padding-block:clamp(1rem,3vw,2rem); border-bottom:1px solid color-mix(in srgb,var(--color-gold) 28%,transparent); }
.member-page-intro__copy { max-width:44rem; text-align:start; }
.member-page-intro__title { margin-top:.35rem; color:var(--color-navy); font-family:var(--font-display); font-size:clamp(2rem,5vw,3.5rem); font-weight:600; line-height:1.05; text-wrap:balance; }
.member-page-intro__body { margin-top:.65rem; max-width:40rem; color:var(--color-slate); font-size:15px; line-height:1.65; }
.member-page-intro__action { margin-top:1rem; min-height:44px; }
.member-section { display:grid; gap:1rem; }
.member-section__heading { display:flex; align-items:end; justify-content:space-between; gap:1rem; border-bottom:1px solid color-mix(in srgb,var(--color-gold) 24%,transparent); padding-bottom:.65rem; text-align:start; }
.member-section__title { color:var(--color-navy); font-family:var(--font-display); font-size:clamp(1.35rem,3vw,1.8rem); font-weight:600; line-height:1.15; }
.member-action-bar { display:flex; min-height:52px; align-items:center; gap:.75rem; }
.member-segmented-control { display:flex; max-width:100%; gap:.25rem; overflow-x:auto; overscroll-behavior-inline:contain; scroll-padding-inline:.5rem; }
.member-segmented-control__tab { flex:0 0 auto; min-height:44px; border-radius:var(--radius-button); padding-inline:1rem; color:var(--color-slate); font-size:13px; font-weight:700; white-space:nowrap; }
.member-segmented-control__tab[aria-selected="true"] { background:var(--color-navy); color:var(--color-ivory); }
.member-route-skeleton { display:grid; gap:1rem; }
.member-route-skeleton__intro { min-height:112px; border-radius:var(--cc-radius-panel); }
.member-route-skeleton__rows { display:grid; gap:.75rem; }
.member-route-skeleton__row { min-height:112px; border-radius:var(--cc-radius-card); }
.member-route-error { display:grid; justify-items:start; gap:.75rem; border-block:1px solid color-mix(in srgb,var(--color-gold) 28%,transparent); padding-block:1.25rem; color:var(--color-slate); text-align:start; }
@media (max-width: 639px) { .member-page-intro { grid-template-columns:1fr; align-items:start; padding-block:.85rem 1.15rem; } .member-page-intro__title { font-size:clamp(1.85rem,9vw,2.45rem); } .member-page-intro__action { width:100%; justify-content:center; } }
@media (prefers-reduced-motion: reduce) { .member-route-transition, .member-segmented-control__tab { animation:none!important; transition:none!important; } }
```

- [ ] **Step 6: Run the component test and verify GREEN**

Run:

```bash
bun test tests/unit/memberPresentationComponents.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit the shared primitives**

```bash
git add src/components/member/MemberPage.tsx src/components/member/MemberSegmentedControl.tsx src/components/member/MemberRouteSkeleton.tsx src/styles.css tests/unit/memberPresentationComponents.test.mjs
git commit -m "feat: add member presentation primitives"
```

## Task 3: Compact member shell and navigation

**Files:**
- Modify: `src/components/app-shell/useRoleNav.ts`
- Modify: `src/components/app-shell/AppShell.tsx`
- Modify: `src/styles.css`
- Create: `tests/unit/memberNavigation.test.mjs`

- [ ] **Step 1: Write failing navigation behavior tests**

Create `tests/unit/memberNavigation.test.mjs`:

```js
import { describe, expect, test } from "bun:test";
import { applyLang } from "../../src/lib/i18n.ts";
import { bottomTabsForRole, isActive } from "../../src/components/app-shell/useRoleNav.ts";

describe("member navigation", () => {
  test("keeps five stable member destinations", () => {
    applyLang("en");
    expect(bottomTabsForRole("member").map((item) => item.to)).toEqual([
      "/member",
      "/member/schedule",
      "/member/bookings",
      "/member/packages",
      "/member/account",
    ]);
  });

  test("uses concise booking labels in all languages", () => {
    applyLang("he");
    expect(bottomTabsForRole("member")[2].label).toBe("הזמנות");
    applyLang("ar");
    expect(bottomTabsForRole("member")[2].label).toBe("الحجوزات");
  });

  test("marks only the exact home route active", () => {
    applyLang("en");
    const home = bottomTabsForRole("member")[0];
    expect(isActive("/member", home)).toBe(true);
    expect(isActive("/member/schedule", home)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
bun test tests/unit/memberNavigation.test.mjs
```

Expected: FAIL because the booking destination still uses `nav.myBookings`.

- [ ] **Step 3: Use concise labels only for member navigation**

In both member arrays in `useRoleNav.ts`, change the bookings item to:

```ts
{ to: "/member/bookings", label: t("nav.memberBookings"), icon: BookOpen },
```

Keep page titles on `nav.myBookings`; only the navigation label becomes shorter.

- [ ] **Step 4: Replace the duplicate desktop title region with one compact member header**

In `AppShell.tsx`, preserve the admin/instructor header branch. For members, render a single desktop header containing `BrandHeaderWordmark`, the five navigation links, `MemberNotificationCenter`, and the 44 px sign-out control. Remove the member-only shell `h1`; route components remain responsible for the single page `h1`.

The member link contract is:

```tsx
<Link
  key={to}
  to={to}
  aria-current={active ? "page" : undefined}
  className={active ? "member-desktop-nav__link member-desktop-nav__link--active" : "member-desktop-nav__link"}
>
  <Icon aria-hidden="true" className="h-4 w-4" />
  <span>{label}</span>
</Link>
```

Change mobile sign-out/notification controls from `h-10 w-10` to `h-11 w-11`. Wrap member route content with:

```tsx
<div key={pathname} className="member-route-transition">{children}</div>
```

Replace the branded hydration card with:

```tsx
<div className="fixed inset-0 bg-ivory text-foreground" dir={isRtl ? "rtl" : "ltr"}>
  <div className="member-content-frame px-4 pt-[calc(env(safe-area-inset-top)+4rem)]">
    <MemberRouteSkeleton route="home" />
  </div>
</div>
```

- [ ] **Step 5: Add member shell, safe-area, focus, and transition styles**

Use a 44 px minimum for every shell action, reserve `var(--member-bottom-nav-offset)` on mobile, style the desktop navigation as one compact horizontal row, and add:

```css
.member-route-transition { animation:member-route-enter 190ms ease-out both; }
@keyframes member-route-enter { from { opacity:.4; transform:translateY(3px); } to { opacity:1; transform:none; } }
.member-desktop-nav__link { position:relative; display:inline-flex; min-height:44px; align-items:center; gap:.45rem; color:var(--color-slate); font-size:14px; }
.member-desktop-nav__link--active { color:var(--color-navy); font-weight:700; }
.member-desktop-nav__link--active::after { content:""; position:absolute; inset-inline:0; bottom:0; height:2px; border-radius:999px; background:var(--color-gold); }
.member-desktop-nav__link:focus-visible, .member-bottom-nav-link:focus-visible { outline:2px solid var(--color-navy); outline-offset:3px; }
```

- [ ] **Step 6: Run focused shell/navigation tests**

Run:

```bash
bun test tests/unit/memberNavigation.test.mjs tests/unit/memberLanguageSynchronization.test.mjs tests/unit/memberPushAutomaticPermission.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit the shell redesign**

```bash
git add src/components/app-shell/useRoleNav.ts src/components/app-shell/AppShell.tsx src/styles.css tests/unit/memberNavigation.test.mjs
git commit -m "feat: refine member shell navigation"
```

## Task 4: Task-first Home page

**Files:**
- Modify: `src/routes/_authenticated/member/index.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Capture the current failing visual assertions from the approved audit baseline**

At 390 by 844, record that the current “Find a class” action is below the first viewport. At 1440 by 1000, record the duplicate shell/route title and enlarged card stack. Use the existing baseline screenshots under:

```text
/Users/ameeramer/.gstack/projects/ameer1996112-cloud-core-studio/designs/design-audit-20260825/screenshots/
```

Expected before implementation: primary action not visible in the first mobile viewport.

- [ ] **Step 2: Replace the image-heavy hero with the shared task-first introduction**

Keep greeting computation, queries, concierge data, and class state derivation unchanged. Replace the route hero with:

```tsx
<MemberPageIntro
  eyebrow={greeting}
  title={lang === "en" ? <span dir="ltr">{t("member.welcomeBackName")} <AutoInline><bdi>{greetingName}</bdi></AutoInline></span> : <span dir="rtl">{t("member.helloName")} <AutoInline><bdi>{greetingName}</bdi></AutoInline></span>}
  body={settings?.welcome_text ?? t("member.welcomeBackStudio")}
  action={{ label: t("member.browseSchedule"), to: "/member/schedule" }}
  aside={<PackageMini activePlan={data?.activePlan} credits={data?.member?.remaining_credits ?? 0} />}
/>
```

This keeps the existing language-specific word order while removing the image hero.

- [ ] **Step 3: Reorder Home content around the member's next action**

Destructure `isError` and `refetch` from the `member-home` query. Immediately after the introduction, render `<MemberRouteError onRetry={() => void refetch()} />` when the core query fails; otherwise use this content order inside the existing route section:

```tsx
{isLoading ? <MemberRouteSkeleton route="home" /> : nextBooking ? (
  <MemberSection id="next-booking" eyebrow={t("member.bookNext")} title={t("member.yourNextClass")} action={<DirectionalMemberLink to="/member/bookings">{t("member.viewBooking")}</DirectionalMemberLink>}>
    <NextBookingCard booking={nextBooking} studioName={settings?.studio_name ?? null} address={settings?.address ?? null} />
  </MemberSection>
) : featuredClass ? (
  <MemberSection id="recommended" eyebrow={t("member.recommendedForYou")} title={t("member.keepPracticeMoving")} action={<DirectionalMemberLink to="/member/schedule">{t("member.allSessions")}</DirectionalMemberLink>}>
    <VisualClassCard cls={featuredClass} state={deriveClassState(featuredClass, { booked:false, waiting:false, remainingCredits:data?.member?.remaining_credits ?? 0, hasActivePackage:!!data?.activePlan })} onOpen={() => setOpenClass(featuredClass.id)} variant="featured" index={0} context="memberHome" eager />
  </MemberSection>
) : (
  <MemberEmptyState variant="schedule" title={t("member.home.emptyTitle")} body={t("member.home.emptyBody")} primaryAction={{ label:t("member.browseSchedule"), to:"/member/schedule" }} />
)}
```

Place announcement immediately after the introduction only when present. Move concierge, weekly promotion, recommended list, and additional bookings below next booking and package status. Remove the separate `QuickActions` card; render studio contact as a quiet link below the primary content.

- [ ] **Step 4: Simplify Home styles and verify responsive order**

Remove route-specific hero image space from the authenticated Home path. Ensure the introduction action and either next-booking header or empty-state prompt fit within 844 px at 390 px width. At desktop, cap the main column and package summary into a deliberate two-column intro rather than a full-width card stack.

- [ ] **Step 5: Run focused Home regressions**

Run:

```bash
bun test tests/unit/personalConciergeExperience.test.mjs tests/unit/lessonCardVariants.test.mjs tests/unit/visualClassCardPackageCta.test.mjs
```

Expected: PASS; concierge destinations, class states, and package CTAs remain unchanged.

- [ ] **Step 6: Commit Home**

```bash
git add src/routes/_authenticated/member/index.tsx src/styles.css
git commit -m "feat: prioritize member home actions"
```

## Task 5: Compact Schedule filters and truthful empty states

**Files:**
- Modify: `src/components/member/MemberScheduleFilterPanel.tsx`
- Modify: `src/routes/member.schedule.tsx`
- Modify: `src/styles.css`
- Create: `tests/unit/memberScheduleFilters.test.mjs`

- [ ] **Step 1: Write failing server-render tests for localized options and the mobile filter trigger**

Render `MemberScheduleFilterPanel` with `level: "all-levels"`, a formatter returning `All levels`, and one active value. Assert:

```js
expect(html).toContain("All levels");
expect(html).not.toContain(">all-levels<");
expect(html).toContain('aria-haspopup="dialog"');
expect(html).toContain("Filters");
expect(html).toContain("1 active");
```

Mock the project `Sheet` module as semantic dialog elements so the test observes the public trigger/label contract without depending on Radix internals.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
bun test tests/unit/memberScheduleFilters.test.mjs
```

Expected: FAIL because secondary filters are currently inline and there is no dialog trigger.

- [ ] **Step 3: Split primary and secondary Schedule controls**

Import `DateScope`, `ScheduleFilterState`, and `countActiveScheduleFilters` from `@/lib/member-ui`, remove the local duplicate types, and export `DateScope` from the filter module for existing callers. Add an `onClearAll: () => void` prop. Keep search and date scope in a compact `MemberActionBar`. On mobile, render a `Sheet` trigger with the total active count and place only level, energy, room, and instructor groups inside `SheetContent side="bottom"`. On desktop, render those groups inline.

```ts
import { countActiveScheduleFilters, type DateScope, type ScheduleFilterState } from "@/lib/member-ui";
export type { DateScope } from "@/lib/member-ui";

const secondaryFilters = Object.fromEntries(filters.map((group) => [group.key, group.value])) as ScheduleFilterState;
const activeFilterCount = countActiveScheduleFilters(search, dateScope, secondaryFilters);
```

The trigger contract is:

```tsx
<SheetTrigger asChild>
  <button type="button" className="member-filter-trigger" aria-haspopup="dialog">
    <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
    <span>{t("member.schedule.filter.open")}</span>
    {activeFilterCount > 0 ? <span className="member-filter-trigger__count">{t("member.schedule.filter.count", { count: activeFilterCount })}</span> : null}
  </button>
</SheetTrigger>
```

Use `SheetTitle`, `SheetDescription`, `SheetClose`, and the existing reset callback. Rely on Radix Dialog for focus trap, Escape close, background inertness, and trigger focus restoration.

- [ ] **Step 4: Use shared empty-state classification only in the authenticated schedule**

In `MemberScheduleContent`, calculate:

```ts
function clearAllFilters() {
  setSearch("");
  setDateScope("all");
  setFilter({});
}

const activeFilterCount = countActiveScheduleFilters(search, dateScope, filter);
const emptyStateKind = getScheduleEmptyStateKind(classes.length, filtered.length, activeFilterCount);
```

Pass `onClearAll={clearAllFilters}` into `MemberScheduleFilterPanel` and use that callback for both the desktop reset control and the mobile sheet reset control.

For a signed-in member, select exact copy without a dynamic message key:

```tsx
const emptyTitle = emptyStateKind === "filtered"
  ? t("member.schedule.empty.filtered.title")
  : t("member.schedule.empty.inventory.title");
const emptyBody = emptyStateKind === "filtered"
  ? t("member.schedule.empty.filtered.body")
  : t("member.schedule.empty.inventory.body");
```

Render `MemberEmptyState` with `emptyTitle` and `emptyBody`. When `emptyStateKind === "filtered"`, render a neighboring `button type="button"` calling the existing `clearAllFilters` callback; do not widen `MemberEmptyState`'s route-link action type. Keep guest empty-state links and guest auth intent exactly as they are.

- [ ] **Step 5: Replace the authenticated Schedule hero and loader**

For `session !== null`, use `MemberPageIntro` with schedule title, concise body, and credits aside; remove the large panel and stat card. Destructure `isError` and `refetch` from the schedule query, render `<MemberRouteError onRetry={() => void refetch()} />` for authenticated query failure, and replace four generic rectangles with `<MemberRouteSkeleton route="schedule" />`. Do not change the public guest hero or public guest statistics.

- [ ] **Step 6: Apply responsive filter sizing**

The mobile search input, date segments, filter trigger, reset control, chips, and sheet actions must all be at least 44 px high. Hide `.member-schedule-secondary-filters--desktop` below 768 px and hide the sheet trigger from 768 px upward. Keep search plus date controls within the first mobile viewport above class inventory.

- [ ] **Step 7: Run Schedule regressions**

Run:

```bash
bun test tests/unit/memberScheduleFilters.test.mjs tests/unit/guestScheduleGuestHandoff.test.mjs tests/unit/guestAuthIntent.test.mjs tests/unit/lessonCardVariants.test.mjs
```

Expected: PASS, including the unchanged public guest handoff.

- [ ] **Step 8: Commit Schedule**

```bash
git add src/components/member/MemberScheduleFilterPanel.tsx src/routes/member.schedule.tsx src/styles.css tests/unit/memberScheduleFilters.test.mjs
git commit -m "feat: streamline member schedule filters"
```

## Task 6: Responsive Bookings workspace

**Files:**
- Modify: `src/routes/_authenticated/member/bookings.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Verify the shared segmented-control RED baseline at 320 px**

Use the existing audit finding as the failing visual assertion: the cancelled category begins outside the 390 px viewport. Also verify the shared component test fails if a non-selected tab is not `tabIndex=-1` or if focus does not reveal an off-screen tab.

- [ ] **Step 2: Replace the image hero and custom tab row**

Use:

```tsx
<MemberPageIntro
  eyebrow={t("member.bookings.kicker")}
  title={t("nav.myBookings")}
  body={t("member.bookings.body")}
  aside={<div className="member-booking-counts"><StatCell label={t("bookings.upcoming")} value={counts.upcoming} /><StatCell label={t("bookings.waitlist")} value={counts.waitlist} /></div>}
/>
<MemberSegmentedControl
  label={t("nav.myBookings")}
  value={tab}
  onChange={setTab}
  dir={dir}
  items={[
    { value:"upcoming", label:t("bookings.upcoming"), count:counts.upcoming },
    { value:"waitlist", label:t("bookings.waitlist"), count:counts.waitlist },
    { value:"past", label:t("bookings.past"), count:counts.past },
    { value:"cancelled", label:t("bookings.cancelled"), count:counts.cancelled },
  ]}
/>
```

Remove the atmosphere image and the old `.member-tab-bar` markup.

- [ ] **Step 3: Tighten booking cards without changing operations**

Keep `memberCancelBooking`, `leaveWaitlist`, query invalidations, calendar creation, WhatsApp support, and `ClassDetailSheet` unchanged. Make class/date/instructor/status the visible card hierarchy. Keep cancellation inside the action row, style it as a secondary text action, and ensure calendar/contact/cancel targets are 44 px high.

- [ ] **Step 4: Replace generic loading rectangles**

Destructure `isError` and `refetch` from `my-bookings-all`. Use separate observable loading, error, empty, and content branches:

```tsx
{isLoading ? <MemberRouteSkeleton route="bookings" /> : null}
{!isLoading && isError ? <MemberRouteError onRetry={() => void refetch()} /> : null}
{!isLoading && !isError && current.length === 0 ? (
  <MemberEmptyState
    variant={tab === "upcoming" ? "bookings" : "cloudCard"}
    title={tab === "upcoming" ? t("member.empty.bookings.title") : tab === "waitlist" ? t("member.empty.waitlist.title") : tab === "past" ? t("member.empty.past.title") : t("member.empty.cancelled.title")}
    body={tab === "upcoming" ? t("member.empty.bookings.body") : tab === "waitlist" ? t("member.empty.waitlist.body") : tab === "past" ? t("member.empty.past.body") : t("member.empty.cancelled.body")}
    primaryAction={tab === "upcoming" ? { label:t("member.browseSchedule"), to:"/member/schedule" } : undefined}
  />
) : null}
{!isLoading && !isError && current.length > 0 ? <div className="space-y-3">{tab === "waitlist" ? waitlist.map((entry) => <WaitlistCard key={entry.id} entry={entry} onOpen={() => setOpenClass(entry.class.id)} onLeave={() => leave.mutate(entry.id)} />) : current.map((booking) => <BookingCard key={booking.id} booking={booking} attendance={attMap[booking.id]} onOpen={() => setOpenClass(booking.class.id)} onCancel={tab === "upcoming" ? () => setConfirmCancel(booking) : undefined} muted={tab !== "upcoming"} studio={settings ?? null} />)}</div> : null}
```

- [ ] **Step 5: Run booking regressions and component semantics**

Run:

```bash
bun test tests/unit/memberPresentationComponents.test.mjs tests/unit/guestScheduleGuestHandoff.test.mjs tests/unit/lessonCardVariants.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit Bookings**

```bash
git add src/routes/_authenticated/member/bookings.tsx src/styles.css
git commit -m "feat: improve member bookings workspace"
```

## Task 7: Purchase-first Packages page

**Files:**
- Modify: `src/routes/_authenticated/member/packages.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Record the failing mobile inventory-order assertion**

At 390 by 844, confirm the first package purchase action currently begins near 1.5 viewports below the top. The acceptance assertion is that the first visible package and purchase action appear before long explanatory copy and history.

- [ ] **Step 2: Replace the large pricing introduction with a compact status introduction**

Use `MemberPageIntro` with `t("nav.plans")`, `t("member.packages.body")`, and a concise active-package/credit aside. Do not put value-chip marketing text before inventory.

- [ ] **Step 3: Move available packages immediately after the introduction**

Destructure `isError` and `refetch` from the package query. Render the package grid in a labeled section before subscription details, value chips, credit history, and payment history:

```tsx
<MemberSection id="available-packages" eyebrow={t("member.packages.kicker")} title={t("packages.available")}>
  {isLoading ? <MemberRouteSkeleton route="packages" /> : isError ? <MemberRouteError onRetry={() => void refetch()} /> : visiblePlans.length === 0 ? (
    <MemberEmptyState variant="packages" title={t("member.empty.packages.title")} body={t("member.empty.packages.body")} />
  ) : (
    <div className="package-pricing-grid">
      {visiblePlans.map((plan) => <PackagePricingCard key={plan.id} plan={plan} lang={lang} request={requestsByPlan[plan.id]} payment={pendingPayments.find((payment) => payment.plan?.id === plan.id)} onRequest={() => setSelectedPlan(plan)} pending={manualPayment.isPending || checkoutPayment.isPending || hasUsableActivePackage || hasRunningSubscription} blockedByActivePackage={hasUsableActivePackage || hasRunningSubscription} />)}
    </div>
  )}
</MemberSection>
```

- [ ] **Step 4: Simplify package cards and preserve checkout behavior**

Keep `PackagePricingCard` responsible for name, formatted price, credit allowance, validity, recommended treatment, pending state, and purchase request. Raise every purchase/control target to 44 px. Replace heavy recommendation banners with the existing gold border/accent. Do not change `submitPayment`, `PaymentMethodSheet`, online/manual method selection, terms consent, subscription cancellation, or payment history filtering.

- [ ] **Step 5: Move explanation and history below inventory**

Keep credit and payment history as quiet disclosure-style sections after purchasable inventory. Retain receipts and all current data. Place value chips and terms beneath the package grid, not above it.

- [ ] **Step 6: Run package/checkout regressions**

Run:

```bash
bun test tests/unit/visualClassCardPackageCta.test.mjs tests/unit/transactionalEmail.test.mjs tests/unit/conciergeEmail.test.mjs
```

Expected: PASS; direct package destinations and receipt/payment links remain intact.

- [ ] **Step 7: Commit Packages**

```bash
git add src/routes/_authenticated/member/packages.tsx src/styles.css
git commit -m "feat: prioritize member package purchase"
```

## Task 8: Accessible grouped Profile page

**Files:**
- Create: `src/components/member/MemberField.tsx`
- Modify: `src/routes/_authenticated/member/account.tsx`
- Modify: `src/styles.css`
- Create: `tests/unit/memberProfileFields.test.mjs`

- [ ] **Step 1: Write a failing server-render test for label association**

Add `tests/unit/memberProfileFields.test.mjs`:

```js
import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemberField } from "../../src/components/member/MemberField.tsx";

test("profile field associates its label and control", () => {
  const html = renderToStaticMarkup(
    React.createElement(MemberField, { id:"profile-name", label:"Name" }, React.createElement("input", { value:"", readOnly:true })),
  );
  expect(html).toContain('for="profile-name"');
  expect(html).toContain('id="profile-name"');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
bun test tests/unit/memberProfileFields.test.mjs
```

Expected: FAIL because `MemberField.tsx` does not exist.

- [ ] **Step 3: Create a focused field component and associate its single form control**

Create `src/components/member/MemberField.tsx`:

```tsx
import { cloneElement, type ReactElement } from "react";

export function MemberField({ id, label, children }: { id:string; label:string; children:ReactElement<{ id?:string; "aria-describedby"?:string }> }) {
  return <div className="member-field"><label htmlFor={id} className="field-label">{label}</label>{cloneElement(children, { id })}</div>;
}
```

Import `MemberField` in the account route, remove its local `Field`, and give stable IDs to every identity, language, concierge, deletion, checkbox, and textarea field.

- [ ] **Step 4: Replace the image hero with a compact account introduction**

Destructure `isLoading`, `isError`, and `refetch` from the `member-packages` profile query. Render `<MemberRouteSkeleton route="account" />` while loading and `<MemberRouteError onRetry={() => void refetch()} />` on failure. Once loaded, use `MemberPageIntro` with the member name as the sole route `h1`, email/body below, and status/language chips in the aside. Remove the logo-wall image and duplicate card framing.

- [ ] **Step 5: Group routine, concierge, session, and privacy actions semantically**

Use `MemberSection` for `profile-details`, `between-us`, `session`, and `privacy`. Use whitespace/dividers rather than wrapping every section in `.member-card`. Keep sign-out and deletion separate from routine settings. Use an inline `role="status"` near the save button for pending/success/error state while retaining existing toasts.

The personalization checkbox contract is:

```tsx
<div className="member-toggle-row">
  <input id="concierge-paused" type="checkbox" checked={concierge?.relationship?.personalization_paused === true} onChange={(event) => pauseBetweenUs.mutate(event.target.checked)} disabled={pauseBetweenUs.isPending} />
  <label htmlFor="concierge-paused">{conciergeCopy.pause}</label>
</div>
```

- [ ] **Step 6: Increase input and action targets**

Inputs remain at least 44 px high; checkboxes use a 20 px visual control inside a 44 px row; save, sign-out, privacy links, and deletion request use at least 44 px targets. Ensure destructive styling remains legible and separate.

- [ ] **Step 7: Run profile regressions**

Run:

```bash
bun test tests/unit/memberProfileFields.test.mjs tests/unit/memberProfileLanguage.test.mjs tests/unit/memberLanguageSynchronization.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit Profile**

```bash
git add src/components/member/MemberField.tsx src/routes/_authenticated/member/account.tsx src/styles.css tests/unit/memberProfileFields.test.mjs
git commit -m "feat: improve member profile accessibility"
```

## Task 9: Cross-route responsive polish and verification

**Files:**
- Modify: `src/styles.css`
- Modify only if a defect is found: the member files changed in Tasks 1–8
- Update: this plan's checkboxes during execution

- [ ] **Step 1: Install exactly the locked dependencies**

Run:

```bash
bun install
```

Expected: dependencies install successfully without changing application source or committing environment files.

- [ ] **Step 2: Run all focused member tests**

Run:

```bash
bun test tests/unit/memberUi.test.mjs tests/unit/memberPresentationComponents.test.mjs tests/unit/memberNavigation.test.mjs tests/unit/memberScheduleFilters.test.mjs tests/unit/memberProfileFields.test.mjs tests/unit/i18n.test.mjs tests/unit/guestScheduleGuestHandoff.test.mjs tests/unit/guestAuthIntent.test.mjs tests/unit/memberProfileLanguage.test.mjs tests/unit/memberLanguageSynchronization.test.mjs tests/unit/lessonCardVariants.test.mjs tests/unit/visualClassCardPackageCta.test.mjs
```

Expected: PASS with zero failures.

- [ ] **Step 3: Run the full automated suite**

Run:

```bash
bun test tests/unit tests/integration
```

Expected: PASS with zero failures. Fix only regressions caused by this branch; document unrelated pre-existing failures rather than masking them.

- [ ] **Step 4: Run lint and production build**

Run:

```bash
bun run lint
bun run build
```

Expected: both commands exit 0.

- [ ] **Step 5: Perform authenticated browser QA in all languages**

Verify Home, Schedule, Bookings, Packages, and Profile at 320, 390, 768, 1024, and 1440 CSS pixels. For Hebrew and Arabic verify RTL alignment, tab reveal, date arrows, sheet placement, chips, and safe areas. For English verify LTR alignment. Confirm no horizontal page overflow and no primary action is hidden by bottom navigation.

- [ ] **Step 6: Perform keyboard and reduced-motion QA**

Verify navigation, booking tabs, schedule filter sheet, profile fields, dialogs, and actions by keyboard. Confirm visible focus, Escape close, focus restoration, sheet focus trapping, live status behavior, and `prefers-reduced-motion` suppression.

- [ ] **Step 7: Capture final QA screenshots**

Capture mobile 390 by 844 and desktop 1440 by 1000 screenshots for all five routes in Hebrew, plus representative Arabic and English screenshots for direction validation. Store them in a new dated directory adjacent to the approved audit baseline and include the absolute directory path in the handoff.

- [ ] **Step 8: Run code review and apply verified fixes**

Use the repository `code-review` skill against the complete branch diff. Re-run the focused test that covers each accepted fix, followed by lint and build if source changes.

- [ ] **Step 9: Commit final verified polish**

```bash
git add docs/superpowers/plans/2026-08-25-member-ui-redesign.md src/styles.css src/components/member/MemberField.tsx src/components/member/MemberPage.tsx src/components/member/MemberRouteSkeleton.tsx src/components/member/MemberScheduleFilterPanel.tsx src/components/member/MemberSegmentedControl.tsx src/components/app-shell/AppShell.tsx src/components/app-shell/useRoleNav.ts src/routes/member.schedule.tsx src/routes/_authenticated/member/index.tsx src/routes/_authenticated/member/bookings.tsx src/routes/_authenticated/member/packages.tsx src/routes/_authenticated/member/account.tsx src/lib/member-ui.ts src/lib/i18n.ts tests/unit/memberUi.test.mjs tests/unit/memberPresentationComponents.test.mjs tests/unit/memberNavigation.test.mjs tests/unit/memberScheduleFilters.test.mjs tests/unit/memberProfileFields.test.mjs tests/unit/i18n.test.mjs
git commit -m "fix: finalize member experience redesign"
```

- [ ] **Step 10: Confirm delivery boundary**

Verify `git status --short` is clean and report the branch plus commits. Do not push, merge, deploy, migrate, submit an App Store build, enable Yoga promotion, or modify the isolated App Store branch unless the user separately authorizes that action.
