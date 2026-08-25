# Cloud & Core Member Experience Redesign

**Date:** 2026-08-25  
**Status:** Ready for final review  
**Branch:** `codex/member-ui-redesign`

## Summary

Redesign the authenticated member experience as a premium boutique-studio utility. The work covers Home, Schedule, Bookings, Packages, Profile, and the shared member navigation in Hebrew, Arabic, and English across mobile and desktop.

The redesign keeps the established Cloud & Core identity—navy, ivory, restrained gold, the existing logo, studio photography, and Assistant typography—but removes unnecessary cards, decorative framing, repeated headings, and low-value mood copy. Each route should make its primary member task clear within the first viewport.

## Goals

1. Make the main action on every member screen immediately visible.
2. Give content a clear hierarchy without wrapping every section in a card.
3. Make mobile layouts feel native and desktop layouts feel deliberately composed.
4. Improve route transitions, loading feedback, empty-state accuracy, and perceived speed.
5. Fix known accessibility, RTL/LTR, clipping, contrast, and touch-target defects.
6. Create shared member primitives so the five routes remain visually coherent.

## Non-goals

- Redesigning the admin interface.
- Changing authentication, permissions, booking, payment, or membership business rules.
- Adding the Yoga-with-Lina promotion or merging its branch.
- Changing SEO marketing routes or App Store metadata.
- Deploying, migrating, submitting an App Store build, or enabling a feature flag.
- Replacing the brand logo, application icon, or core brand palette.

## Design Direction: Boutique Editorial Utility

The member application should feel like a calm, high-end studio concierge rather than a dashboard assembled from generic cards.

### Keep

- Cloud & Core logo and recognizable brand identity.
- Navy `#0B1D3A`, ivory `#FAF7F2`, gold `#D4AF6A`, sand `#E8DFD1`, and slate `#6F7A8C`.
- Assistant as the interface typeface.
- High-quality studio photography where it provides context.
- Rounded corners where the container itself is interactive.

### Reduce

- Nested panels and stacked cards.
- Drop shadows and decorative borders.
- Repeated shell and page titles.
- Very small gold labels and low-contrast supporting copy.
- Mood copy that delays the task the member came to complete.

### Layout principles

- Every route has one dominant job and one visually dominant action.
- Use whitespace, typography, and dividers for structure before adding a container.
- Use cards primarily for actionable entities: classes, bookings, and packages.
- Put essential inventory or status before editorial explanation.
- Keep primary actions visible in the first mobile viewport whenever the data permits.

## Shared Member Shell

### Mobile

- Retain a sticky compact brand header and fixed bottom navigation.
- Use five stable destinations: Home, Schedule, Bookings, Packages, and Profile.
- Use concise localized labels so no destination is clipped at 320–390 px widths.
- Each navigation target must be at least 44 by 44 CSS pixels and expose its active state without relying on color alone.
- Reserve bottom safe-area space so content and primary actions are never hidden behind navigation.

### Desktop

- Retain a compact horizontal top navigation instead of introducing an admin-like side rail.
- Merge the shell title and page introduction into one hierarchy; do not show duplicate route titles.
- Use a centered content grid with route-specific max widths rather than stretching mobile cards across the viewport.
- Use split or two-column compositions where secondary context supports the primary task.

### Route transitions

- Navigation responds immediately with active-state feedback.
- Destination content uses a subtle 150–220 ms opacity/translation transition.
- If route data is not ready, render a route-shaped skeleton rather than the current full-screen branded loading card.
- Respect `prefers-reduced-motion` and remove non-essential transitions when requested.

## Screen Specifications

### Home (`/member`)

**Primary job:** Understand what is next and book another class.

- Use a compact personalized greeting, without a second duplicate page title.
- Show the next upcoming booking first when one exists.
- Show current package or membership balance as concise supporting status.
- Keep the primary “Find a class” action visible in the first mobile viewport.
- Offer “Buy a package” as a clear but secondary action.
- If no booking exists, replace the next-booking region with a purposeful schedule prompt rather than a negative empty card.
- Avoid stacked promotional cards and non-actionable mood sections.

### Schedule (`/member/schedule`)

**Primary job:** Find and book an appropriate class.

- Lead with the date range/day navigator and available class inventory.
- On mobile, place secondary filters in a bottom sheet opened by a 44 px filter control; show active-filter count on the trigger.
- On desktop, render compact inline filters adjacent to the date controls.
- Never expose internal values such as `all-levels`; all intensity, instructor, and class-type values must use localized display strings.
- Preserve selected filters while navigating dates within the route.
- Class cards prioritize time, class name, instructor, availability, and the booking action in that order.
- If a selected day has no classes, say that no classes are scheduled for that day. Only suggest clearing filters when active filters actually hide results.
- Avoid letting filter controls consume the entire first mobile viewport.

### Bookings (`/member/bookings`)

**Primary job:** Review and manage upcoming bookings.

- Prioritize upcoming bookings and surface the nearest booking first.
- Replace the clipped tab row with a responsive segmented control whose destinations remain fully reachable at 320 px.
- If all current categories cannot fit comfortably, use a single-row horizontally scrollable control with visible edge affordance, correct initial RTL position, keyboard scrolling, and focus-driven reveal so every off-screen option remains discoverable and reachable.
- Booking cards show date/time, class, instructor, and status without redundant framing.
- Destructive cancellation remains visually secondary until the booking is opened or expanded.
- Past and cancelled records use quieter styling without reducing legibility.

### Packages (`/member/packages`)

**Primary job:** Understand available options and purchase the right package.

- Place available packages and the first purchase action before explanatory/editorial content.
- Package cards show name, price, class allowance, validity, and purchase action in a scannable order.
- Distinguish recommended or best-fit packages with restrained typography/border treatment rather than a large promotional banner.
- Move terms and detailed explanations below the purchasable inventory.
- Keep an owned package or balance summary concise and clearly separate from packages for sale.

