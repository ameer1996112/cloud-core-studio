# Cloud & Core App Marketing Page Design

## Summary

Add a production-ready public marketing page at `/app` for the existing Cloud & Core iOS application. The page will use the existing TanStack Start application, brand system, localization state, public studio data, App Store configuration, and approved imagery. It will not alter authentication, authorization, booking, payment, member, instructor, or admin behavior.

## Goals

- Make `/app` directly accessible without authentication in local development and the existing Cloud Run deployment.
- Present the real Cloud & Core application in Hebrew, Arabic, and English with correct RTL/LTR behavior.
- Use only official brand assets, real studio photography, and current application screenshots already present in the repository.
- Provide accurate links to `/auth`, the Cloud & Core App Store listing, `/support`, `/privacy`, and `/terms`.
- Add indexable, localized SEO metadata and verified structured data.
- Meet the requested accessibility, responsive, performance, and regression expectations without adding a new framework, design system, analytics provider, or large dependency.

## Non-goals

- Rebuilding the website or authentication experience.
- Changing protected-route logic or the existing guest schedule flow.
- Adding prices, testimonials, ratings, download counts, reviews, or unverified business claims.
- Deploying the result or modifying the App Store listing.
- Adding analytics when no analytics provider exists in the repository.

## Existing Architecture

The application uses React 19, TanStack Start and TanStack Router, Vite, Tailwind CSS v4, and a shared Cloud & Core CSS design system. Routes are file-based. Public sibling routes include `/auth`, `/support`, `/privacy`, `/terms`, `/download`, `/instagram`, and `/member/schedule`. Protected member, instructor, and admin routes are nested beneath `_authenticated` and guarded by `requireAuthenticatedRoute` and role-specific route guards.

Localization is managed by `src/lib/i18n.ts`. It supports `he`, `ar`, and `en`, stores the preference in the `cc_lang` cookie and `localStorage`, and updates the document `lang` and `dir`. The root shell reads the cookie during SSR. Hebrew is the application default.

Brand tokens are defined in the shared styles and token files. Official logos live under `public/brand`, approved studio imagery lives under `public/images` and `src/assets`, and localized application captures already exist for schedule, booking detail, bookings, packages, and account. The configured App Store destination is supplied by `getDownloadConfig()` and defaults to the existing app ID `6786035836`.

Cloud Run builds the TanStack Start server and serves both generated static assets and SSR responses through `scripts/serve-production.mjs`. A file route at `/app` therefore supports direct requests and refreshes without a new rewrite rule.

## Recommended Implementation

### Route and isolation

Create `src/routes/app.tsx` as a public top-level file route. It will not import or call any authentication guard. Page-specific presentation styles will live in a focused stylesheet imported by the route so the existing unrelated working-tree edits in `src/styles.css` remain untouched.

Keep marketing copy and asset mappings in a small, page-specific module rather than expanding the already large global message catalog. The page will still use `useI18n`, `applyLang`, `LANG_META`, and the existing persistence behavior.

### Language resolution

The route will validate the optional `lang` search parameter and accept only `he`, `ar`, or `en`.

Resolution order:

1. A valid explicit `?lang=` parameter.
2. The existing saved language from the application cookie/client preference.
3. The existing Hebrew default.

On initial render and client navigation, an explicit parameter will be applied through `applyLang`. Language-selector actions will update the page language and URL while preserving `/app` as the route. Invalid values will be ignored rather than persisted. Every language change will update document language, direction, layout alignment, control direction, and localized content.

### Public studio data

Reuse the existing public studio-settings server source for address, contact email, phone/WhatsApp, and Instagram URL. The marketing route must fail softly if public settings cannot be loaded: it may use only repository-verified canonical contact values already present in the public support/legal implementation, and it must omit optional contact links rather than display unverified data.

The App Store href will come from `getDownloadConfig()` so the existing environment override remains authoritative. The expected default destination is `https://apps.apple.com/il/app/cloud-core/id6786035836`.

### Visual direction

The page will follow the existing “Quiet Strength” direction: deep navy, ivory, warm gold, powder blue, sand, and slate; editorial typography; generous negative space; precise borders; minimal shadows; and restrained motion. It will visually relate to `/auth` without copying its form layout.

The hero will use the real `cloud-core-auth-hero.webp` studio photograph and the official full logo. No people, generated imagery, stock imagery, or fabricated phone screens will be introduced.

### Page structure

