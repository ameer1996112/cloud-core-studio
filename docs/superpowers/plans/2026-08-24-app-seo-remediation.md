# Cloud & Core `/app` SEO Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver three public SSR marketing routes with complete multilingual SEO, authentic media, distinct conversion paths, safe native/browser root routing, privacy-safe analytics, and recorded QA evidence.

**Architecture:** Keep TanStack Start and the current marketing component. Put locale/URL/metadata/schema decisions in pure helpers, expose three static route files through a shared route factory, keep `/app` redirect-only, and use a noindex client bridge only when the server cannot distinguish an existing native launch from a web visit. Generate replacement captures from a test-only deterministic harness and ship only static images.

**Tech Stack:** React 19, TanStack Start/Router SSR, TypeScript, Bun tests, Python Playwright, existing CSS/Tailwind v4, Capacitor, existing data-layer analytics.

---

## File map

- `src/lib/app-marketing.ts`: localized content, locale/UTM resolution, canonical metadata, screenshots, FAQ, schema, sitemap constants.
- `src/lib/app-marketing.analytics.ts`: typed `app_landing_*` adapter over the existing data layer/custom event runtime.
- `src/routes/app.tsx`: temporary locale redirect only.
- `src/routes/app.ar.tsx`, `src/routes/app.he.tsx`, `src/routes/app.en.tsx`: static SSR route registrations.
- `src/routes/app-marketing-route.tsx`: shared loader/head/component route factory support.
- `src/routes/index.tsx`: authenticated/native/browser root gate.
- `src/routes/__root.tsx`: localized-path shell language and generic authentic social fallback.
- `src/routes/sitemap[.]xml.ts`, `src/routes/robots[.]txt.ts`: public indexing responses.
- `src/components/app-marketing/AppMarketingPage.tsx`: semantic page sections, crawlable language links, CTAs, tracking, FAQ, and location.
- `src/components/app-marketing/app-marketing.css`: responsive/RTL/focus/layout styling.
- `capacitor.config.ts`: explicit native launch marker for future packages; no bundle ID or App Store change.
- `tests/fixtures/app-marketing/*`: test-only deterministic screenshot UI and Vite entry.
- `scripts/capture-app-marketing-assets.mjs`: local Playwright asset generation with a production-environment refusal.
- `public/images/app-marketing/{ar,he,en}/*.png`: generated localized application captures.
- `public/images/app-marketing/social/{ar,he,en}.png`: generated authentic sharing cards.
- `tests/unit/appMarketing.test.ts`: pure helper/schema/content tests.
- `tests/unit/appMarketingRoute.test.mjs`: source-level route, indexing, and safety assertions.
- `tests/unit/appMarketingAnalytics.test.ts`: event context, deduplication, and PII-exclusion tests.
- `tests/e2e/app-marketing-playwright.py`: production-server SSR/browser/visual regression suite.

### Task 1: Locale, UTM, metadata, and schema contract

**Files:**
- Modify: `tests/unit/appMarketing.test.ts`
- Modify: `src/lib/app-marketing.ts`

- [ ] **Step 1: Write failing pure-helper tests**

Add assertions equivalent to:

```ts
expect(resolveMarketingLocale({ explicit: "en", saved: "he", accepted: "ar-IL" })).toBe("en");
expect(resolveMarketingLocale({ saved: "he", accepted: "ar-IL" })).toBe("he");
expect(resolveMarketingLocale({ accepted: "en-US,en;q=0.9" })).toBe("en");
expect(resolveMarketingLocale({ accepted: "fr-FR" })).toBe("ar");
expect(sanitizeMarketingUtm("?utm_source=ig&utm_campaign=fall&email=x&returnTo=/admin"))
  .toEqual({ utm_source: "ig", utm_campaign: "fall" });
expect(getAppMarketingMeta("ar").canonical).toBe("https://cloudandcorestudio.com/app/ar");
expect(getAppMarketingAlternates("he")).toContainEqual({
  rel: "alternate",
  hrefLang: "x-default",
  href: "https://cloudandcorestudio.com/app/ar",
});
```

Test exact supplied localized titles, descriptions, H1/hero text, four benefits, four services, five screenshot headings, six FAQ questions, exact CTA labels, verified geo, `HealthClub`, `SoftwareApplication`, and `FAQPage`. Assert the schema contains no rating/review/opening-hours fields and uses `https://apps.apple.com/app/id6786035836`.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `bun test tests/unit/appMarketing.test.ts`

