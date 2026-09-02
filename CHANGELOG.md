# Changelog

All notable changes to Cloud & Core Studio are documented in this file.

## [0.3.5.1] - 2026-09-02

### Fixed

- Prevent a saved browser language from changing localized content before React hydrates when the hosting boundary renders the request in a different locale.

## [0.3.5.0] - 2026-09-02

### Changed

- Give the member account page a calmer, premium editorial layout across mobile and desktop while preserving all existing profile, concierge, session, privacy, and deletion-request behavior.
- Separate privacy links, session controls, and destructive account actions into clear responsive surfaces with consistent spacing, hierarchy, and touch targets.

### Fixed

- Prevent account privacy and deletion-recovery actions from appearing visually joined or cramped on small screens.
- Keep deletion retry and support actions readable, keyboard accessible, and safely stacked for long English, Hebrew, and Arabic labels.
- Harden the local-only member fixture lifecycle so studio settings are restored exactly and all fixture database access refuses non-loopback targets and inherited PostgreSQL overrides.

## [0.3.4.0] - 2026-09-01

### Added

- Add persistent, accessible member feedback panels for package-payment failures and account-deletion request outcomes in English, Hebrew, and Arabic.
- Add local-only member QA fixture, authentication, environment-guard, and headed-browser support without exposing fixture credentials or production test bypasses.

### Changed

- Make package totals and payment-provider handoff language clearer while preserving the existing HYP checkout contract and authoritative backend pricing.
- Present account deletion as a reviewed request, with keyboard-accessible confirmation, durable status feedback, focus management, retry, and support recovery.
- Improve the authenticated language menu with roving keyboard navigation, Escape handling, focus restoration, and RTL-safe semantics.

### Fixed

- Prevent duplicate package-payment and deletion-request activation while a request is pending.
- Reject malformed deletion responses instead of showing a false submitted state, and keep authenticated recovery pages localized in every supported language.
- Allow long package and class-location content to wrap without introducing mobile horizontal overflow.

## [0.3.3.0] - 2026-09-01

### Fixed

- Show one clean header, language switcher, content area, footer, and skip link on every localized app marketing page instead of stacking the shared public layout around the page's own navigation.

## [0.3.2.0] - 2026-08-31

### Fixed

- Keep booking totals compact and visually grouped on the member Bookings page, including when upcoming and waitlist counts are zero.
- Render booking-tab totals as isolated numeric badges so Hebrew and Arabic layouts no longer reorder a dot separator around the count.

## [0.3.1.0] - 2026-08-30

### Fixed

- Keep authenticated member tab changes inside the app instead of refreshing the entire page when leaving Schedule on mobile or desktop.
- Preserve immediate destination loading feedback and normal modified-click behavior while switching between member pages.

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
