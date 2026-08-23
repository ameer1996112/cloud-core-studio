# Task 3 Report: Approved App Marketing Assets

## RED/GREEN evidence

- RED: `bun test tests/unit/appMarketingAssets.test.mjs` failed before asset promotion because the 15 public PNG paths and three badge paths did not exist (`ENOENT`).
- GREEN: after promotion and official badge downloads, the same command passed: 2 tests, 0 failures, 21 expectations.

## File, dimension, and content checks

- Added 15 PNGs under `public/images/app-marketing/{he,ar,en}/` using the exact source-to-public mapping in the brief.
- `file public/images/app-marketing/*/*.png` reports every capture as PNG, `390 x 844`, 8-bit RGB, non-interlaced.
- Every capture is larger than 20,000 bytes (smallest: Hebrew membership at 82,043 bytes).
- `cmp` passed for all 15 source/public pairs; no pixels or bytes were edited.
- Added `public/brand/app-store-badges/{he,ar,en}.svg`.
- `file` identifies all three badges as SVG Scalable Vector Graphics; each is larger than 2,000 bytes (7,010–10,804 bytes), begins with SVG/XML artwork, and contains no HTML/error response.

## Official badge source evidence

Downloaded directly with `curl -fsSL` from the required Apple endpoints:

- `https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/he-il?size=250x83`
- `https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/ar-sa?size=250x83`
- `https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us?size=250x83`

No third-party artwork or pixel/vector edits were used.

## Files changed

- `tests/unit/appMarketingAssets.test.mjs`
- `public/images/app-marketing/he/{schedule,booking,bookings,membership,account}.png`
- `public/images/app-marketing/ar/{schedule,booking,bookings,membership,account}.png`
- `public/images/app-marketing/en/{schedule,booking,bookings,membership,account}.png`
- `public/brand/app-store-badges/{he,ar,en}.svg`
- This report

## Self-review

- Scope is limited to the requested asset contract, approved captures, official badges, and evidence report.
- No source captures were modified, optimized, reformatted, recolored, or recreated.
- The asset contract test checks the public paths and minimum content requirements.

## Concerns

- The official `ar-sa` response is byte-identical to the official `en-us` response (SHA-256 `a26fc5...`) and both contain Apple’s `Download_on_the_App_Store_Badge_US-UK_RGB_blk_4SVG_092917` title. This is reported for review; no substitute was used because the brief requires Apple endpoint artwork only.
