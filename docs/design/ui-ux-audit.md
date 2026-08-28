# Cloud & Core Studio UI/UX Audit

**Audit date:** 2026-08-28
**Branch:** `feature/yoga-lina-launch-promo` at `645d612`
**Status:** Partially completed, audit-only
**Current score:** **75/100 (provisional)**

The score is provisional because guest routes were inspected visually, while authenticated member, instructor, and admin content was reviewed statically only. No safe demo session or pre-existing non-production role accounts were available. Signed-out route guards were verified without creating users or changing data.

## Executive summary

Cloud & Core already has a distinctive boutique identity. The strongest screens use real studio photography, a disciplined navy/ivory base, restrained gold, clear primary actions, and language-aware typography. Sign-in, payment result, and the app marketing route feel much closer to “Quiet Strength” than a generic booking template.

The main risk is that this quality is not governed by one coherent system. The production stylesheet has grown to 11,409 lines, with 80 distinct hex colors, 322 distinct `rgb/rgba` expressions, 411 distinct `px/rem/em` lengths, and 26 distinct media-query forms. The visual result is often attractive, but expensive to maintain and difficult to verify across roles. Keyboard focus is too subtle, small gold text can fail contrast, language switching is not consistently available on public routes, and cold-load lab performance is below target.

No P0 issue was verified. Four P1 issues, eight P2 issues, and five P3 issues are recorded. Protected booking, attendance, destructive admin, and account-deletion flows remain unverified in-browser and must not be considered signed off.

## Score breakdown

Every deduction is explained below.

| Category | Score | Deduction rationale |
|---|---:|---|
| UX clarity and task completion | 15/20 | Guest schedule places a large explanatory block before the actual schedule; full booking/cancellation/waitlist paths were not safely testable; registration is long on mobile. |
| Visual hierarchy and typography | 13/15 | Strong hierarchy overall; small eyebrow/helper text and gold-on-ivory treatments are occasionally too faint. |
| Brand identity and distinctiveness | 13/15 | Photography and typography are distinctive; route-specific microsystems (`instagram`, `download`, app marketing, promo) dilute one-product consistency. |
| Component consistency | 9/15 | 80 hex colors, 322 RGB(A) values, 411 CSS lengths, 26 media-query forms, 37 `!important` declarations, and parallel button/card conventions create substantial design debt. |
| Mobile and responsive quality | 8/10 | All six requested viewports rendered without obvious horizontal overflow on inspected public pages; key content can sit too far below the fold and protected tables were not visually verified. |
| RTL and localization quality | 7/10 | Hebrew and Arabic typography is intentional and `dir` is applied globally; some public routes hardcode RTL/Hebrew and the guest schedule lacks an in-context language switcher. |
| Accessibility | 7/10 | Lighthouse accessibility scored 100 on three public routes, but manual keyboard evidence shows an underpowered focus ring; gold contrast and a nested `main` landmark remain concerns. |
| Performance and perceived speed | 3/5 | Warm local LCP was 0.60–0.99 s, but cold Lighthouse LCP was 4.95–6.24 s; the main entry, reports route, translation bundle, and CSS are heavy. INP was not measurable without a representative interaction session. |

## Strongest parts

- Sign-in has an unmistakable primary action, real studio imagery, readable form labels, and a clear guest handoff.
- Payment success and failure states are visually distinct, plain-language, and include next actions.
- App marketing uses real Cloud & Core photography and editorial composition rather than generic fitness imagery.
- Hebrew and Arabic use language-appropriate fonts; RTL is set on the document and many mixed-direction values use `dir="auto"`, `<bdi>`, or the shared bidi utilities.
- Core controls generally meet a 44–52 px minimum height.
- Public routes provide a global skip link and real `main` landmarks.
- Responsive images have dedicated shared components and most major image assets are WebP.

## Top ten problems

