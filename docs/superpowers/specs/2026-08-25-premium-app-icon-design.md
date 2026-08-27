# Cloud & Core Logo-Derived App Icon Design

**Status:** Approved for production integration
**Date:** 2026-08-25
**Branch:** `codex/premium-app-icon`
**Approved source:** `docs/superpowers/assets/premium-app-icon/logo-emblem-preview.png`

## Objective

Replace the current generic cloud-outline iOS icon with the user-approved Cloud & Core logo-derived artwork. The release icon is the approved 1024 px preview itself: production integration copies that PNG byte-for-byte and does not redraw, trace, regenerate, recolor, or reinterpret it.

## Approved Direction

The icon uses the complete multi-cloud/aerial-loop emblem from the Cloud & Core source logo, paired with one restrained champagne-gold underline. The logo-derived silhouette, warm ivory field, deep navy emblem, and gold accent form one calm, premium lockup that remains recognizable at iOS Home Screen and notification sizes.

Earlier abstract studies were rejected and are not release artifacts. They must not be restored to the repository or used as implementation input.

## Canvas and File Contract

- One `1024x1024` PNG.
- Opaque, 8-bit RGB with no alpha channel.
- Full-bleed warm ivory background: `#FAF7F2`.
- No border and no pre-rounded corners; Apple applies the rounded platform mask.
- High-quality antialiased edges are required. Exact brand-color interior endpoints are preserved; blended boundary pixels are allowed for antialiasing.

## Emblem Construction

- Use the complete source multi-cloud/aerial-loop emblem in deep navy `#0B1D3A`.
- Preserve the source-like approximately `2.24:1` width-to-height proportion.
- Include every source feature, especially the tiny terminal lobe at the far right.
- Size the emblem to about 70% of the canvas width.
- Optically center the combined emblem-and-underline lockup and raise it slightly within the square.
- Preserve the approved preview's exact geometry, scale, placement, and edge treatment during integration.

## Gold Underline

- Use exactly one separate short underline in champagne gold `#D4AF6A`.
- Center the underline beneath the emblem.
- Keep it around 20% of the canvas width, with restrained weight and a comfortable gap from the emblem.
- Do not join the underline to the emblem or add any other gold marks.

## Exclusions

The icon contains no text, tagline, letters, extra dots or dividers, unrelated symbols, gradients, shadows, glow, textures, bevels, transparency, border, or decorative effects. It does not include a manually drawn rounded mask.

## Immutable Production Source

`docs/superpowers/assets/premium-app-icon/logo-emblem-preview.png` is the approved visual and the byte-for-byte production source for this release. Its approved SHA-256 is `7e800e9ae6f011326ab981de9efbf19d9579e0a7a446d1152913e0fcb4b54c54`.

Integration must copy that file directly to `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`. No vector master is being created for this release, and no raster transformation is permitted for the 1024 px production asset.

## Visual QA

Review temporary native-size previews at `29x29`, `40x40`, `60x60`, and `120x120` pixels.

- The full navy emblem must remain recognizable at every review size.
- The tiny far-right terminal lobe must remain present in the source artwork, even if it becomes visually compact at small sizes.
- The gold underline may become subtle at 29 px and 40 px, but it must not visually merge with the emblem.
- The ivory field, navy emblem, and gold underline must continue to read as one balanced lockup.
- Temporary QA previews are inspection artifacts and must not be committed.

## Acceptance Criteria

The release is accepted when:

- The iOS asset catalog retains exactly one universal iOS `1024x1024` entry named `AppIcon-512@2x.png`.
- The approved source and production icon both have the PNG signature, `1024x1024` dimensions, bit depth 8, and PNG color type 2 (RGB without alpha).
- The production icon is byte-for-byte identical to the approved source and both files have the approved SHA-256.
- The 29/40/60/120 px visual review passes with the navy emblem recognizable at every size.
- The repository contains no rejected concept-board artifact.
- Tests, lint, web build, and safe unsigned iOS validation pass.

## Release Boundary

The documentation phase explicitly deletes the rejected board at `docs/superpowers/assets/premium-app-icon/core-halo-concepts.png`, and that file must remain absent from the final tree. Production integration then updates only the focused asset-contract test and the iOS AppIcon PNG; it does not alter the approved preview.

This work does not deploy, merge, migrate, modify the Yoga branch, change an iOS version or build number, sign or archive a distribution build, upload to App Store Connect, or submit for App Store review.

Publishing the icon requires a separately authorized new iOS build, upload, and App Store review after integration is complete.
