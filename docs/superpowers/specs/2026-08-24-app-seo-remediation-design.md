# Cloud & Core `/app` SEO Remediation Design

## Summary

Remediate the existing Cloud & Core marketing route into three crawlable, server-rendered, localized pages at `/app/ar`, `/app/he`, and `/app/en`. Preserve the current application, authentication, booking, payment, and native-wrapper behavior. The work is isolated on `codex/app-seo-remediation`, based directly on `origin/main`.

This remediation does not include the separate Yoga-with-Lina promotion, schedule-source work, database migrations, deployment, or App Store submission.

## Goals

- Return public HTTP 200 SSR responses with localized primary content at `/app/ar`, `/app/he`, and `/app/en`.
- Make the localized pages indexable with correct document language, direction, canonicals, reciprocal hreflang, Open Graph metadata, and structured data.
- Route `/app` temporarily to the best locale using explicit language, saved preference, browser language, and Arabic fallback.
- Make `/` safe for authenticated users, installed native clients, and ordinary public web visitors.
- Use only verified Cloud & Core business data and authentic repository assets.
- Replace duplicated and negative-state app captures with localized, privacy-safe captures of real application UI.
- Keep schedule, App Store, and existing-member actions distinct and measurable.
- Verify accessibility, responsive behavior, performance, routing, and existing critical flows.

## Non-goals and safety boundaries

- Do not deploy, merge, enable, or migrate `feature/yoga-lina-launch-promo`.
- Do not apply any database migration or production configuration change.
- Do not alter authentication providers, payment configuration, route guards, bundle identifiers, Apple app IDs, or the App Store listing.
- Do not add customer identities, testimonials, ratings, reviews, awards, qualifications, or unverified claims.
- Do not use stock or generated people.
- Do not introduce another framework, localization system, analytics provider, or design system.

## Existing architecture

The application uses React 19, TanStack Start and TanStack Router with file-based routes and SSR, Vite, Tailwind CSS v4, route-focused CSS, and a shared Arabic/Hebrew/English localization system. The root shell can set `lang` and `dir` during SSR. Public routes include `/app`, `/auth`, `/support`, `/privacy`, `/terms`, and `/member/schedule`; protected member, instructor, and admin routes remain behind existing guards.

The Capacitor wrapper currently launches the production origin at `/`, so the root is a native application entry point. Authentication and payment callbacks use their own paths. Existing analytics sends events through the repository's data-layer/custom-event adapter and already has safe Instagram attribution helpers.

## Routing architecture

### Localized routes

Create static file routes for:

- `/app/ar`
- `/app/he`
- `/app/en`

Each route will share one marketing component and one canonical content/data module while fixing the locale at the route boundary. The server response will contain the localized H1 and primary content before hydration. No route imports or invokes an authentication guard.

Static locale routes are preferred over one unconstrained parameter route because their valid URLs, metadata, route types, and invalid-locale behavior are explicit.

### `/app` redirect

Keep `/app` as a redirect-only public route. Resolve the destination in this order:

1. valid `lang` query parameter;
2. valid `cc_lang` preference cookie;
3. `Accept-Language` on the server or `navigator.languages` in a browser fallback;
4. Arabic.

Return a temporary redirect. Preserve only approved UTM values (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, and `utm_id`) and discard authentication, payment, and private parameters.

### Platform-aware and auth-aware `/`

Root behavior is:

- authenticated visitor on any platform: redirect to the existing role home;
- unauthenticated native visitor: redirect to `/auth`;
- unauthenticated ordinary web visitor: redirect to the resolved localized marketing route.

Future native packages will mark the root launch explicitly so the server can decide immediately. Existing installed packages still open an unmarked `/`; for those requests, a minimal noindex routing bridge will use the existing Capacitor runtime check before replacing the location. This avoids fragile mobile user-agent guessing. The bridge contains no marketing or application shell that could compete in search.

## Localization and navigation

Each localized page sets the initial document attributes without hydration shifts:

- Arabic: `lang="ar" dir="rtl"`
- Hebrew: `lang="he" dir="rtl"`
- English: `lang="en" dir="ltr"`

The visible selector uses real `<a>` elements for `/app/ar`, `/app/he`, and `/app/en`, with `hreflang`, current-page state, keyboard focus, and preserved approved UTMs. Selecting a language also persists the existing preference through the shared localization mechanism.

## Page content and CTAs

Use the exact supplied localized hero, benefits, service descriptions, how-it-works steps, FAQ questions, and final CTA copy. The route will load the existing public studio/plan configuration and display the ₪80 trial offer only when the canonical active one-credit plan still confirms it.

The CTA hierarchy is explicit:

- schedule/booking: `/member/schedule`;
- App Store: `https://apps.apple.com/app/id6786035836` using Apple's official localized badge;
- existing member: `/auth`.

Approved UTM attribution continues to the schedule and account-creation flows through the existing attribution mechanism. Legal and support destinations remain unchanged.

## Authentic imagery and app screenshots

Remove `/images/classes/aerial-yoga-flow.webp` from marketing rendering. Use only the real empty studio, authentic aerial-hammock/studio detail, studio sign, official logo, and official Apple badge assets already in the repository. Preserve natural image ratios, declare dimensions, preload only the hero, and lazy-load lower-page images.

Replace the current duplicated schedule/detail capture, empty booking state, inactive/zero-credit membership, and incomplete profile captures.

A development/test-only capture harness will:

- import real application presentation components;
- supply deterministic fictional Arabic, Hebrew, and English data in memory;
- render schedule, class details with booking action, confirmed upcoming booking, active membership with nonzero credits, and complete demo profile/account screens;
- run only through a dedicated local test entry, never a production route or production data source;
- connect to no production database and persist no demo users;
- generate static marketing assets committed under the existing public asset structure.

Only the resulting localized static images ship with the public route. No real phone, email, customer name, membership identifier, booking identifier, or payment information appears.

## Trust, location, and FAQ

Display only verified facts: beginner-friendly classes, small groups, personal attention, women's classes, children's classes from age seven, and the Hurfeish location. Add the verified Main Road 89 address, exact coordinates `33.016109,35.349285`, Google Maps navigation, canonical phone/WhatsApp, Instagram, and support actions.

Use six semantic localized FAQ disclosures. Answers are limited to verified policies already present in the repository: beginner suitability, no prior flexibility requirement, verified comfortable-clothing guidance, age seven, booking through the application, the canonical trial price when active, and the verified location. Omit unavailable cancellation, payment, duration, schedule, or health claims.

Reviews and instructor biography sections are omitted because no approved canonical content exists. They remain documented content blockers.

## SEO and sharing metadata

Every localized route has:

- the exact supplied localized title and description;
- one visible localized H1;
- a self-referencing canonical;
- reciprocal `ar`, `he`, `en`, and `x-default` alternate links;
- index/follow behavior;
- localized Open Graph title, description, URL, locale, alternate locales, and image;
- the Apple Smart App Banner for app ID `6786035836`.

Generate 1200×630 localized sharing cards deterministically from an approved real studio image and the official logo. The cards contain minimal localized text and no people or fabricated UI.

Emit one verified JSON-LD graph containing:

- `HealthClub` for Cloud & Core with canonical address, geo, contact details, languages, social identity, and verified services;
- `SoftwareApplication` for the iOS application with canonical App Store install URL, icon, category, localized description, and publisher reference;
- `FAQPage` matching the visible localized questions and answers.

Do not emit ratings, reviews, opening hours, prices not confirmed by canonical configuration, or Android availability.

Add `/sitemap.xml` with the three marketing routes plus support/privacy/terms. Exclude authentication, protected application, checkout, and payment routes. Add or update `/robots.txt` to allow public routes/assets while relying on existing private-route authentication/noindex behavior.

## Analytics and attribution

Reuse the existing analytics adapter only. Add:

- `app_landing_view`
- `app_landing_language_change`
- `app_landing_view_schedule`
- `app_landing_create_account`
- `app_landing_login`
- `app_landing_app_store_click`
- `app_landing_whatsapp_click`
- `app_landing_instagram_click`
- `app_landing_maps_click`
- `app_landing_support_click`

Allowed properties are `language`, `route`, `utm_source`, `utm_medium`, `utm_campaign`, `device_type`, and `cta_location`. The view event is deduplicated across SSR/hydration. No name, email, telephone, member, booking, or payment data is sent.

## Accessibility and responsive behavior

Meet WCAG 2.1 AA expectations through semantic landmarks and headings, one H1, keyboard-operable crawlable language links, visible focus, adequate contrast, practical touch sizes, localized descriptive alt text, accessible disclosure state, correct reading direction, reduced-motion handling, and no image-only text.

Test at 320×568, 375×812, 390×844, 430×932, 768×1024, 1024×768, and 1440×900. The page must have no horizontal scrolling, clipped RTL text, overlapping actions, distorted screenshots, hidden content, or unusable language/contact controls.

## Performance design

Keep the marketing route code separate from authenticated route bundles. Do not eagerly import member, admin, instructor, payment, Stripe, or Supabase-heavy modules. Preload/fetch-prioritize only the responsive hero asset, lazy-load lower media, declare intrinsic dimensions, keep fonts to existing required families/weights, avoid autoplay/video and animation libraries, and prevent locale/direction layout shifts.

Record mobile and desktop Lighthouse results against the local production server. Treat LCP ≤2.5s, INP ≤200ms, and CLS ≤0.1 as targets and report measured values without inventing scores.

## Test strategy

Use test-driven vertical slices at public seams:

1. pure locale, UTM, metadata, JSON-LD, and sitemap helpers;
2. production-server status, redirect, SSR initial HTML, canonical, hreflang, and guard behavior;
3. browser navigation, analytics, accessibility, CTA, directionality, and responsive rendering.

Regression coverage includes `/auth`, supported login languages, account creation/password reset entry points, protected role routes, public legal/support pages, guest schedule/booking entry, payment-result routing, direct localized refreshes, and Cloud Run production serving. No real payment or production data is used.

Run formatter checks, lint, standalone type-check, unit/integration/E2E tests, production build, HTTP SSR assertions, Lighthouse, and visual captures. The repository's unrelated baseline type and global-format failures will not be hidden or mass-rewritten; touched files must pass and the final report will distinguish baseline failures from regressions.

Capture and manually inspect Arabic, Hebrew, and English mobile/desktop pages plus the hero, screenshot showcase, classes, FAQ, location, and final CTA sections.

## Delivery

Commit the design, implementation plan, vertical implementation slices, generated assets, tests, and final evidence on `codex/app-seo-remediation`. The final report will provide branch and commit hashes, file scope, exact routes and CTAs, asset replacements, screenshot-generation method, SEO/JSON-LD/indexing changes, analytics, accessibility/performance work, commands and exact results, QA evidence paths, blockers, and deployment instructions.

Do not deploy, merge, run migrations, enable the Yoga-with-Lina feature, or alter the App Store listing.