| ID | Severity | Finding | User impact | Recommended correction | Complexity | Dependencies / risks |
|---|---|---|---|---|---|---|
| A11Y-01 | P1 | The global focus ring is `gold` mixed to 18% transparency, while several primitives explicitly remove their outline/ring. Keyboard screenshots show focus that is absent or extremely faint. | Keyboard users can lose their position, especially on ivory/white surfaces. | Define a WCAG 2.2 focus token with a solid 2–3 px navy or high-contrast gold/navy dual ring; test every primitive. | M | May alter visual snapshots across the app. |
| A11Y-02 | P1 | Warm gold `#D4AF6A` is used as small text on ivory/white in multiple microsystems. The pair is below 4.5:1. | Labels and status copy can be unreadable for low-vision users. | Reserve gold for borders, icons, large display accents; use navy/slate for text. | S | Requires visual-regression updates. |
| PERF-01 | P1 | Cold Lighthouse performance is 65–72 with LCP 4.75–5.93 s. CSS is 392 KB; entry JS is 365 KB; reports is 401 KB; i18n is 225 KB. | First visits can feel slow and erode booking confidence. | Split locale dictionaries and large routes, trim global CSS, self-host/preload only required fonts, and prioritize LCP assets. | L | Needs representative staging measurements and bundle budgets. |
| LOC-01 | P1 | Locale control is prominent on auth/marketing but absent on the guest schedule; `/download` and `/instagram` hardcode `dir="rtl"`; root error/not-found copy is Hebrew-only. | English/Arabic users can become stranded in the wrong language during recovery or browsing. | Add one shared public locale control and localize all shell/error routes. | M | Copy review required in all three languages. |
| DS-01 | P2 | Styling is fragmented: 80 hex colors, 322 RGB(A) values, 411 lengths, 26 media-query forms, and route-local palettes. | Small changes create inconsistent regressions and slow delivery. | Freeze new literals, introduce semantic tokens, migrate by component family, and enforce lint rules. | L | Must preserve current user-owned `src/styles.css` work. |
| UX-01 | P2 | Guest schedule spends most of the first mobile viewport explaining preview access before users reach filters/classes. | Users who came to check a time may not see schedule content within five seconds. | Reduce the preview hero to one compact line and put today’s schedule/filter controls first. | M | Validate against guest-to-sign-in conversion. |
| A11Y-03 | P2 | `/admin/messages` renders a route-level `<main>` inside `AppShell`’s `<main>`. | Landmark navigation becomes ambiguous for assistive technology. | Change the route container to `section`/`div` with an accessible heading. | S | Protected browser verification required. |
| QA-01 | P2 | There is no deterministic, non-production visual fixture for all roles and route states. Existing E2E setup requires explicit mutation guardrails. | Booking, waitlist, destructive actions, tables, and role-specific mobile behavior cannot be routinely audited safely. | Add read-only mocked visual fixtures or a dedicated disposable test environment. | L | Never point fixtures at production projects. |
| TYPE-01 | P2 | Fonts are loaded from Google despite local `@fontsource` packages being installed; the font stack differs between brand, UI, Arabic, and microsystems. | Extra network dependency and potential font swap/layout delay. | Self-host selected weights, subset by script, preload only above-fold faces. | M | Licensing and Arabic/Hebrew glyph coverage must be verified. |
| CSS-01 | P2 | Token aliases and route overrides include self-referential Tailwind theme mappings and 37 `!important` declarations. | Token intent is unclear and component overrides become brittle. | Separate raw, semantic, and component tokens; remove circular aliases and migrate overrides. | M | Tailwind v4 output must be snapshot-tested. |

## Additional findings

| ID | Severity | Finding | Correction | Complexity |
|---|---|---|---|---|
| RTL-02 | P2 | Mixed-direction handling is strong in booking components but inconsistent in route-local content and hardcoded legal/social surfaces. | Make bidi utilities mandatory for times, email, phone, currency, and identifiers. | M |
| NAV-01 | P2 | Separate public headers and language controls create different navigation models across auth, schedule, marketing, download, and social routes. | Introduce a small shared `PublicShell`. | M |
| POLISH-01 | P3 | Card radii vary from tokenized 10/16/18/22 px to one-off 28/32 px and `2rem`. | Map surfaces to card/panel/modal radius roles. | S |
| POLISH-02 | P3 | Shadow vocabulary is broader than the three declared elevation tokens. | Limit to flat, raised, overlay, and sticky elevations. | S |
| POLISH-03 | P3 | Legal pages are clear but visually repetitive and their contact/support pathways are easy to miss below long text. | Add a stable legal sub-navigation and last-updated metadata. | S |
| POLISH-04 | P3 | Promo and Instagram routes behave like isolated campaigns rather than one product family. | Retain editorial freedom but reuse shell, tokens, locale, and CTA patterns. | M |
| POLISH-05 | P3 | Several tiny labels rely on the global mobile “microcopy floor” override. | Fix source component typography and retire compensating selectors. | M |

## Route-by-route findings

### Guest