Expected: FAIL because the new route/UTM/schema contracts do not exist.

- [ ] **Step 3: Implement the pure contract**

Add focused exported types/functions:

```ts
export const APP_MARKETING_LANGS = ["ar", "he", "en"] as const;
export type AppMarketingLang = (typeof APP_MARKETING_LANGS)[number];
export function resolveMarketingLocale(input: {
  explicit?: unknown;
  saved?: unknown;
  accepted?: string | null;
}): AppMarketingLang;
export function sanitizeMarketingUtm(input: string | URLSearchParams): MarketingUtm;
export function buildMarketingHref(path: string, utm: MarketingUtm): string;
export function getAppMarketingMeta(lang: Lang): AppMarketingMeta;
export function getAppMarketingAlternates(lang: Lang): HeadLink[];
export function buildAppMarketingStructuredData(data: AppMarketingRouteData): JsonLdGraph;
```

Replace the query-route copy with the exact approved content. Use `HealthClub`, exact geo/address, `installUrl`, visible FAQ answers, localized social image paths, and canonical locale URLs. Keep trial pricing conditional on canonical plan data.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `bun test tests/unit/appMarketing.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/app-marketing.ts tests/unit/appMarketing.test.ts
git commit -m "feat: define localized app marketing SEO contract"
```

### Task 2: Static SSR routes and `/app` redirect

**Files:**
- Create: `src/routes/app-marketing-route.tsx`
- Create: `src/routes/app.ar.tsx`
- Create: `src/routes/app.he.tsx`
- Create: `src/routes/app.en.tsx`
- Modify: `src/routes/app.tsx`
- Modify: `src/routes/__root.tsx`
- Modify: `tests/unit/appMarketingRoute.test.mjs`
- Modify after generation: `src/routeTree.gen.ts`

- [ ] **Step 1: Write failing route-source and shell tests**

Assert three locale route files exist without auth guards, `/app` imports `redirect`, locale paths are recognized by the root shell, and metadata includes canonical, reciprocal hreflang, Smart App Banner, Open Graph alternate locales, and JSON-LD.

```js
expect(read("src/routes/app.ar.tsx")).toContain('createAppMarketingRoute("/app/ar", "ar")');
expect(read("src/routes/app.tsx")).toContain("resolveAppMarketingRedirect");
expect(read("src/routes/__root.tsx")).toContain("readAppMarketingPathLang");
```

- [ ] **Step 2: Run and confirm RED**

Run: `bun test tests/unit/appMarketingRoute.test.mjs`

Expected: FAIL for missing static routes.

- [ ] **Step 3: Add the shared SSR route factory and static files**

The factory loader returns `{ lang, appStoreUrl, profile, trialPrice, utm }`; its head uses only the fixed route locale. Each static file contains only its registration:

```ts
export const Route = createAppMarketingRoute("/app/ar", "ar");
```

The head emits exact title/description, index/follow, Smart App Banner, localized OG, self canonical, all alternates, critical hero preload, and escaped JSON-LD. The component applies the fixed language only if hydration state differs.

- [ ] **Step 4: Make `/app` redirect-only**

Resolve `lang`, cookie, `Accept-Language`, then Arabic. Throw a temporary TanStack redirect to the typed locale path and preserve only sanitized UTMs. No marketing component remains registered at `/app`.

- [ ] **Step 5: Teach the root shell localized path languages**

Use:

```ts
const routeLang = readAppMarketingPathLang(new URL(request.url).pathname);
if (routeLang) return routeLang;
```

on server and client before cookie/default resolution.

- [ ] **Step 6: Generate the route tree and run tests/build**

Run: `bunx vite build --mode development`

Expected: route tree includes `/app/ar`, `/app/he`, `/app/en`; build succeeds.

Run: `bun test tests/unit/appMarketing.test.ts tests/unit/appMarketingRoute.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/routes/app.tsx src/routes/app.ar.tsx src/routes/app.he.tsx src/routes/app.en.tsx src/routes/app-marketing-route.tsx src/routes/__root.tsx src/routeTree.gen.ts tests/unit/appMarketingRoute.test.mjs
git commit -m "feat: add public localized app SSR routes"
```

### Task 3: Platform-aware and auth-aware root

**Files:**
- Modify: `src/routes/index.tsx`
- Modify: `capacitor.config.ts`
- Create: `tests/unit/rootMarketingRouting.test.mjs`

- [ ] **Step 1: Write failing routing-policy tests**

