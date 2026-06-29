# Cloud & Core UI Audit Implementation Queue

## Purpose

This is the execution queue for the full UI audit. It turns the audit findings into a working implementation plan with:

- pass order
- priority
- status
- owner
- file scope
- exact fix direction
- acceptance checks

Use status values only from this set:

- `Not started`
- `In progress`
- `Needs QA`
- `Done`

---

## Recommended Execution Order

### Pass 1 — Shared Foundations

Do these first. They unblock the rest of the UI work.

1. `rtl-1` — direction-aware shared primitives
2. `rtl-2` — remove physical left/right layout rules from admin
3. `color-2` — fix low-contrast gold text on ivory/sand surfaces
4. `rtl-3` — stabilize root `lang/dir` behavior before hydration
5. `rtl-4` — standardize icon and mixed-content bidi handling

### Pass 2 — System Cleanup

Apply the design system consistently after the foundations are fixed.

6. `color-1`
7. `color-3`
8. `color-4`
9. `type-1`
10. `type-2`
11. `type-3`
12. `type-4`

### Pass 3 — Surface Verification and Premium Polish

Run the authenticated surface pass only after the shared fixes are in place.

13. `resp-1`
14. `resp-2`
15. `resp-3`
16. `resp-4`
17. `premium-1`
18. `premium-2`
19. `premium-3`
20. `premium-4`
21. `premium-5`

---

## Detailed Queue

### 1. `rtl-1`

- Pass: `Shared foundations`
- Priority: `High`
- Status: `Done`
- Owner: `frontend/shared-ui`
- File scope:
  - `src/components/ui/table.tsx`
  - `src/components/ui/dialog.tsx`
  - `src/components/ui/drawer.tsx`
  - `src/components/ui/accordion.tsx`
  - `src/components/ui/sheet.tsx`
  - `src/components/ui/sidebar.tsx`
- Problem:
  Shared UI primitives still assume LTR in alignment, headers, drawer origin, and text flow.
- Fix:
  Make shared primitives direction-aware using logical alignment, mirrored placement, and RTL-safe headers/footers. Remove baked-in `text-left`, `left`, `right`, and fixed side assumptions where they affect layout.
- Acceptance check:
  Hebrew, Arabic, and English screenshots pass for dialogs, drawers, sheets, sidebar, and table headers; no alignment leaks; no horizontal overflow.

### 2. `rtl-2`

- Pass: `Shared foundations`
- Priority: `High`
- Status: `Done`
- Owner: `admin-ui`
- File scope:
  - `src/routes/_authenticated/admin/calendar.tsx`
  - `src/routes/_authenticated/admin/messages.tsx`
  - `src/routes/_authenticated/admin/index.tsx`
  - `src/routes/_authenticated/admin/reports.tsx`
  - `src/routes/_authenticated/admin/rooms.tsx`
  - `src/routes/_authenticated/admin/members/$id.tsx`
  - `src/routes/_authenticated/admin/payments.tsx`
- Problem:
  Admin routes still contain physical spacing and alignment rules such as `left/right`, `pr/pl`, `border-r`, and `text-left`.
- Fix:
  Replace physical layout rules with logical properties or shared utility classes. Keep route markup direction-neutral wherever possible.
- Acceptance check:
  No critical admin surface depends on physical left/right styling for correct RTL rendering. Hebrew and Arabic mirror correctly on mobile, tablet, and desktop.

### 3. `color-2`

- Pass: `Shared foundations`
- Priority: `High`
- Status: `Needs QA`
- Owner: `design-system`
- File scope:
  - `src/styles.css`
  - member/admin route microcopy using gold-on-ivory text
  - `src/components/member/ClassDetailSheet.tsx`
  - `src/routes/_authenticated/receipts/$id.tsx`
  - `src/routes/_authenticated/member/packages.tsx`
  - `src/components/admin/StudioPulse.tsx`
- Problem:
  Small gold text on ivory and sand surfaces is too low-contrast for repeated reading.
- Fix:
  Restrict gold to accent lines, borders, and stronger pill states. Move small text labels to navy or slate where contrast is required.
- Acceptance check:
  Small text and helper labels meet WCAG AA contrast on ivory and sand surfaces; no important label relies on pale gold text.

### 4. `rtl-3`

- Pass: `Shared foundations`
- Priority: `Medium`
- Status: `Needs QA`
- Owner: `app-shell`
- File scope:
  - `src/routes/__root.tsx`
  - `src/lib/i18n.ts`
- Problem:
  The root document ships as Hebrew RTL and then flips client-side after load.
- Fix:
  Reduce hydration dependence for `lang/dir` initialization and make the first paint align with the persisted language more reliably.
- Acceptance check:
  English initial load does not show RTL leakage before the client settles; Hebrew and Arabic still boot RTL correctly.

