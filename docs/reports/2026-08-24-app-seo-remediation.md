# Cloud & Core `/app` SEO remediation report

- Date: 2026-08-24
- Branch: `codex/app-seo-remediation`
- Worktree: `.worktrees/codex-app-marketing-release`
- Base / merge-base with `origin/main`: `5d01e03` (`feat: launch multilingual app marketing page (#18)`)
- Implementation head before this report: `98d15a0`

## Release boundary

This work is isolated on `codex/app-seo-remediation`. It has not been merged, pushed, deployed, or enabled in production. No database migration was added or applied. The six Yoga-with-Lina commits currently on `origin/main` are not part of this branch's remediation diff, and the dirty `feature/yoga-lina-launch-promo` checkout was not modified.

At report time the branch is 37 commits ahead of and 6 commits behind `origin/main`, including this documentation commit. Any later integration must first reconcile the six Yoga-with-Lina commits through a separately authorized review. This report does not authorize that integration.

## Requested outcomes

1. **Public SSR routes:** `/app/ar`, `/app/he`, and `/app/en` are explicit public file routes with localized server-rendered content. `/app` is a temporary locale resolver rather than a canonical content page.
2. **Language and direction:** each localized route emits the correct `lang` and `dir`; Arabic and Hebrew are RTL, English is LTR.
3. **Crawlable language links:** the rendered language selector uses ordinary localized anchors.
4. **Canonical and hreflang:** each page has a self-referencing canonical plus reciprocal `ar`, `he`, `en`, and `x-default` alternates.
5. **Localized search/social content:** title, description, Open Graph, Twitter metadata, and the visible H1 are localized.
6. **Generic image removal:** the marketing capture provenance no longer uses the generic aerial-yoga woman image. Authentic studio photography is used instead.
7. **Distinct positive screenshots:** duplicate and negative-state booking captures were regenerated for all three languages; the deterministic manifest binds the reviewed images to their hashes.
8. **Apple presentation:** unmodified official localized App Store badges are used, with intrinsic dimensions, plus the iOS Smart App Banner metadata.
9. **Separate CTAs:** schedule browsing, App Store installation, account creation, and existing-member sign-in are distinct crawlable actions.
10. **Structured data:** server-rendered JSON-LD includes `HealthClub` (a `LocalBusiness` subtype), `SoftwareApplication`, and only the visible verified FAQ entries. No invented ratings, reviews, instructors, or social proof are emitted.
11. **Indexing:** localized canonical URLs are in `sitemap.xml`; the public app pages and assets are allowed by `robots.txt`; public responses are indexable while the legacy platform/auth bridge remains `noindex`.
12. **Safe root routing:** authenticated visitors retain role-aware homes; explicitly marked native unauthenticated visitors go to `/auth`; ordinary unauthenticated browsers go to the best localized marketing route. Public marketing routes do not initialize or load native lifecycle, required-update, Supabase auth/realtime, admin-push, or member-device bootstraps.
13. **Analytics and attribution:** page view, language, App Store, schedule, create-account, login, maps, support, and configured social/contact actions emit privacy-filtered semantic events. Approved UTM parameters survive root routing, CTA navigation, and the schedule-to-auth handoff.
14. **Responsive QA:** 42 Arabic, Hebrew, and English captures cover 390×844 and 1440×900 full pages plus hero, gallery, class, FAQ, location, and final-CTA sections.
15. **Verification:** results and known repository baselines are recorded below without fabricating unavailable Lighthouse data.

## Verification results

