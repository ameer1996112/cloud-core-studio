# Cloud & Core Full Design Audit and P0/P1 Implementation Report

## Verdict

- P0 issues remaining: `0`
- P1 issues addressed in this pass: `shared token drift`, `shell/button/input inconsistency`, `member mobile polish`, `legacy palette leakage on primary surfaces`, `RTL-safe member surface cleanup`
- Remaining issues: `P2 only`
- Compile gates: `PASS`
- Live browser QA on current localhost member session: `PASS` on tested routes/devices/languages

---

## Audit

### A. Typography Consistency

**Passing**

- Shared typography tokens now exist in [src/styles/tokens.css](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/styles/tokens.css).
- Base body text is normalized to `15px` with `line-height: 1.6`.
- Inputs use a mobile-safe `16px` floor.
- Hebrew and Arabic heading tracking is normalized in [src/styles.css](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/styles.css).

**Issues Found**

- Serif/display styling was leaking too broadly through shared UI and page sections.
- Secondary labels and chips still rely on `text-xs` in some older admin/member surfaces.
- Legacy px literals still exist in older handcrafted CSS blocks, mostly in `styles.css`.

**Upgrade Suggestions**

- `P2`: continue replacing secondary `font-display` usage with body sans in dense data surfaces.
- `P2`: replace remaining px literals with token-based type utilities.

### B. Color Discipline

**Passing**

- The app now has a real token layer for the approved palette.
- Shared buttons, inputs, dialogs, sheets, cards, shells, and member surfaces route through tokenized navy/ivory/gold/sand/powder values.
- High-visibility legacy palette leakage was reduced in auth, member, admin calendar, reports, rooms, and image motif gradients.

**Issues Found**

- A few low-risk hardcoded color constants still exist in route-local data defaults and chart configuration.
- Standalone fallback/error-page styling is still generic and outside the main token system.

**Upgrade Suggestions**

- `P2`: move remaining chart/data color constants to a shared TS theme map.
- `P2`: brand-tokenize the standalone HTML error page template.

### C. Spacing & Layout

**Passing**

- Shared spacing tokens now exist.
- Primary shells and cards use consistent panel/card/input/button radii.
- Member mobile routes tested in the browser did not overflow at `390x844`.

**Issues Found**

- Some handcrafted sections still use route-local px spacing rather than the shared token scale.
- A few non-primary primitives still retain old spacing patterns.

**Upgrade Suggestions**

- `P2`: continue replacing route-local spacing with shared utilities in dense admin views.

### D. Component Consistency

**Passing**

- Shared `Button`, `Input`, `Select`, `Dialog`, `Sheet`, `AlertDialog`, and `Badge` were normalized.
- App shell, sidebar, language switcher, bottom nav, and member/admin cards now read as one system.
- Overlay/backdrop styling is consistent across dialog and sheet components.

**Issues Found**

- Some low-traffic primitives still keep older default geometry or motion classes.

**Upgrade Suggestions**

- `P2`: audit `popover`, `tooltip`, `command`, `sidebar`, and `carousel` primitives for full token/radius parity.

### E. RTL Correctness

**Passing**

- Main member routes tested live render correctly in RTL/LTR.
- Hebrew and Arabic schedule views no longer expose raw English technical metadata.
- Member route cards no longer force `text-left` on primary content.

**Issues Found**

- Some secondary primitives still contain physical left/right utility classes.
- A few admin/detail utilities still use physical positioning where logical properties would be cleaner.

**Upgrade Suggestions**

- `P2`: finish logical-property cleanup in lower-traffic shared primitives.

### F. Navigation & Sidebar

**Passing**

- The top bar/sidebar/app shell use a shared premium treatment.
- Active states are clearer and tokenized.
- Logo, divider, borders, and surface depth are now more consistent.

**Issues Found**

- None at P0/P1 level on the current shell pass.

**Upgrade Suggestions**

- `P2`: audit remaining route-level action bars against the shell system for full parity.

### G. Data & Loading States

**Passing**

- Main member/admin routes use branded skeletons and card loading states.
- Member home, schedule, bookings, packages, and account all loaded without console errors in the live browser pass.

**Issues Found**

- Some older empty states remain text-first rather than fully illustrated/editorial.

**Upgrade Suggestions**

- `P2`: align remaining text-only empty states with the stronger member/admin empty-state system.

### H. Micro-interactions & Polish

**Passing**

