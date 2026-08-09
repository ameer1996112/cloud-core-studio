# Admin Recent Bookings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin overview count only upcoming scheduled bookings and show the six newest bookings with enough context to identify them.

**Architecture:** Query booked rows joined to future scheduled classes and members in `adminOverview`, then pass them through a pure projection helper. The helper owns defensive filtering, QA/test exclusion, sorting, and the shared count/list projection so the KPI and visible list cannot drift.

**Tech Stack:** TypeScript, TanStack Start server functions, Supabase/PostgREST, React, TanStack Router, Bun Test.

## Global Constraints

- Keep the existing generic recent-activity panel unchanged.
- Exclude QA/test classes with the existing `hasTestClassRecord` policy.
- Do not add a database migration or a dedicated bookings page.
- Preserve all unrelated workspace changes.

---

### Task 1: Active-booking projection

**Files:**
- Create: `src/lib/adminOverviewBookings.ts`
- Create: `tests/unit/adminOverviewBookings.test.ts`

**Interfaces:**
- Consumes: booking rows shaped as `{ id, status, created_at, member, class }` from Supabase.
- Produces: `projectAdminOverviewBookings(rows, now, recentLimit?)` returning `{ activeBookings: number, recentBookings: AdminOverviewRecentBooking[] }`.

- [x] **Step 1: Write the failing projection tests**

Create fixtures for one valid upcoming booking plus past, cancelled-booking, cancelled-class, missing-class, and `QA_TEST` class rows. Assert that only the valid row contributes to `activeBookings`. Add a second test with eight valid rows and one newest row missing its member relation; assert that the count includes all nine valid class bookings while `recentBookings` omits the missing-member row, sorts newest-first, and returns six rows.

```ts
const result = projectAdminOverviewBookings(rows, new Date("2026-08-09T07:00:00Z"));
expect(result.activeBookings).toBe(1);
expect(result.recentBookings.map((booking) => booking.id)).toEqual(["upcoming"]);
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `bun test tests/unit/adminOverviewBookings.test.ts`

Expected: FAIL because `src/lib/adminOverviewBookings.ts` does not exist.

- [x] **Step 3: Implement the minimal pure projection**

Normalize Supabase to-one relations that may arrive as an object or one-element array. Keep rows only when `status === "booked"`, the class exists, the class status is `scheduled`, `starts_at >= now`, and `hasTestClassRecord(row)` is false. Sort by `created_at` descending. Count every valid class booking, but only expose rows with a member in the recent list.

```ts
export function projectAdminOverviewBookings(
  rows: AdminOverviewBookingRow[],
  now: Date,
  recentLimit = 6,
) {
  const active = rows.filter((row) => isActiveOverviewBooking(row, now));
  return {
    activeBookings: active.length,
    recentBookings: active
      .map(normalizeRecentBooking)
      .filter((row): row is AdminOverviewRecentBooking => row !== null)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, recentLimit),
  };
}
```

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `bun test tests/unit/adminOverviewBookings.test.ts`

Expected: PASS with two tests and no warnings.

---

### Task 2: Overview query and recent-bookings panel

**Files:**
- Modify: `src/lib/admin.functions.ts:216-307`
- Modify: `src/routes/_authenticated/admin/index.tsx:86-260`
- Modify: `src/lib/i18n.ts` in the English, Hebrew, and Arabic overview key groups

**Interfaces:**
- Consumes: `projectAdminOverviewBookings` from Task 1.
- Produces: `adminOverview()` fields `activeBookings` and `recentBookings` for the overview route.

- [x] **Step 1: Extend the server query**

Replace the count-only bookings query with a joined row query. Use `classes!inner` so the PostgREST class filters constrain root bookings.

```ts
supabase
  .from("bookings")
  .select(
    "id,status,created_at,member:members(id,name),class:classes!inner(id,title,starts_at,status,room,instructor:instructors(id,name),room_ref:rooms(id,name),program_type:program_types(id,name_en,name_he,name_ar,level))",
  )
  .eq("status", "booked")
  .eq("class.status", "scheduled")
  .gte("class.starts_at", now.toISOString())
  .order("created_at", { ascending: false })
```

Throw when this required query errors, pass its rows to `projectAdminOverviewBookings`, and return both projected fields.

- [x] **Step 2: Add localized copy**

Add the same three keys to every locale:

```ts
"admin.overview.recentBookings": "Recent bookings",
"admin.overview.noRecentBookings": "No upcoming bookings yet.",
"admin.overview.bookedAt": "Booked {date}",
```

Use natural Hebrew and Arabic translations for those locale blocks.

- [x] **Step 3: Render the compact panel**

Change the final overview grid to three columns on large screens. Add a panel beside recent activity. For each row, link to `/admin/classes/$id`; show `member.name`, `localizedClassTitle(booking.class, lang)`, localized class date/time, and `t("admin.overview.bookedAt", { date: localizedCreatedAt })`. Render `noRecentBookings` when the array is empty.

- [x] **Step 4: Run focused and localization tests**

Run: `bun test tests/unit/adminOverviewBookings.test.ts tests/unit/i18n.test.mjs`

Expected: PASS.

---

### Task 3: Verification and handoff

**Files:**
- Modify only files already listed if verification finds an issue.

**Interfaces:**
- Consumes: completed Tasks 1 and 2.
- Produces: a buildable, lint-clean admin overview change.

- [x] **Step 1: Check the final diff and test policy**

Run: `git diff --check && git diff -- src/lib/adminOverviewBookings.ts tests/unit/adminOverviewBookings.test.ts src/lib/admin.functions.ts src/routes/_authenticated/admin/index.tsx src/lib/i18n.ts`

Expected: no whitespace errors and no unrelated edits.

- [x] **Step 2: Run the full required verification**

Run: `bun test tests/unit`

Run: `bun run lint`

Run: `bun run build`

Expected: every command exits 0.

- [x] **Step 3: Re-run the production-data symptom check**

Run the existing read-only Supabase comparison used during diagnosis and verify that the dashboard projection count equals the number of upcoming scheduled non-test bookings rather than all historical `booked` rows.

- [x] **Step 4: Commit the implementation**

```bash
git add src/lib/adminOverviewBookings.ts tests/unit/adminOverviewBookings.test.ts src/lib/admin.functions.ts src/routes/_authenticated/admin/index.tsx src/lib/i18n.ts docs/superpowers/plans/2026-08-09-admin-recent-bookings.md
git commit -m "fix: show active and recent bookings accurately"
```
