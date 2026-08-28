# Changelog

All notable changes to Cloud & Core Studio are documented in this file.

## [0.3.0.0] - 2026-08-28

### Added

- Add a reusable promotions manager for localized in-app, push, WhatsApp, and public-link campaigns with audience previews, test sends, scheduling, lifecycle controls, and funnel reporting.
- Add the disabled-by-default Yoga with Lina launch campaign, a public promotion page, member-home promotion cards, restricted promotional credits, and filtered schedule handoff.
- Add durable promotion attribution, engagement, delivery, entitlement, audit, and campaign-safety database contracts with focused unit and concurrency coverage.

### Changed

- Integrate promotion delivery with the existing notification automation while preserving member consent, channel availability, frequency limits, approved WhatsApp templates, and campaign leases.
- Surface promotion entitlements in member packages and apply eligible credits atomically during booking without changing the member's general credit balance.

### Fixed

- Prevent promotion retries from overwriting successful delivery history when a channel later becomes suppressed.
- Restrict activation-readiness details to administrators and the service role, and align the campaign credit-quantity API with the database constraint.
- Localize promotion-card accessibility labels and keep analytics failures from interrupting the member experience.

## [0.2.0.0] - 2026-08-27

### Added

- Introduce a premium, task-first member experience across Home, Schedule, Bookings, Packages, and Profile in English, Hebrew, and Arabic.
- Add shared accessible member-page, segmented-control, form-field, route-skeleton, filter-state, and profile-state presentation primitives.
- Add responsive mobile and desktop QA evidence plus focused regression coverage for member navigation, loading, filtering, announcements, packages, profile forms, accessibility, and the iOS app icon.
- Add Google Search Console ownership verification for the production site.

### Changed

- Replace the member drawer experience with compact desktop navigation and a five-destination mobile tab bar with RTL-safe layout, safe-area handling, 44 px controls, and route-aware loading feedback.
- Reorder member pages around their primary actions, use truthful loading and empty states, improve purchase and checkout focus behavior, and simplify repetitive or negative copy.
- Use real Cloud & Core studio photography as the member fallback instead of generic or AI-looking imagery.
- Update the premium Cloud & Core iOS icon and prepare iOS version 1.0.8 build 10 for TestFlight testing.

### Fixed

- Preload member route bundles so the first tap on Bookings and the other mobile tabs responds immediately instead of appearing stuck while a route chunk downloads.
- Keep only the latest rapid mobile navigation request, preserve modified-click behavior, and recover safely from interrupted route transitions.
- Allow the full studio announcement to wrap on mobile instead of clipping the message.
- Improve dialog, sheet, schedule, bookings, packages, and profile accessibility with associated labels, focus restoration, semantic states, and reduced-motion behavior.

## [0.1.0.0] - 2026-08-24

### Added

- Visit a public `/app` page in Hebrew, Arabic, or English to explore Cloud & Core classes, app features, booking steps, and membership tools.
- Preview five real, localized app screens and use official App Store badges to reach the Cloud & Core iPhone listing.
- Share language-specific page metadata with canonical, social, alternate-language, and structured application details.

### Changed

- Honor an explicit `/app` language during server rendering while preserving existing authentication and protected-route behavior.
- Route sign-in, support, legal, phone, WhatsApp, email, Instagram, and App Store actions through their verified destinations.
- Cover the public experience with localized contract tests, asset checks, production-build browser checks, responsive layouts, reduced motion, and protected-route regressions.

### Fixed

- Prevent mobile marketing-header controls from overlapping and keep dark-section text and calls to action readable.
- Use one shared localized App Store badge map throughout the page.