| Route | Inspection | Findings |
|---|---|---|
| `/` | Visual redirect | Correctly reaches sign-in; root transition should be verified under slow JS because the route disables SSR. |
| `/auth` | Visual, keyboard, HE/AR/EN | Strong hierarchy and trust. Registration is long on 390 px; focus visibility needs improvement. |
| `/auth?mode=signup` | Visual, HE | Good labels and explicit optional notification consent; CTA falls below the first mobile viewport. |
| `/auth?mode=forgot` | Visual, HE | Clear single-task recovery state. |
| `/reset-password` | Visual, no token | Error/recovery state is present and returns users to safe actions. |
| `/member/schedule` | Visual, HE/AR/EN | Correct localization when locale is set; useful guest explanation, but schedule content is below a large preamble and no language control is present. |
| `/privacy`, `/terms` | Visual, HE | Readable, calm surfaces; long-form navigation and language discoverability are weak. |
| `/support` | Visual, HE | Contact options are clear and phone/email values are directionally isolated. |
| `/payment-result` | Visual success/failure, HE | Excellent status differentiation and recovery actions; pending/cancelled states were static-only. |
| `/checkout` | Static + signed-out guard | Payment consent and methods exist in code; no payment submission was performed. |
| `/app` | Visual, HE/AR/EN | Best public marketing expression; strong real photography and editorial hierarchy. Cold LCP was 5.52 s. |
| `/download` | Visual, HE | Clear app-store action and version context; hardcoded RTL limits localization. |
| `/instagram` | Visual, HE | Distinctive editorial landing page; hardcoded RTL and local token palette fragment the system. |
| `/promo/yoga-lina` | Visual, HE | Clear limited-offer framing; gold microcopy and separate visual grammar require contrast/system review. |
| `/downalod` | Static redirect | Typo-preserving redirect is useful but should remain an alias only. |

### Member

`/member`, `/member/bookings`, `/member/packages`, `/member/account`, `/receipts/$id`, and class-detail/booking sheet states were inspected statically. Signed-out redirects were captured. Positive evidence includes clear state derivation in `PremiumClassCard`, a dedicated `ClassDetailSheet`, waitlist/full/available variants, bidi helpers, notification onboarding, and mobile bottom navigation. Visual sign-off is blocked until a safe role fixture exists.

Open questions requiring a safe session:

- Whether price, credits, eligibility, cancellation effect, and waitlist position are visible before confirmation.
- Whether double-tap/double-booking is prevented at the UI layer.
- Whether success/error toasts are announced and remain above fixed navigation.
- Whether offline, expired-session, and slow-query states preserve user input.
- Whether account deletion uses an explicit destructive confirmation and recovery window.

### Instructor

`/instructor` was inspected statically and its signed-out redirect was captured. The route exposes upcoming classes, attendance, and participant context in code. Empty/loading/error behavior and touch use were not visually verified.

### Admin

The full admin route tree was inventoried and statically reviewed. Shared page shells, headers, metric cards, tables, sheets, alert dialogs, class danger zone, attendance, payments, reports, and messaging tooling exist. The following require protected visual validation: desktop table density, 390 px table alternatives, dialog focus return, destructive class/member operations, permissions, long translations, and message-console performance. A nested `<main>` in `/admin/messages` is a verified static accessibility defect.

## RTL and localization findings

- `html[lang][dir]` is initialized server-side and updated client-side for `he`, `ar`, and `en`.
- Assistant is used for Hebrew/Latin UI, Noto Sans Arabic for Arabic, and Cormorant Garamond for brand/editorial Latin.
- Logical properties (`start`, `end`, `ps`, `pe`) are used extensively.
- Shared bidi utilities exist for mixed titles and LTR values; many times, codes, phone numbers, and emails use `dir="ltr"` or `dir="auto"`.
- Directional card overlays explicitly flip for LTR/RTL.
- Weaknesses: inconsistent locale entry points, hardcoded RTL public microsites, and Hebrew-only root error/not-found copy.
- Long translations rendered acceptably in the inspected auth/schedule/marketing captures. Protected navigation labels were not visually tested.

## Mobile findings

- 360×800, 390×844, 430×932, 768×1024, 1024×768, and 1440×900 were captured.
- No obvious horizontal overflow was visible on inspected public routes.
- Auth controls are comfortably sized and the background image remains legible under the overlay.
- Registration and guest schedule content require substantial scrolling before completion/content discovery.
- Fixed member bottom navigation includes safe-area handling in code; content-obscuration testing remains pending.
- Admin table/card transformations at 360–430 px remain unverified.

## Accessibility findings

Target: WCAG 2.2 AA.

Automated Lighthouse accessibility scored **100** on `/auth`, `/member/schedule`, and `/app?lang=en`. This does not cover keyboard quality, screen-reader comprehension, all states, or protected routes.

- Pass: document language/direction, form labels on auth, named icon buttons in shared primitives, skip link, landmarks on public routes, Radix dialog semantics/focus trapping, reduced-motion rules, 44 px control baseline.
- Fail/risk: insufficiently visible focus appearance; low-contrast gold microcopy; nested `main` on admin messages; some 40 px close buttons are below the 44 px target; status announcements and error associations need protected-flow testing.
- Not tested: VoiceOver/TalkBack output, 200% zoom on every route, high contrast mode, full dialog focus-return matrix, authentication timeouts, and real dynamic booking announcements.