Assert the policy matrix:

```ts
authenticated("admin") -> "/admin"
authenticated("instructor") -> "/instructor"
authenticated("member") -> "/member"
unauthenticated({ platform: "native" }) -> "/auth"
unauthenticated({ platform: "web", lang: "he" }) -> "/app/he"
```

Also assert `capacitor.config.ts` preserves `com.cloudandcore.studio` and marks future launches without changing the production origin.

- [ ] **Step 2: Run and confirm RED**

Run: `bun test tests/unit/rootMarketingRouting.test.mjs`

Expected: FAIL because `/` always redirects to `/auth`.

- [ ] **Step 3: Implement the server/client routing gate**

In `beforeLoad`, call `getAuthRouteContext()` and immediately redirect authenticated roles. Treat the explicit native launch marker as `/auth`. For an unmarked unauthenticated request, render a minimal component with `robots=noindex,follow`; its effect calls `Capacitor.isNativePlatform()` and replaces to `/auth` or a resolved localized marketing path. Include an Arabic marketing fallback link for script-disabled browsers.

Change only the configured launch URL to append the non-private native marker; do not change app ID, app name, server host, or platform projects.

- [ ] **Step 4: Run focused tests and production build**

Run: `bun test tests/unit/rootMarketingRouting.test.mjs`

Expected: PASS.

Run: `bun run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/index.tsx capacitor.config.ts tests/unit/rootMarketingRouting.test.mjs
git commit -m "feat: route native and browser root visits safely"
```

### Task 4: Marketing page content, crawlable links, CTAs, trust, and FAQ

**Files:**
- Modify: `src/components/app-marketing/AppMarketingPage.tsx`
- Modify: `src/components/app-marketing/app-marketing.css`
- Modify: `tests/unit/appMarketingRoute.test.mjs`

- [ ] **Step 1: Add failing DOM/source contract tests**

Assert language selector anchors point to static locale paths with `hrefLang`; the page renders exact H1, trust/offer lines, four detailed services, five screenshot headings, three steps, six `<details>` FAQs, location/map/contact/support actions, and three distinct CTA destinations. Assert the generic woman path is absent.

- [ ] **Step 2: Run and confirm RED**

Run: `bun test tests/unit/appMarketingRoute.test.mjs`

Expected: FAIL for button-only languages, old CTAs, missing sections, and generic image.

- [ ] **Step 3: Refactor the page into focused internal sections**

Use semantic anchors built by `buildMarketingHref`, fixed localized content, `/member/schedule`, canonical App Store URL, and `/auth`. Replace the second class image with the authentic studio sign/hammock detail. Use semantic `<details><summary>` FAQ markup and a visible coordinates-based Maps link. Add explicit media dimensions, localized alt text, hero fetch priority, and lower-page lazy loading.

- [ ] **Step 4: Update focused styles**

Add visible `:focus-visible`, logical CSS properties, RTL-safe icons, 44px targets, responsive image sizing, FAQ/location layouts, and narrow-screen wrapping. Preserve Quiet Strength tokens and reduced-motion rules.

- [ ] **Step 5: Run tests and format touched files**

Run: `bunx prettier --check src/components/app-marketing/AppMarketingPage.tsx src/components/app-marketing/app-marketing.css src/lib/app-marketing.ts`

Expected: PASS.

Run: `bun test tests/unit/appMarketing.test.ts tests/unit/appMarketingRoute.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/app-marketing/AppMarketingPage.tsx src/components/app-marketing/app-marketing.css tests/unit/appMarketingRoute.test.mjs
git commit -m "feat: complete authentic localized app landing content"
```

### Task 5: Privacy-safe analytics and UTM continuation

**Files:**
- Create: `src/lib/app-marketing.analytics.ts`
- Create: `tests/unit/appMarketingAnalytics.test.ts`
- Modify: `src/components/app-marketing/AppMarketingPage.tsx`

- [ ] **Step 1: Write failing analytics tests**

Create a fake runtime and assert view deduplication, all ten allowed event names, `cta_location` separation, sanitized attribution, and absence of keys matching `email|phone|name|member|booking|payment`.

- [ ] **Step 2: Run and confirm RED**

Run: `bun test tests/unit/appMarketingAnalytics.test.ts`

Expected: FAIL because the adapter is missing.

- [ ] **Step 3: Implement the existing-provider adapter**

Mirror the existing data-layer/custom-event contract:

```ts
export type AppMarketingEventName =
  | "app_landing_view"
  | "app_landing_language_change"
  | "app_landing_view_schedule"
  | "app_landing_create_account"
  | "app_landing_login"
  | "app_landing_app_store_click"
  | "app_landing_whatsapp_click"
  | "app_landing_instagram_click"
  | "app_landing_maps_click"
  | "app_landing_support_click";
```

Build context only from current localized route, sanitized UTMs, device class, and CTA location. Dispatch `cloudcore:analytics` and push to `dataLayer` when present. Track the view once per page instance.

- [ ] **Step 4: Wire semantic actions**

Track hero/final/header CTA locations before navigation. Preserve sanitized UTMs on schedule and account-creation links; never add them to phone, WhatsApp, Maps, Instagram, support, or App Store destinations unless required by the existing attribution mechanism.

- [ ] **Step 5: Run tests and commit**

Run: `bun test tests/unit/appMarketingAnalytics.test.ts tests/unit/appMarketing.test.ts`

Expected: PASS.

```bash
git add src/lib/app-marketing.analytics.ts src/components/app-marketing/AppMarketingPage.tsx tests/unit/appMarketingAnalytics.test.ts
git commit -m "feat: track app landing conversions safely"
```

### Task 6: Test-only screenshot and social-card capture

**Files:**
- Create: `tests/fixtures/app-marketing/index.html`
- Create: `tests/fixtures/app-marketing/main.tsx`
- Create: `tests/fixtures/app-marketing/fixture.css`
- Create: `tests/fixtures/app-marketing/vite.config.ts`
- Create: `scripts/capture-app-marketing-assets.mjs`
- Modify: `package.json`
- Replace: `public/images/app-marketing/{ar,he,en}/{schedule,booking,bookings,membership,account}.png`
- Create: `public/images/app-marketing/social/{ar,he,en}.png`
- Modify: `tests/unit/appMarketingAssets.test.mjs`

- [ ] **Step 1: Strengthen failing asset tests**

Assert each locale's five files has a distinct SHA-256 digest, positive-state fixture markers, expected dimensions, no generic image dependency, and three 1200×630 social cards. Assert the capture script refuses when `NODE_ENV=production`.

- [ ] **Step 2: Run and confirm RED**

Run: `bun test tests/unit/appMarketingAssets.test.mjs`

Expected: FAIL because schedule/booking are duplicated and social cards are absent.

- [ ] **Step 3: Build the isolated fixture**

The dedicated Vite entry renders deterministic fictional data only: several available classes, a class detail with spots and booking action, confirmed upcoming booking, active plan with nonzero credits, and complete localized demo profile. Reuse existing application tokens and presentational primitives. Do not import Supabase clients or register a TanStack production route.

- [ ] **Step 4: Add the guarded capture script**

Exit nonzero when `NODE_ENV === "production"`. Start the dedicated local Vite fixture, use Playwright to select each `[data-capture]`, save 390×844 localized screens, and capture localized 1200×630 social cards using the authentic studio image and logo. Do not read `.env` or call the network.

- [ ] **Step 5: Generate and inspect assets**

Run: `bun run marketing:capture-assets`

Expected: 18 generated images and no network/data-source access.

Open the contact sheets or individual files and confirm distinct positive states, matching locale, no real identity, correct proportions, and legible UI.

- [ ] **Step 6: Run asset tests and commit**

Run: `bun test tests/unit/appMarketingAssets.test.mjs`

Expected: PASS.

```bash
git add package.json tests/fixtures/app-marketing scripts/capture-app-marketing-assets.mjs public/images/app-marketing tests/unit/appMarketingAssets.test.mjs
git commit -m "feat: generate privacy-safe localized app captures"
```

### Task 7: Sitemap and robots responses

**Files:**
- Create: `src/routes/sitemap[.]xml.ts`
- Create: `src/routes/robots[.]txt.ts`
- Create: `tests/unit/appMarketingIndexing.test.mjs`
- Modify after generation: `src/routeTree.gen.ts`

- [ ] **Step 1: Write failing indexing tests**

Assert sitemap contains exactly the three marketing locales plus support/privacy/terms public entries, excludes auth/protected/payment paths, and robots allows public crawling and names the canonical sitemap.

- [ ] **Step 2: Run and confirm RED**

Run: `bun test tests/unit/appMarketingIndexing.test.mjs`

Expected: FAIL because the response routes are missing.

- [ ] **Step 3: Implement raw GET handlers**

