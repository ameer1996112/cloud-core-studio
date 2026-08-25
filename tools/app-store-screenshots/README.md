# Cloud & Core App Store screenshot tooling

This directory captures the running Cloud & Core application and composes the English and Arabic App Store assets from the approved Hebrew masters. It never edits interface pixels, deploys the app, changes production data, or connects to App Store Connect.

## Project audit

- Application: TanStack Start + React + Vite web/PWA, packaged for iOS and Android with Capacitor. It is not React Native, Flutter, or a native Swift application.
- Local launch: `bun run dev --host 127.0.0.1 --port 5173`.
- Locale: `src/lib/i18n.ts` owns `he`, `en`, and `ar`; `applyLang` persists `cc_lang` and updates the document `lang` and `dir`. English is LTR; Hebrew and Arabic are RTL.
- Browser automation: Playwright captures the installed Google Chrome `151.0.7922.174` in headless mode without browser chrome. Capture aborts if the browser version differs.
- Simulator automation: Capacitor iOS sources and Xcode simulators exist, but the repository has no XCUITest or simctl screenshot suite. Because this is a responsive web application, Playwright is the deterministic capture source.
- Capture source: repository revision `85b833a58a01311d12481b47bc21a96cb7fcc946`. This is the real Cloud & Core revision whose member shell, wordmark header, cards, and navigation match the approved Hebrew devices. `capture.ts` exports this revision into a disposable directory and installs its locked dependencies; it never checks out or edits the working tree.
- Demo account: `app-store-demo@cloud-core.local` in the local Supabase stack only. It intentionally has no member-detail row, so the application renders its real localized generic-name/profile empty state. It has zero credits and attendance and no account-owned bookings, waitlist entries, member plans, or package requests. Existing local global package offerings are left untouched and are rendered by the real application. No classes, bookings, packages, credits, names, or profile details are fabricated.
- Global fixture guard: capture hashes the complete active package catalog, all future scheduled classes, and the studio-settings row and requires SHA-256 `a0ba3447869dfbe8ee2529e5adfa046a55e3ed48c3766f1592e28b8d5200b5ab`. This prevents a silent local-data change from producing a different set.
- Fonts: Assistant for English and Noto Sans Arabic for Arabic, installed through Fontsource and embedded into the SVG text layers.
- Logo: `app-store-assets/branding/cloud-and-core-logo.png`; validation pins its SHA-256 hash, compares normalized logo silhouettes in every master and output directly to the official asset, and requires the output logo pixels to remain identical to each approved master outside the permitted masks.

## Source of truth and composition

The five matched iPhone masters are exactly 1242×2688 and the five matched iPad masters are exactly 2048×2732. They live under `app-store-assets/references/hebrew-approved/` and `app-store-assets/references/hebrew-approved/ipad-13/`.

`layout.json` stores absolute, per-screen measurements from those masters. The references are never scaled. Each output begins with the exact corresponding Hebrew raster and replaces only:

- the measured headline/subtitle rectangle;
- the measured device display rectangle, using a real localized capture.

The device frame, official logo, cream background outside the text rectangle, navy/gold decoration, shadows, circles, phone/tablet position, scale, and bottom detail remain source pixels. Within the permitted marketing-text rectangle, Hebrew glyph pixels are cleared only by selecting unchanged cream pixels from the five approved masters at the same coordinates; no interpolation, generative fill, inpainting, or reconstructed imagery is used. Marketing text uses shaped SVG text; Arabic is rendered with native RTL shaping, never by reversing characters.

## Deterministic capture

- Backend and app URLs must be loopback addresses; `capture.ts` refuses non-local URLs.
- Clock: `2026-08-25T14:30:00+03:00`, supplied as `APP_STORE_FIXED_TIME` in the gitignored `.env.app-store.local` and verified in the capture provenance report.
- Timezone: `Asia/Jerusalem` by default.
- Viewports: iPhone 390×844 CSS at 3× (1170×2532 capture); iPad 1024×1366 CSS at 2× (2048×2732 capture).
- The visible language control on the sign-in screen selects each locale. The script then verifies the rendered `lang` and `dir` values.
- Every language and device uses the same account and locally seeded account-owned state.
- Fonts, images, network activity, two animation frames, and stable layout dimensions are awaited. Animations, transitions, carets, service workers, and scrollbars are disabled for capture. The iPhone browser viewport receives the app's native-style top and bottom safe-area treatment before stabilization: the wordmark clears the approved Dynamic Island, and the bottom navigation stays anchored above an opaque 12px protected strip so underlying page content cannot enter the safe area.
- All captures are real viewport PNGs from the running application.
- The iPad routes are captured separately at the responsive iPad viewport. Phone captures are never enlarged or reused for iPad.
- `app-store-assets/captures/capture-report.json` records the pinned source revision, account/state, fixed time, timezone, global fixture hash, verified browser version, and SHA-256 of all 30 Hebrew/English/Arabic device captures. Validation rejects incomplete or changed provenance.

The stable local package catalog is visible in the localized Packages screens. The approved Hebrew Packages master shows a loading/placeholder block in that area; reproducing a transient loading frame would violate the required network/layout stabilization, so the deterministic localized capture shows the real loaded catalog instead. This difference is entirely inside the permitted real-app screenshot mask and is reported rather than hidden.

## Regeneration

Prerequisites: Bun, Docker/Colima, Supabase CLI, Google Chrome, and the gitignored local capture environment file.

```sh
CI=1 DO_NOT_TRACK=1 SUPABASE_TELEMETRY_DISABLED=true supabase start --exclude vector
bun run appstore:capture
bun run appstore:generate
bun run appstore:validate
```

The full validation command checks all 20 production PNGs, writes reports and pixel-difference images, creates both contact sheets, and creates `app-store-assets/output/cloud-core-app-store-localized-assets.zip` only when every check passes.

## Files

- `capture.ts`: pinned real-app source export, local-only fixture reset, app launch, visible locale selection, and real responsive captures.
- `generate.ts`: deterministic composition with Sharp, exact approved-master background pixels, and shaped SVG text layers.
- `layout.json`: exact per-device and per-screen master measurements.
- `copy.json`: exact supplied English and Arabic copy.
- `validate.ts`: capture provenance, exact filenames, dimensions, RGB/alpha, sharpness, deterministic composite hashes, official-logo hash and output comparison, copy/direction, responsive iPad independence, pixel masks, contact sheets, stale-ZIP removal, and archive-content checks.
- `app-store-assets/output/validation/diffs/`: one pixel-difference PNG for every localized production design.

The validation reports are `dimension-report.json` and `pixel-diff-report.json`. A passing report permits differences only inside the marketing-copy and real-app-capture masks; outside-mask changed pixels must remain at or below 1%.