### Profile (`/member/account`)

**Primary job:** Review and update account preferences.

- Group identity, language, notifications, and account actions into clear sections separated by whitespace or dividers.
- Every field label must be programmatically associated with its input using `for`/`id` or an equivalent accessible relationship.
- Checkboxes, toggles, icon buttons, sign-out, and alert actions use at least 44 px interaction targets.
- Keep destructive account actions visually separate from routine settings.
- Show save/progress/success/error feedback next to the setting being changed.

## Shared Components

Prefer evolving or composing existing components over duplicating route-specific markup.

- `MemberPageIntro`: optional eyebrow, route title, concise supporting text, and a primary action slot.
- `MemberSection`: semantic section wrapper using spacing/dividers rather than a default card.
- `MemberActionBar`: responsive home for date controls, filters, or a primary route action.
- `MemberSegmentedControl`: keyboard-accessible responsive tabs with RTL-safe overflow behavior.
- `MemberRouteSkeleton`: skeleton variants shaped for each route's main content.
- Existing class, booking, and package cards should adopt the new hierarchy and tokens rather than being visually replaced by unrelated components.

The exact component names may change during implementation if the existing code provides a clearer seam, but public behavior and visual hierarchy must remain as specified.

## Responsive Behavior

- Design and verify at 320, 390, 768, 1024, and 1440 CSS pixels.
- No horizontal page overflow is permitted.
- Mobile content uses a compact single-column flow with first-viewport task priority.
- Tablet may use two-column grids only when card content remains readable.
- Desktop uses purposeful columns and restrained line lengths; it must not look like a mobile page enlarged to fill the screen.
- Logical CSS properties and direction-aware icons are required so Hebrew/Arabic RTL and English LTR share the same structure.

## Typography, Color, and Surfaces

- Minimum default body size: 16 px on form-heavy screens and 15 px for compact supporting text.
- Avoid essential labels below 12 px; navigation and action labels should generally be 13 px or larger.
- Gold is an accent, not the default color for small instructional text.
- Text and interactive states must meet WCAG 2.2 AA contrast.
- Use shadows sparingly; prefer a border, tone change, or spacing hierarchy.
- Preserve existing radii tokens where containers remain appropriate: button 14, input 12, card 18, panel 22, pill fully rounded.

## Accessibility and Input Behavior

- Minimum pointer target: 44 by 44 CSS pixels.
- All controls require visible keyboard focus and semantic accessible names.
- Tabs use correct tab semantics and keyboard behavior.
- Bottom sheets trap focus while open, close with Escape, restore focus to their trigger, and prevent background interaction.
- Status changes use an appropriate live region without producing repetitive announcements.
- Loading skeletons are hidden from assistive technology and paired with a concise loading status.
- Motion follows `prefers-reduced-motion`.
- Hebrew and Arabic render with `dir="rtl"`; English renders with `dir="ltr"`.

## Data, Loading, Empty, and Error States

- Existing route loaders and domain operations remain authoritative; this work does not change booking or package rules.
- Preserve usable existing content while background refreshes occur.
- Empty states must describe the actual condition: no scheduled inventory, no bookings, no packages, or filtered-out results.
- Error states state what failed and provide a relevant retry or recovery action.
- Do not replace a local route loading state with a full-screen application loader.

## Localization

- All new interface strings must be added to the shared i18n layer in Hebrew, Arabic, and English.
- No raw enum, slug, or backend value may appear in the interface.
- Copy should be concise enough for mobile navigation and actions while remaining natural in each language.
- RTL validation must include alignment, tab overflow, chevrons, date controls, sheets, and safe-area positioning.

## Verification and Public Test Seams

Implementation will use test-driven changes at observable seams rather than implementation details.

1. **Localization seam:** navigation, empty states, class intensity, and new actions resolve to human-readable Hebrew, Arabic, and English strings; raw values such as `all-levels` never render.
2. **Navigation seam:** all five member destinations are present, named, active-state identifiable, and keyboard reachable.
3. **Responsive interaction seam:** booking categories remain reachable at 320 px in both RTL and LTR; schedule filters open and close accessibly; primary actions remain in the expected first-viewport order.
4. **Accessibility seam:** profile labels associate with inputs, interactive controls expose accessible names, and relevant targets meet the 44 px requirement.
5. **State seam:** schedule empty copy differs between “no classes scheduled” and “filters hide results”; loading and error states preserve route context.
6. **Regression seam:** booking, cancellation, filtering, package purchase, profile update, authentication, and member-route authorization continue to call the existing domain operations.

Use focused unit/component tests where the existing harness supports the public interface, and browser QA for responsive layout, focus management, visual order, RTL/LTR, and route transitions.

## Acceptance Criteria

- Home, Schedule, Bookings, Packages, and Profile implement the approved hierarchy on mobile and desktop.
- Each screen's primary task is available without unnecessary scrolling, subject to actual content availability.
- No clipped member navigation, tabs, or controls at 320 px or above.
- No raw internal localization values appear.
- All relevant touch targets are at least 44 px.
- Profile field associations and filter-sheet focus behavior pass accessibility checks.
- Hebrew, Arabic, and English are verified in their correct directions.
- Route transitions display immediate navigation feedback and route-shaped loading states.
- Existing member business behavior remains unchanged.
- Focused tests, the full test suite, `bun run lint`, and `bun run build` pass.
- Mobile and desktop QA screenshots are captured for the redesigned routes before handoff.

## Delivery Boundaries

All implementation remains on `codex/member-ui-redesign` until review. No production deployment, migration, feature enablement, App Store submission, or Yoga branch integration is part of this delivery.