### 5. `rtl-4`

- Pass: `Shared foundations`
- Priority: `Medium`
- Status: `Needs QA`
- Owner: `localization/ui`
- File scope:
  - `src/components/app-shell/AppShell.tsx`
  - `src/components/visual/VisualClassCard.tsx`
  - `src/components/member/ClassDetailSheet.tsx`
  - `src/components/ui/navigation-menu.tsx`
  - shared icon/button patterns in admin routes
- Problem:
  Mixed English/Hebrew/Arabic content and directional icons are handled unevenly across the app.
- Fix:
  Standardize `dir="auto"`, `<bdi>`, mirrored chevrons/arrows, and bidi-safe punctuation for mixed titles, labels, and back actions.
- Acceptance check:
  Branded English names inside Hebrew/Arabic layouts display cleanly; back arrows, chevrons, and disclosure icons feel correct in RTL and LTR.

### 6. `color-1`

- Pass: `System cleanup`
- Priority: `High`
- Status: `In progress`
- Owner: `design-system`
- File scope:
  - `src/styles.css`
  - route files with hardcoded hex values
  - `src/components/app-shell/AppShell.tsx`
  - `src/routes/_authenticated/admin/*`
  - `src/routes/_authenticated/member/*`
- Problem:
  The brand palette is consistent, but many screens still use route-level or inline hardcoded colors.
- Fix:
  Replace remaining one-off hex values with semantic tokens and route through shared utility classes where possible.
- Acceptance check:
  No unapproved hardcoded UI colors remain outside token definitions, image assets, or documented exceptions.

### 7. `color-3`

- Pass: `System cleanup`
- Priority: `Medium`
- Status: `Not started`
- Owner: `design-system`
- File scope:
  - `src/styles.css`
  - `src/components/ui/button.tsx`
  - `src/components/ui/badge.tsx`
  - status chips in admin/member routes
- Problem:
  Error, warning, success, and destructive states are not fully unified.
- Fix:
  Define one calm destructive system and one success system, then map route-level chips, badges, and notices onto them.
- Acceptance check:
  Delete/remove/cancel/failed states all use the same token family; success states are visually consistent across member and admin pages.

### 8. `color-4`

- Pass: `System cleanup`
- Priority: `Medium`
- Status: `Not started`
- Owner: `admin-ui`
- File scope:
  - `src/styles.css`
  - `src/components/admin-shared/index.tsx`
  - `src/routes/_authenticated/admin/index.tsx`
  - `src/routes/_authenticated/admin/reports.tsx`
  - `src/routes/_authenticated/admin/settings.tsx`
- Problem:
  Admin surfaces are harmonious, but not all panels, cards, and framed tools follow a clear hierarchy.
- Fix:
  Formalize admin surface tiers for page panel, data card, modal, notice, and metric card.
- Acceptance check:
  Admin pages read as one visual system with predictable surface depth and border/shadow behavior.

### 9. `type-1`

- Pass: `System cleanup`
- Priority: `Medium`
- Status: `Not started`
- Owner: `design-system`
- File scope:
  - `src/styles.css`
  - font setup in `src/routes/__root.tsx`
- Problem:
  Arabic has a dedicated font path, but Hebrew and English still share the same main sans/display behavior.
- Fix:
  Decide whether English should use a different functional sans or display treatment without hurting Hebrew quality. Keep Arabic explicit.
- Acceptance check:
  English, Hebrew, and Arabic each feel intentional and readable; no script looks like a fallback compromise.

### 10. `type-2`

- Pass: `System cleanup`
- Priority: `High`
- Status: `Needs QA`
- Owner: `design-system`
- File scope:
  - `src/styles.css`
  - chips, microcopy, helper text, receipts, roster, packages, messages, reports
- Problem:
  The app still uses too much `9px–11px` UI text in important labels and statuses.
- Fix:
  Raise minimum readable sizes on mobile and normalize chip/helper scales.
- Acceptance check:
  No critical mobile UI depends on `9px` text; support text remains readable without zoom.

### 11. `type-3`

- Pass: `System cleanup`
- Priority: `High`
- Status: `Needs QA`
- Owner: `localization/ui`
- File scope:
  - `src/styles.css`
  - route markup with repeated `uppercase tracking-[...]`
  - `src/components/admin/StudioPulse.tsx`
  - `src/components/admin/ClassRosterDrawer.tsx`
  - `src/routes/_authenticated/admin/calendar.tsx`
  - `src/routes/_authenticated/admin/index.tsx`
  - `src/routes/_authenticated/admin/classes/index.tsx`
  - `src/routes/_authenticated/admin/classes/$id.tsx`
  - `src/routes/_authenticated/admin/messages.tsx`
  - `src/routes/_authenticated/admin/attendance.tsx`
  - `src/routes/_authenticated/admin/payments.tsx`
  - `src/routes/_authenticated/admin/members/$id.tsx`
  - `src/routes/_authenticated/admin/reports.tsx`
  - `src/routes/_authenticated/member/packages.tsx`
  - `src/routes/_authenticated/member/bookings.tsx`
