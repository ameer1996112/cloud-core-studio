# Cloud & Core App Shell Branding & Navigation Polish Report

## Scope

This pass changed only the shared app shell surface:

- top bar
- desktop sidebar
- mobile drawer
- shell-level logo usage
- shell-level language selector placement

No auth logic, booking, payments, receipts, roles, Supabase, schema, or migrations were changed.

## Files changed

- `src/components/app-shell/AppShell.tsx`

## Logo usage rules implemented

### Auth

- Auth page continues using the full logo:
  - `/brand/cloud-core-logo-full.png`

### Mobile top bar

- Replaced full logo usage with compact wordmark or mark-only usage.
- No tagline is rendered in the app top bar.
- Brand asset used:
  - `/brand/cloud-core-wordmark.svg`
  - `/brand/cloud-core-mark.svg`

### Desktop sidebar / mobile drawer

- Replaced oversized/full-logo navigation branding with a compact lockup:
  - cloud mark + wordmark
  - no tagline
- Brand assets used:
  - `/brand/cloud-core-mark.svg`
  - `/brand/cloud-core-wordmark.svg`

## Where each logo asset is used

| Asset                             | Usage                                                        |
| --------------------------------- | ------------------------------------------------------------ |
| `/brand/cloud-core-logo-full.png` | auth page, member pre-hydration loading card                 |
| `/brand/cloud-core-wordmark.svg`  | mobile top bar, member desktop header, sidebar/drawer lockup |
| `/brand/cloud-core-mark.svg`      | mobile member leading mark, sidebar/drawer lockup            |

## Navigation and shell fixes

### Top bar

- Mobile top bar was rebuilt as a compact premium header.
- Added:
  - safe-area-aware padding
  - ivory translucent surface
  - subtle gold border
  - softer shadow/backdrop blur
  - premium icon-button treatment for hamburger and sign-out
- Removed oversized full-logo behavior from the app header.

### Sidebar / mobile drawer

- Drawer/sidebar surface now uses an ivory premium gradient instead of a flatter washed-out panel.
- Active nav state now uses:
  - elevated ivory/white pill
  - navy text/icon
  - subtle gold accent bar
- Inactive items now use calmer slate styling.
- Close button and sign-out button now match the shared shell style better.

### Language selector duplication fix

- Admin/instructor shell language control is now kept in the sidebar/drawer footer.
- Member shell language control was removed from the shared header to avoid duplication with member account/profile UI.
- Auth keeps its own language switcher.

## Responsive / RTL-LTR behavior

Implemented in shell:

- mobile drawer still opens from the RTL/LTR-correct side
- mobile top bar remains balanced in RTL and LTR
- brand treatment stays compact on small screens
- bottom nav behavior for member routes was left intact

## Commands run

| Command                                                       | Result | Notes                                      |
| ------------------------------------------------------------- | ------ | ------------------------------------------ |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                 | PASS   | no type errors                             |
| `/Users/ameeramer/.bun/bin/bun run build`                     | PASS   | production client + server build completed |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs` | PASS   | `i18n defaults and catalogs OK`            |

## Verification result

### Confirmed

- Shell/logo usage is now constrained in code to the intended contexts.
- Full logo is no longer used in app navigation.
- Navigation tagline is no longer rendered in top bar/sidebar/drawer.
- Shell-level member language selector duplication was removed.
- Admin/instructor language selector placement is consistent in the drawer/sidebar footer.
- Build, typecheck, and i18n checks pass.

### Browser QA status

Attempted local browser QA against the local production server on `http://127.0.0.1:4174`.

Verification blocker:

- the in-app browser session used for final QA timed out when navigating to localhost from the connected browser runtime
- because of that, I am not marking the full responsive browser matrix as completed from automation in this pass

### Partial QA observations

- asset references in code are correct and limited to the intended brand variants
- no additional shell-level language selector remained in the shared member header

## Remaining issues

- Full route/device browser verification is still needed for:
  - `/admin`
  - `/admin/calendar`
  - `/admin/settings`
  - `/member`
  - `/member/schedule`
  - `/auth`
- This is a verification gap, not a known compile/runtime regression from the code change itself.

## Verdict

- Shell branding/nav polish implemented: YES
- Typecheck/build/i18n pass: YES
- Full browser QA completed in this pass: NO