1. **Header** — official logo, accessible three-language selector, and a compact `/auth` action. Mobile remains a single uncluttered row.
2. **Hero** — supplied localized headline and body copy, real studio image, primary `/auth` CTA, and official App Store badge linked to the configured App Store URL.
3. **Benefits** — four localized cards for live schedule, booking, booking management, and membership/credit tracking. Copy will describe only current application behavior.
4. **Screenshots** — localized captures in the requested order: schedule, booking detail, upcoming bookings, membership/packages and credits, and account/profile. Hebrew, Arabic, and English each use their matching capture set. The gallery will be a mobile swipe rail and a controlled wider-screen composition without distorting source aspect ratios.
5. **Classes** — the four supplied class names, plus the verified Hurfeish, small-group, and personal-attention statement. Real studio/class imagery will be used as atmosphere without claiming that a photograph depicts a different class.
6. **How it works** — create an account, choose an available class, and confirm the booking, matching the current signup, schedule, class-detail, and booking-confirmation behavior.
7. **Final CTA** — supplied localized copy, `/auth` action, App Store badge, Hurfeish location, and existing support destination.
8. **Footer** — `/support`, `/privacy`, `/terms`, and `/auth`, official logo/wordmark, studio name, verified address/contact methods, and verified social links when present.

### Screenshot assets

Promote the approved localized 390×844 application captures from the existing local screenshot set into a stable public marketing asset directory. Use one set per language for:

- schedule;
- class booking/detail;
- bookings;
- packages/membership credits;
- account/profile.

Do not use the Hebrew-only precomposed App Store marketing panels for Arabic or English. Images will have explicit dimensions, localized alt text, preserved aspect ratio, eager loading only for content visible near the top, and lazy loading below the fold.

### App Store badge

Add an official Apple-provided “Download on the App Store” badge rather than recreating it with CSS or an icon. Preserve Apple’s required proportions, clear space, and legibility. The badge will link to the existing configured product URL and open safely as an external destination.

### SEO and structured data

The route head will emit localized:

- title and meta description;
- Open Graph title, description, type, URL, locale, and an approved existing brand/studio image;
- Twitter summary-large-image metadata;
- canonical link `https://cloudandcorestudio.com/app`;
- index/follow robots behavior if needed to override inherited authenticated-page directives.

The page will include JSON-LD for `SoftwareApplication` with the verified App Store URL, iOS operating-system reference, application category, localized name/description, and publisher reference. It will also reference Cloud & Core as the verified organization/local studio using only existing public business details. No rating, aggregate rating, review, award, pricing, or download-count fields will be emitted.

### Analytics

Repository inspection found no existing analytics provider. The implementation will therefore add no tracking package, global event queue, or synthetic analytics calls. CTA behavior will remain testable without analytics side effects.

## Accessibility

- One semantic `h1`, ordered heading levels, landmark elements, and descriptive section labels.
- Keyboard-operable language selector with current-state semantics and visible focus.
- Minimum practical 44-pixel controls and sufficient color contrast.
- Localized descriptive alt text; decorative images will use empty alt text.
- Directionally neutral CSS properties and correctly mirrored icon placement.
- No meaning conveyed by color alone.
- Reduced-motion handling for entrance or scroll effects.
- Skip link and stable focus behavior for page navigation.

## Responsive and Performance Design

The route will be mobile-first and checked at 320, 375, 390, 430, 768, 1024, and 1440 pixels. It must avoid horizontal page scrolling, RTL clipping, overlapping controls, oversized whitespace, and unreadable gallery cards.

The route will add no large dependency. Existing optimized WebP photography will be reused. Screenshots will declare dimensions and lazy-load below the fold. Motion will be CSS-only, restrained, and disabled for reduced-motion users. Hero copy and primary actions will remain visible quickly on a mobile connection.

## Error Handling

- Invalid language parameters fall back to the saved/default locale and are never persisted.
- Missing optional public studio fields cause their corresponding footer/contact links to be omitted.
- Public-settings load failure uses only already verified repository fallbacks and does not block page rendering.
- A missing App Store environment override falls back to the existing checked-in app ID configuration.
- Broken or missing approved assets are treated as implementation blockers; they will not be replaced with invented content.

## Testing and Verification

Add focused tests covering:

- `/app` is a top-level public route and has no authentication guard;
- valid/invalid language resolution and selector behavior;
- Hebrew and Arabic RTL and English LTR;
- `/auth`, App Store, support, privacy, and terms destinations;
- localized screenshot selection and alt text;
- localized metadata, canonical URL, Open Graph/Twitter values, and JSON-LD restrictions;
- preservation of existing protected-route guards;
- stable responsive markup and absence of known overflow patterns.

Run:

- `bun run lint`;
- `bun run build` (the repository has no separate type-check script, and the production build performs TypeScript compilation/bundling checks);
- `bun test tests/unit tests/integration`;
- the relevant existing Playwright routing/browser checks;
- manual responsive browser inspection at every requested width;
- direct production-server requests for `/app`, `/auth`, `/support`, `/privacy`, `/terms`, and protected-route redirects.

Capture final mobile and desktop `/app` screenshots for the delivery report. Do not deploy automatically.

## Expected File Scope

Expected new or focused files:

- `src/routes/app.tsx`;
- a small `src/lib/app-marketing.ts` or equivalent content/data helper;
- a route-specific app marketing stylesheet;
- localized public screenshot assets;
- the official Apple App Store badge asset;
- focused unit and browser tests.

Existing route guards and authenticated route files should not require changes. Any unexpected need to change authentication, authorization, payment, or booking internals will stop implementation for a scope review.