- Problem:
  Hebrew and Arabic readability still depends too much on global RTL override hacks to neutralize uppercase and tracking.
- Fix:
  Remove uppercase/tracking misuse from the source components instead of relying on global correction rules.
- Acceptance check:
  Hebrew and Arabic labels look natural without depending on global RTL text resets to remain usable.

### 12. `type-4`

- Pass: `System cleanup`
- Priority: `Medium`
- Status: `In progress`
- Owner: `frontend/shared-ui`
- File scope:
  - route files still using literal radii
  - `src/styles.css`
  - shared cards/buttons/chips
- Problem:
  The visual system is normalized at runtime, but the source still mixes multiple literal radii.
- Fix:
  Replace route-level radius literals with token-backed classes and shared component variants.
- Acceptance check:
  Buttons, inputs, cards, chips, and icon buttons use the documented radius scale in source, not just in compatibility CSS.

### 13. `resp-1`

- Pass: `Surface verification`
- Priority: `High`
- Status: `In progress`
- Owner: `qa/frontend`
- File scope:
  - authenticated member routes
  - `src/routes/_authenticated/member/index.tsx`
  - `schedule.tsx`
  - `bookings.tsx`
  - `packages.tsx`
  - `account.tsx`
  - `src/routes/_authenticated/receipts/$id.tsx`
- Problem:
  The member surface is polished in code and prior artifacts, but it still needs a fresh authenticated pass after the shared fixes land.
- Fix:
  Run a full member browser sweep in Hebrew, Arabic, and English on phone, tablet, and desktop.
- Acceptance check:
  Authenticated member home, schedule, class detail, bookings, packages, payment sheet, profile, and receipts pass with 0 console errors and no overflow.

### 14. `resp-2`

- Pass: `Surface verification`
- Priority: `High`
- Status: `Not started`
- Owner: `admin-ui`
- File scope:
  - `src/routes/_authenticated/admin/calendar.tsx`
  - `messages.tsx`
  - `reports.tsx`
  - `payments.tsx`
  - `members/index.tsx`
- Problem:
  Dense admin data views are still uneven between mobile and desktop.
- Fix:
  Define one mobile-first admin data pattern for filters, row cards, stats, secondary actions, and mobile overflow handling.
- Acceptance check:
  Admin dense-data routes remain readable and operable on 390px, 820px, and 1440px without ad hoc layout fixes.

### 15. `resp-3`

- Pass: `Surface verification`
- Priority: `Medium`
- Status: `Not started`
- Owner: `frontend/shared-ui`
- File scope:
  - `src/components/ui/dialog.tsx`
  - `src/components/ui/drawer.tsx`
  - `src/components/ui/sheet.tsx`
  - modal-heavy routes in admin/member
- Problem:
  Modal, sheet, and drawer viewport behavior is not yet standardized across the app.
- Fix:
  Normalize max heights, internal scrolling, sticky action rows, and safe-area handling.
- Acceptance check:
  Dialogs and sheets fit correctly on small phones, iPad, and desktop; actions stay visible and no content is clipped.

### 16. `resp-4`

- Pass: `Surface verification`
- Priority: `Medium`
- Status: `Not started`
- Owner: `qa/tooling`
- File scope:
  - browser QA scripts
  - screenshot output under `tmp/`
- Problem:
  Current QA evidence is good but fragmented by feature pass.
- Fix:
  Add one reusable screenshot-based regression matrix for Hebrew/Arabic/English and key breakpoints.
- Acceptance check:
  Shared UI regressions are detectable by screenshot and metric diff before deploy.

### 17. `premium-1`

- Pass: `Surface verification`
- Priority: `High`
- Status: `Not started`
- Owner: `frontend/shared-ui`
- File scope:
  - `src/styles.css`
  - legacy admin/member route controls still normalized by compatibility selectors
- Problem:
  The app still depends on compatibility CSS to make older controls look consistent.
- Fix:
  Replace compatibility rescue styling with actual shared component adoption.
- Acceptance check:
  Old route-specific controls are migrated onto shared buttons/cards/chips/inputs; compatibility selectors can be reduced safely.

### 18. `premium-2`

- Pass: `Surface verification`
- Priority: `High`
- Status: `Not started`
- Owner: `admin-ui`
- File scope:
  - `src/components/admin-shared/index.tsx`
  - admin overview/reports/messages/payments/members/rooms
- Problem:
  Admin premium quality is uneven because data surfaces are still page-specific.
- Fix:
  Build one shared admin data-surface set: filter bar, row card, metric block, status rail, empty state, action cluster.