- Shared hover/focus/active states were normalized in buttons and overlays.
- Focus rings are visible and brand-aligned.
- Dialog/sheet overlays and motion are calmer and more consistent.

**Issues Found**

- Browser tab title localization after runtime language switching still appears constrained by route-head precedence on some routes during live QA.

**Upgrade Suggestions**

- `P2`: either move page-title localization fully client-side or centralize dynamic head handling.

---

## Priority Matrix

| Issue                                                                                                          | Severity | Effort | Fix                                                                                              |
| -------------------------------------------------------------------------------------------------------------- | -------- | ------ | ------------------------------------------------------------------------------------------------ |
| Legacy hardcoded palette leaking through shared CSS and primary routes                                         | P1       | M      | Fixed in `src/styles.css`, `src/lib/image-assets.ts`, auth/member/admin route surfaces           |
| Shared buttons, inputs, selects, dialogs, sheets, badges, and shells using inconsistent geometry/surface rules | P1       | M      | Fixed in shared UI primitives and app shell                                                      |
| Member mobile surfaces needed runtime QA for overflow, console noise, and localized schedule metadata          | P1       | M      | Fixed and verified live on localhost member routes                                               |
| Member schedule Arabic/English/Hebrew should not show raw `Aerial Yoga` or technical metadata                  | P1       | S      | Verified clean on live member schedule after shared/member localization pass                     |
| Secondary primitives still carry physical left/right classes                                                   | P2       | M      | Follow-up cleanup in low-traffic primitives                                                      |
| Some secondary labels remain too small/dense                                                                   | P2       | S      | Continue replacing legacy `text-xs` usage on secondary admin/member surfaces                     |
| Browser tab titles do not fully follow runtime language switching on every route                               | P2       | M      | Partial mitigation added; still not fully verified because route head precedence wins in live QA |
| Standalone fallback error page is outside the main brand token system                                          | P2       | S      | Brand-tokenize `src/lib/error-page.ts` later                                                     |

---

## P0/P1 Implementation

### 1. Global token system

Created [src/styles/tokens.css](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/styles/tokens.css) and routed shared colors, spacing, typography, radii, shadows, and transitions through it.

### 2. Root typography and base system

Updated [src/styles.css](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/styles.css) to:

- import the new token file
- normalize body type and line-height
- use Playfair only for brand/display contexts
- standardize focus rings
- raise the mobile microcopy floor
- replace large chunks of old palette hardcodes with token-derived values

### 3. Shell and navigation

Updated [src/components/app-shell/AppShell.tsx](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/components/app-shell/AppShell.tsx) for:

- consistent premium top bar/sidebar treatment
- softer overlays
- tokenized nav active states
- consistent bottom-nav/button surface language

### 4. Shared primitives

Updated:

- [src/components/ui/button.tsx](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/components/ui/button.tsx)
- [src/components/ui/input.tsx](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/components/ui/input.tsx)
- [src/components/ui/select.tsx](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/components/ui/select.tsx)
- [src/components/ui/dialog.tsx](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/components/ui/dialog.tsx)
- [src/components/ui/sheet.tsx](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/components/ui/sheet.tsx)
- [src/components/ui/alert-dialog.tsx](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/components/ui/alert-dialog.tsx)
- [src/components/ui/badge.tsx](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/components/ui/badge.tsx)

Why:

- remove one-off button/input/modal styling
- normalize radii and shadows
- align focus/hover/disabled behavior

### 5. High-visibility member/admin surfaces

Updated:

- [src/routes/auth.tsx](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/routes/auth.tsx)
- [src/routes/\_authenticated/member/index.tsx](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/routes/_authenticated/member/index.tsx)
- [src/routes/\_authenticated/member/schedule.tsx](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/routes/_authenticated/member/schedule.tsx)
- [src/routes/\_authenticated/member/bookings.tsx](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/routes/_authenticated/member/bookings.tsx)
- [src/routes/\_authenticated/member/packages.tsx](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/routes/_authenticated/member/packages.tsx)
- [src/routes/\_authenticated/member/account.tsx](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/routes/_authenticated/member/account.tsx)
- [src/routes/\_authenticated/admin/index.tsx](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/routes/_authenticated/admin/index.tsx)
- [src/routes/\_authenticated/admin/calendar.tsx](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/routes/_authenticated/admin/calendar.tsx)
- [src/routes/\_authenticated/admin/programs.tsx](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/routes/_authenticated/admin/programs.tsx)
- [src/routes/\_authenticated/admin/reports.tsx](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/routes/_authenticated/admin/reports.tsx)
- [src/routes/\_authenticated/admin/rooms.tsx](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/routes/_authenticated/admin/rooms.tsx)

