# Cloud & Core Logo / Icon Replacement Report

## Summary

Replaced the runtime Cloud & Core brand surfaces with the new premium logo asset set and refreshed the web, PWA, iOS, and Android icon outputs.

No auth, booking, payments, receipts, roles, Supabase logic, schema, or migrations were changed.

## Files changed

Runtime/logo wiring:

- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/src/components/app-shell/AppShell.tsx`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/src/routes/auth.tsx`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/src/routes/__root.tsx`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/src/styles.css`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/manifest.json`

Brand/icon assets:

- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/brand/cloud-core-logo-full.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/brand/cloud-core-logo-full.webp`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/brand/cloud-core-wordmark.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/brand/cloud-core-mark.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/brand/cloud-core-mark.svg`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/brand/cloud-core-app-icon.svg`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/icons/icon-192.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/icons/icon-512.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/icons/maskable-icon-192.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/icons/maskable-icon-512.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/apple-touch-icon.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/favicon-32x32.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/favicon-16x16.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/favicon.ico`

Native assets updated:

- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/android/app/src/main/res/mipmap-*/ic_launcher*.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/android/app/src/main/res/drawable*/splash.png`

## New logo assets added

Full lockup:

- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/brand/cloud-core-logo-full.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/brand/cloud-core-logo-full.webp`

Compact assets:

- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/brand/cloud-core-mark.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/brand/cloud-core-wordmark.png`

Web/PWA/app icons:

- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/icons/icon-192.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/icons/icon-512.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/icons/maskable-icon-192.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/icons/maskable-icon-512.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/apple-touch-icon.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/favicon-32x32.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/favicon-16x16.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/favicon.ico`

## Old logo assets replaced

| Old asset / reference             | Where used before                                       | Status                                                                     |
| --------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| `/brand/cloud-core-logo-full.svg` | auth page, member loading, member header, admin sidebar | runtime references replaced with `/brand/cloud-core-logo-full.png`         |
| `/brand/cloud-core-mark.svg`      | mobile shell header, admin sidebar                      | runtime references removed; retained as source for compact icon generation |
| `/brand/cloud-core-wordmark.svg`  | mobile shell header, admin sidebar                      | runtime references removed; retained but no longer active in the app shell |
| `/favicon.svg`                    | root document icon link                                 | root document now references PNG + ICO favicons instead                    |

No old asset was deleted blindly. Old vector files were left in place unless their runtime reference was removed.

## Where each logo variant is used

| Variant                                                 | Usage                                                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `cloud-core-logo-full.png`                              | `/auth`, member loading state, member mobile header, member desktop header, admin sidebar |
| `cloud-core-logo-full.webp`                             | optimized full-lockup export retained in `public/brand/`                                  |
| `cloud-core-mark.png`                                   | compact brand asset export                                                                |
| `icon-192.png` / `icon-512.png`                         | PWA/app icon surfaces                                                                     |
| `maskable-icon-192.png` / `maskable-icon-512.png`       | maskable PWA icon surfaces                                                                |
| `apple-touch-icon.png`                                  | iOS web clip icon                                                                         |
| `favicon-16x16.png`, `favicon-32x32.png`, `favicon.ico` | browser favicon surfaces                                                                  |

## Favicon / manifest / app icon paths

- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/manifest.json`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/icons/icon-192.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/icons/icon-512.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/icons/maskable-icon-192.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/icons/maskable-icon-512.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/apple-touch-icon.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/favicon-16x16.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/favicon-32x32.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/public/favicon.ico`

Manifest colors:

- `theme_color: #0B1D3A`
- `background_color: #FAF7F2`

## Capacitor / native icon update

Capacitor is configured in this project, and native assets were refreshed.

- `npx cap sync` was run successfully.
- iOS asset catalog app icon was updated.
- iOS splash images were updated.
- Android launcher icons were updated.
- Android splash images were updated.

## QA evidence

Screenshots:

- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/tmp/logo-rebrand-qa/auth-he-mobile.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/tmp/logo-rebrand-qa/member-he-390.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/tmp/logo-rebrand-qa/member-en-1440.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/tmp/logo-rebrand-qa/admin-desktop.png`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/tmp/logo-rebrand-qa/admin-settings-desktop.png`

Structured QA results:

- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/tmp/logo-rebrand-qa/results.json`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/tmp/logo-rebrand-qa/admin-live-results.json`

## Browser QA results

Verified:

- `/auth` on mobile in Hebrew / Arabic / English
- `/member` on mobile Hebrew / Arabic
- `/member/schedule` on mobile Hebrew / Arabic
- `/member` on desktop English
- `/member/schedule` on desktop English
- `/admin` on desktop Hebrew
- `/admin/settings` on desktop Hebrew

Checks passed:

- auth logo is clear and no longer blurry
- member mobile header logo is clear
- member desktop header now shows a visible compact full logo
- admin sidebar logo is clear
- no broken brand/image requests in verified routes
- no horizontal overflow in verified routes
- 0 console errors in verified auth/member/admin route checks

Notes:

- The auth mobile logo now renders at approximately `220px` wide on `390px` width, which lands in the requested range.
- Compact app icon surfaces use a simplified cloud mark for readability; full lockup is used on larger brand surfaces.

## Commands run

| Command                                                       | Result | Notes                                                    |
| ------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                 | PASS   | ran after asset/component wiring                         |
| `/Users/ameeramer/.bun/bin/bun run build`                     | PASS   | verified final dist after logo updates                   |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs` | PASS   | localization bundle unchanged                            |
| `npx cap sync`                                                | PASS   | copied web bundle and refreshed Capacitor project assets |

## Remaining manual steps

- None required for the web/PWA surface.
- For a fresh native archive, rebuild from Xcode / Android Studio so the updated icon and splash assets are baked into the next binary.