Return UTF-8 XML/text `Response` objects with correct content types and conservative cache headers. Use the canonical URL constants from `app-marketing.ts`; do not enumerate private routes.

- [ ] **Step 4: Generate routes, run tests, and commit**

Run: `bunx vite build --mode development`

Run: `bun test tests/unit/appMarketingIndexing.test.mjs`

Expected: PASS.

```bash
git add src/routes/sitemap[.]xml.ts src/routes/robots[.]txt.ts src/routeTree.gen.ts tests/unit/appMarketingIndexing.test.mjs
git commit -m "feat: expose public app sitemap and robots policy"
```

### Task 8: Production SSR, browser, accessibility, and responsive QA

**Files:**
- Modify: `tests/e2e/app-marketing-playwright.py`
- Create: `tmp/app-seo-remediation-qa/` evidence (not committed unless repository policy requires)

- [ ] **Step 1: Update E2E assertions before final polish**

For each locale assert HTTP 200, localized text in initial HTML, correct `html[lang][dir]`, one H1, self canonical, four alternates, index/follow, Smart App Banner, three schema objects, crawlable language links, correct CTAs, distinct screenshot sources/alts, no generic image, and no horizontal overflow at every required viewport.

Assert `/app` temporary redirects for explicit query/cookie/Accept-Language/fallback and safe UTMs. Assert root marker/native/web/authenticated policy using deterministic test seams. Assert `/auth`, support/privacy/terms, guest schedule, and protected route behavior remain intact.

- [ ] **Step 2: Run the production build and server**

Run: `/bin/zsh -lc 'set -a; source ../../.env; set +a; bun run build'`

Expected: PASS.

Run the existing production server on a free local port and execute the E2E file against it.

- [ ] **Step 3: Capture visual evidence**

Save Arabic/Hebrew/English mobile and desktop full pages plus hero, screenshots, classes, FAQ, location, and final CTA under `tmp/app-seo-remediation-qa/`. Manually inspect direction, clipping, uniqueness, CTA prominence, image loading, spacing, and brand consistency.

- [ ] **Step 4: Run accessibility and Lighthouse checks**

Use browser accessibility inspection plus Lighthouse mobile/desktop against the local production server. Record actual scores and LCP/CLS; exercise interactions to verify no long-task regression and report INP only when measured legitimately.

- [ ] **Step 5: Commit E2E changes**

```bash
git add tests/e2e/app-marketing-playwright.py
git commit -m "test: verify app SEO remediation end to end"
```

### Task 9: Full regression, review, and delivery report

**Files:**
- Modify only if review finds defects: files from Tasks 1–8
- Create: `docs/reports/2026-08-24-app-seo-remediation.md`

- [ ] **Step 1: Run touched-file formatting**

Run: `bunx prettier --check <all touched text files>`

Expected: PASS.

- [ ] **Step 2: Run repository verification**

Run:

```bash
bun run lint
bunx tsc --noEmit
bun run test
/bin/zsh -lc 'set -a; source ../../.env; set +a; bun run build'
```

Record exact counts and distinguish known baseline failures from new regressions. Do not suppress or mass-reformat unrelated files.

- [ ] **Step 3: Run the code-review skill and fix all valid findings**

Review `origin/main...HEAD` for correctness, security/privacy, SSR/indexing, accessibility, routing regressions, and accidental promotion/migration files. Re-run the smallest relevant test after each fix, then the complete suite.

- [ ] **Step 4: Prove branch isolation**

Run:

```bash
git diff --name-only origin/main...HEAD
git diff --name-only origin/main...HEAD | rg 'yoga-lina|supabase/migrations|goldmineScheduleSource' && exit 1 || true
```

Expected: no Yoga-with-Lina, schedule-source, or migration files.

- [ ] **Step 5: Write and commit the evidence report**

Include architecture/baseline, branch and commits, files, routes/root behavior, localization/CTAs, removed/replacement media, capture method, SEO/hreflang/schema/sitemap/robots, analytics, accessibility/performance, exact commands/results, screenshot paths, blockers, and deployment instructions that explicitly require separate authorization.

```bash
git add docs/reports/2026-08-24-app-seo-remediation.md
git commit -m "docs: report app SEO remediation evidence"
```

- [ ] **Step 6: Stop without deployment or merge**

Return the isolated branch name and ordered commit hashes. Do not push, merge, deploy, migrate, enable the promotion feature, or edit the App Store listing.