Why:

- replace leftover legacy palette drift
- normalize card/skeleton treatment
- fix remaining RTL-sensitive alignment on member surfaces
- move visual defaults toward the new palette

### 6. Brand/visual helpers

Updated:

- [src/lib/image-assets.ts](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/lib/image-assets.ts)
- [src/components/visual/CloudCardVisual.tsx](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/components/visual/CloudCardVisual.tsx)
- [src/components/member/PremiumClassCard.tsx](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/components/member/PremiumClassCard.tsx)
- [src/routes/\_\_root.tsx](/Users/ameeramer/Documents/Cloud&%20Core/cloud-core-lovable-site/src/routes/__root.tsx)

Why:

- keep the mood/image layer inside the same palette
- align browser theme/font loading with the new system

---

## Commands Run

| Command                                                       | Result |
| ------------------------------------------------------------- | ------ |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                 | PASS   |
| `/Users/ameeramer/.bun/bin/bun run build`                     | PASS   |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs` | PASS   |

---

## Live Browser QA

Environment:

- local app at `http://127.0.0.1:4174`
- authenticated existing member session
- in-app browser

### Mobile 390 × 844

| Route              | Language | Overflow | Console errors | Result |
| ------------------ | -------- | -------: | -------------: | ------ |
| `/member`          | Hebrew   |       No |              0 | PASS   |
| `/member/schedule` | Hebrew   |       No |              0 | PASS   |
| `/member/bookings` | Hebrew   |       No |              0 | PASS   |
| `/member/packages` | Hebrew   |       No |              0 | PASS   |
| `/member/account`  | Hebrew   |       No |              0 | PASS   |
| `/member/schedule` | Arabic   |       No |              0 | PASS   |
| `/member/schedule` | English  |       No |              0 | PASS   |

Specific checks:

- Hebrew schedule did **not** show raw `Aerial Yoga`
- Hebrew/Arabic schedule did **not** show raw technical metadata like `Aerial / Yoga · Beginner to Intermediate · Flow / signature`
- bottom nav remained visible without covering tested content on the checked routes

### Tablet / Desktop

| Route              | Viewport     | Language | Overflow | Console errors | Result |
| ------------------ | ------------ | -------- | -------: | -------------: | ------ |
| `/member/schedule` | `820 × 1180` | Hebrew   |       No |              0 | PASS   |
| `/member/schedule` | `1440 × 900` | Hebrew   |       No |              0 | PASS   |

### Visual evidence

- Live in-app browser screenshot captured for `/member/schedule` at `390 × 844` during this pass
- DOM/browser checks confirmed correct `lang` / `dir` values and no mobile overflow on tested routes

---

## Remaining P2 Follow-up

1. Route-head title localization still does not fully follow runtime language switching in every live navigation case.
2. Some lower-traffic shared primitives still contain physical left/right utility classes.
3. Some secondary admin/member labels remain denser than the primary design system target.
4. Standalone error-page styling is still outside the main token layer.

---

## Files Changed In This Pass

- `src/styles/tokens.css`
- `src/styles.css`
- `src/routes/__root.tsx`
- `src/lib/image-assets.ts`
- `src/lib/document-title.ts`
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/alert-dialog.tsx`
- `src/components/ui/badge.tsx`
- `src/components/admin-shared/index.tsx`
- `src/components/app-shell/AppShell.tsx`
- `src/components/member/PremiumClassCard.tsx`
- `src/components/visual/CloudCardVisual.tsx`
- `src/routes/auth.tsx`
- `src/routes/_authenticated/admin/index.tsx`
- `src/routes/_authenticated/admin/calendar.tsx`
- `src/routes/_authenticated/admin/programs.tsx`
- `src/routes/_authenticated/admin/reports.tsx`
- `src/routes/_authenticated/admin/rooms.tsx`
- `src/routes/_authenticated/member/index.tsx`
- `src/routes/_authenticated/member/schedule.tsx`
- `src/routes/_authenticated/member/bookings.tsx`
- `src/routes/_authenticated/member/packages.tsx`
- `src/routes/_authenticated/member/account.tsx`
- `src/lib/admin.functions.ts`