| Check                                | Result                                                                                                                                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun install --frozen-lockfile`      | PASS — 525 installs / 596 packages; lockfile unchanged                                                                                                                                                                                                  |
| Focused remediation regression suite | PASS — 60 tests, 0 failures, 341 assertions                                                                                                                                                                                                             |
| Full `bun run test`                  | PASS — 669 passed, 3 environment-gated database integration tests skipped, 0 failed, 5,342 assertions across 110 files                                                                                                                                  |
| Capture security/reproducibility     | PASS — loopback HTTP/WebSocket/service-worker boundaries, two independent fixture/browser processes, exact asset hashes, invalid-state rejection, and production-capture refusal                                                                        |
| Focused analytics TypeScript config  | PASS — `bunx tsc -p tests/types/tsconfig.app-marketing-analytics.json --noEmit`                                                                                                                                                                         |
| Changed-file Prettier check          | PASS                                                                                                                                                                                                                                                    |
| `git diff --check`                   | PASS                                                                                                                                                                                                                                                    |
| `bun run lint`                       | PASS — 0 errors; 752 warnings remain in the repository warning baseline                                                                                                                                                                                 |
| `bun run build`                      | PASS — client and SSR production bundles completed                                                                                                                                                                                                      |
| Playwright SEO/QA harness            | PASS — raw SSR metadata/JSON-LD, redirect precedence, malformed auth cookie handling, analytics, real signup-form navigation, UTM continuation, loaded-script auth-client isolation, accessibility, reduced motion, and seven responsive viewport cases |
| Global `bunx tsc --noEmit`           | BASELINE FAIL — unrelated existing admin, concierge, member, messaging, and payment typing errors; the remediation-specific typecheck passes                                                                                                            |
| Global `bunx prettier --check .`     | BASELINE FAIL — 125 existing files outside this remediation are not formatted; every changed supported file passes                                                                                                                                      |
| Lighthouse                           | NOT AVAILABLE — no local Lighthouse executable was installed, so no score or Web Vitals were claimed                                                                                                                                                    |

The three skipped full-suite tests require configured database integration infrastructure and were skipped by their existing guards; they were not converted to passes.

## QA evidence

The local evidence directory is `tmp/app-seo-remediation-qa/` and contains:

- `qa-summary.md` and `qa-summary.json`
- 42 responsive QA PNGs across all three locales
- mobile and desktop full-page captures
- focused hero, showcase, class, FAQ, location, and final-CTA captures

Manual inspection passed for RTL/LTR direction, readable localized text, authentic imagery, distinct positive-state screenshots, CTA hierarchy, spacing, image loading, clipping, overlap, and horizontal overflow.

## Commits

The remediation consists of these ordered commits after the merge-base:

```text
72828d3 docs: design app SEO remediation
210fb6a docs: plan app SEO remediation
6a04d50 feat: define localized app marketing SEO contract
295bd2c fix: complete app marketing SEO contract
9469322 fix: resolve final marketing contract type gaps
ee2d9f0 test: harden app marketing SEO inputs
fc35b1c fix: respect explicit locale exclusions
898ff71 fix: rank wildcard locale candidates
08165d3 fix: rank duplicate language ranges
855c6a1 feat: add public localized app SSR routes
e356538 fix: preserve localized app route context
b0a7a6d fix: preserve app route configuration
5c393e4 fix: resolve app store configuration server side
5fe3e42 feat: route native and browser root visits safely
2eb1921 fix: preserve native webview navigation
9a88f8f feat: complete authentic localized app landing content
c28e87b fix: complete app landing trust and location
4bd27ed fix: surface canonical studio address
eeed23e fix: improve app landing interaction clarity
58e536e fix: use valid app badge dimensions
e68bd3e feat: track app landing conversions safely
08d1f67 fix: harden app landing analytics privacy
6558ae6 fix: reject identifier shaped analytics values
21bf41d fix: make app analytics payloads immutable
ddbe6f2 fix: enforce plain analytics campaign labels
f951289 feat: generate privacy-safe localized app captures
8b569f6 fix: remove real identities from marketing captures
2e6bce6 fix: make marketing capture reproducible
b5f2e65 test: verify capture service worker isolation
82437a8 fix: stabilize capture across browser processes
d25c270 feat: expose public app sitemap and robots policy
c8378df fix: serve indexing metadata for head requests
05cb7c4 refactor: centralize public indexing metadata
9ec8dac test: verify app SEO remediation end to end
c3ad60e fix: close final app SEO review gaps
98d15a0 fix: isolate public app auth bootstraps
```

## Integration note

Keep this branch and worktree intact. If integration is authorized later, review/rebase it against the then-current `origin/main`, rerun the full checks, and deploy through the normal release workflow. Do not apply either Yoga-with-Lina or unrelated database migrations as part of this SEO remediation.
