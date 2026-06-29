# App Shell RTL Drawer Premium Fix Report

## Files changed

- `src/components/app-shell/AppShell.tsx`
- `src/styles.css`

## RTL drawer side fix

- The shared mobile drawer in `AppShell` now derives its side from the active language direction.
- RTL languages (`he`, `ar`) use a right-attached drawer panel.
- LTR (`en`) uses a left-attached drawer panel.
- The mobile drawer container now uses explicit side styles instead of relying only on conditional utility classes.
- The drawer panel itself now receives `dir="rtl"` or `dir="ltr"` so layout, focus order, and text alignment follow language direction.

## Logo usage changes

- The drawer keeps the wordmark-only brand treatment.
- The tagline is not used in the drawer.
- The mobile drawer uses a compact wordmark width to avoid clipping near the notch / status area.
- The branded header area is centered and given safe-area top padding.

## Language selector duplication fix

- The mobile drawer keeps a single language selector in the drawer footer.
- No additional language selector was added to the mobile top bar.
- The drawer footer keeps language and sign-out together as one integrated shell region.

## Drawer/sidebar style changes

- Added a dedicated mobile backdrop with navy tint and blur.
- Increased mobile drawer width to `min(92vw, 22rem)` for a more intentional mobile feel.
- Added body scroll locking while the mobile drawer is open.
- Added keyboard `Escape` close handling.
- Added dialog semantics on the mobile drawer container.
- Upgraded close button to a 44px-class touch target with safe-area-aware placement.
- Split the drawer into:
  - stable branded header
  - scrollable nav middle
  - stable footer
- Refined nav item sizing and active state:
  - consistent row height
  - premium navy active surface
  - gold icon treatment for active state
  - `aria-current="page"` on active links
- Footer was integrated into the drawer surface instead of feeling like a detached floating block.

## Responsive QA

### Verified in code/shared shell

- RTL side-selection logic for Hebrew and Arabic
- LTR side-selection logic for English
- safe-area-aware header spacing
- safe-area-aware footer spacing
- scroll locking while drawer is open
- active-link accessibility state
- reduced-motion-safe drawer animation fallback

### Command verification

| Command                                                       | Result |
| ------------------------------------------------------------- | ------ |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                 | PASS   |
| `/Users/ameeramer/.bun/bin/bun run build`                     | PASS   |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs` | PASS   |

### Manual/browser QA status

- Shared shell logic is implemented for mobile, tablet, and desktop behavior.
- A fresh visual device pass is still recommended on:
  - iPhone 390 × 844
  - iPhone 430 × 932
  - iPad 820 × 1180
  - desktop 1440 × 900

## Remaining issues

- The remaining risk is client-side stale cache in Simulator / WebView after deployment. If the old drawer side still appears, that is likely cached client assets rather than current server code.
- A live visual pass should confirm:
  - Hebrew drawer opens from the right
  - Arabic drawer opens from the right
  - English drawer opens from the left
  - no duplicate language selector is visible
  - no notch/header clipping on iPhone