## Performance findings

### Production-build output

- Global CSS: **392.15 KB / 59.97 KB gzip**.
- Main entry: **364.86 KB / 111.28 KB gzip**.
- Reports route: **401.09 KB / 104.52 KB gzip**.
- i18n bundle: **224.53 KB / 58.77 KB gzip**.
- Messages route: **124.94 KB / 34.37 KB gzip**.
- Largest local image emitted by the build: under 48 KB; image formats are predominantly WebP.

### Lab measurements

| Route | Lighthouse performance | Accessibility | FCP | LCP | CLS | TBT | Transfer |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/auth` | 72 | 100 | 4.11 s | 4.75 s | 0.070 | 0 ms | 546 KB |
| `/member/schedule` | 65 | 100 | 5.15 s | 5.93 s | 0.001 | 15.5 ms | 558 KB |
| `/app?lang=en` | 69 | 100 | 4.62 s | 5.26 s | 0.001 | 0 ms | 891 KB |

Warm local browser measurements were much faster: LCP 0.99 s on auth, 0.60 s on schedule, and 0.80 s on app marketing. The difference indicates cache/font/server-start sensitivity. INP was not reported because no representative interaction was captured; TBT was used only as a diagnostic and is not an INP substitute.

Priority actions: self-host/subset fonts, split translation dictionaries, keep large admin/report dependencies route-local, reduce global CSS, preload the auth/app hero intentionally, and establish CI budgets for CSS, initial JS, LCP, CLS, and interaction latency.

## Screenshot evidence

Thirty-two PNG captures are stored under `artifacts/ui-audit/before/`, organized by guest, member, instructor, admin, RTL, and responsive evidence. The protected-role images show permission-denied/sign-in redirects only; they are not evidence of authenticated visual inspection.

Key evidence:

- `artifacts/ui-audit/before/guest/guest-auth-he-390x844-default.png`
- `artifacts/ui-audit/before/guest/guest-auth-en-390x844-default.png`
- `artifacts/ui-audit/before/rtl/guest-auth-ar-390x844-default.png`
- `artifacts/ui-audit/before/rtl/guest-schedule-he-390x844-empty.png`
- `artifacts/ui-audit/before/rtl/guest-schedule-ar-390x844-empty.png`
- `artifacts/ui-audit/before/guest/guest-schedule-en-390x844-empty.png`
- `artifacts/ui-audit/before/guest/guest-payment-result-he-390x844-success.png`
- `artifacts/ui-audit/before/guest/guest-payment-result-he-390x844-error.png`
- `artifacts/ui-audit/before/responsive/guest-app-marketing-en-1440x900-default.png`
- `artifacts/ui-audit/before/guest/guest-auth-he-390x844-keyboard-focus.png`

Lighthouse JSON is stored at:

- `artifacts/ui-audit/lighthouse-auth.json`
- `artifacts/ui-audit/lighthouse-schedule.json`
- `artifacts/ui-audit/lighthouse-app-marketing.json`

## Risks and blockers

- No safe authenticated demo state was available; no accounts were created and no database mutation was attempted.
- Current working tree already contains user changes, including `src/styles.css`; audit work did not modify production code.
- Additional production files changed outside the audit while evidence was being gathered. The final build and Lighthouse run were repeated against the latest workspace; earlier screenshots span that active edit window.
- Lighthouse was local lab data, not field data. Hosting/CDN/server behavior may differ.
- Screen-reader and real-device assistive-technology tests were not executed.
- Current code contains extensive recent design work; static findings should be reconciled with the team’s active migration before implementation.

## Recommended first implementation phase

Start with **Foundation and tokens**, limited to semantic color/spacing/type/focus tokens plus automated contrast and bundle budgets. Do not begin route redesign until the focus treatment, gold text policy, locale shell, and visual fixture strategy are agreed. This produces the safest cross-product improvement and reduces risk for every later phase.

## Verification executed

- `bun run build`: pass on the final workspace; deprecation warnings remain for TanStack `inputValidator()` calls.
- `bun run lint`: pass with 0 errors and 757 existing warnings, mostly `no-explicit-any` and fast-refresh export warnings.
- Six targeted localization/public-entry test files: 17 tests passed, 0 failed.
- Lighthouse performance/accessibility: three public routes, JSON retained under `artifacts/ui-audit/`.
- Manual browser checks: route snapshots, language switching, keyboard tab focus, signed-out role guards, and six viewport sizes.