- Acceptance check:
  Admin operational pages feel like one product instead of a mix of redesigned and legacy screens.

### 19. `premium-3`

- Pass: `Surface verification`
- Priority: `Medium`
- Status: `Not started`
- Owner: `member-ui`
- File scope:
  - member notices and status surfaces
  - booking confirmation
  - package request success/failure
  - receipts
  - empty states
- Problem:
  Member success, warning, error, and pending states are improved but not yet fully unified.
- Fix:
  Create one consistent notice/pending/success language and visual pattern for member flows.
- Acceptance check:
  Booking, package, payment, and receipt states feel calm and consistent across all member routes.

### 20. `premium-4`

- Pass: `Surface verification`
- Priority: `Medium`
- Status: `Not started`
- Owner: `frontend/shared-ui`
- File scope:
  - loading and skeleton usage across member/admin pages
- Problem:
  Some routes have good skeletons, but others still fall back to generic blocks or plain text loading.
- Fix:
  Normalize loading states by route type: dashboard, list, detail, sheet, receipt, table, form.
- Acceptance check:
  No major route falls back to visually weak loading behavior compared with the rest of the app.

### 21. `premium-5`

- Pass: `Surface verification`
- Priority: `Low`
- Status: `Not started`
- Owner: `design-system`
- File scope:
  - shared button/card/sheet transitions
  - route transitions where already supported
- Problem:
  Motion is present in places, but not yet consistent enough to feel intentionally premium across the app.
- Fix:
  Standardize hover, press, focus, panel, and sheet transitions using one motion curve family and timing scale.
- Acceptance check:
  Interactive surfaces feel consistent and refined without becoming decorative or distracting.

---

## File-First Working Sets

Use this section when assigning work by file instead of by audit category.

### Shared primitives

- `src/components/ui/table.tsx` → `rtl-1`
- `src/components/ui/dialog.tsx` → `rtl-1`, `resp-3`
- `src/components/ui/drawer.tsx` → `rtl-1`, `resp-3`
- `src/components/ui/sheet.tsx` → `rtl-1`, `resp-3`
- `src/components/ui/sidebar.tsx` → `rtl-1`
- `src/components/ui/button.tsx` → `color-3`, `type-4`
- `src/components/ui/badge.tsx` → `color-3`, `type-4`

### Shared styling

- `src/styles.css` → `color-1`, `color-2`, `color-3`, `type-1`, `type-2`, `type-3`, `type-4`, `premium-1`, `premium-4`, `premium-5`
- `src/routes/__root.tsx` → `rtl-3`, `type-1`
- `src/lib/i18n.ts` → `rtl-3`, `rtl-4`, `type-3`

### Admin route cluster

- `src/routes/_authenticated/admin/calendar.tsx` → `rtl-2`, `resp-2`
- `src/routes/_authenticated/admin/messages.tsx` → `rtl-2`, `resp-2`, `premium-2`
- `src/routes/_authenticated/admin/reports.tsx` → `rtl-2`, `resp-2`, `premium-2`
- `src/routes/_authenticated/admin/index.tsx` → `rtl-2`, `color-4`, `premium-2`
- `src/routes/_authenticated/admin/settings.tsx` → `color-2`, `color-4`
- `src/routes/_authenticated/admin/rooms.tsx` → `rtl-2`, `premium-2`
- `src/routes/_authenticated/admin/payments.tsx` → `rtl-2`, `resp-2`, `premium-2`
- `src/routes/_authenticated/admin/members/$id.tsx` → `rtl-2`, `premium-2`

### Member route cluster

- `src/routes/_authenticated/member/index.tsx` → `resp-1`, `premium-3`, `premium-4`
- `src/routes/_authenticated/member/schedule.tsx` → `resp-1`
- `src/routes/_authenticated/member/bookings.tsx` → `resp-1`, `premium-3`
- `src/routes/_authenticated/member/packages.tsx` → `color-2`, `type-2`, `resp-1`, `premium-3`
- `src/routes/_authenticated/member/account.tsx` → `resp-1`
- `src/routes/_authenticated/receipts/$id.tsx` → `color-2`, `type-2`, `resp-1`, `premium-3`
- `src/components/member/ClassDetailSheet.tsx` → `rtl-4`, `color-2`, `premium-3`
- `src/components/visual/VisualClassCard.tsx` → `rtl-4`, `type-2`

### QA / tooling

- screenshot and browser matrix tooling under `tmp/` and existing QA scripts → `resp-4`

---

## Recommended Start Batch

Start here, in this exact order:

1. `rtl-1`
2. `rtl-2`
3. `color-2`

After that, do:

4. `color-1`
5. `type-2`
6. `type-3`

Do not start `resp-1` until the shared foundation work is merged locally and visually checked.
