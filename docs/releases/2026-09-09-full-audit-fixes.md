# Cloud & Core — audit corrections, 9 September 2026

This candidate reconciles the already deployed presentation with main and implements the nine findings from the completed audit. The approved board remains a qualitative aesthetic reference, not a measured viewport or automatic approval. Original logo artwork and backend business behavior are preserved.

## Finding to fix

| Finding | Correction and remaining limit |
|---|---|
| F01 | Member detail failure now offers localized retry; missing-member and loading states are distinct. |
| F02 | Split entry, staff and member styles; defer marketing UI imports; remove obsolete hero preload; right-size original logos. Median mobile lab LCP improved from 4.51 to 3.53 s on auth and 4.06 to 3.53 s on the public page. The 2.5 s target remains unmet. |
| F03 | Compact guest introduction, date/filter spacing and lesson rows. Actions sit beside lesson metadata when space permits; narrow layouts retain wrapping. |
| F04 | Package expiry dates use language-aware bidi isolation; numeric identifiers remain LTR. |
| F05 | Localize admin member details, actions, feedback and automation headings in Hebrew, Arabic and English. |
| F06 | Move the settings campaign block into a labeled, closed-by-default disclosure; preserve every control. |
| F07 | Give empty payments a short title and one explanation. |
| F08 | Remove obsolete Heebo font faces and Assistant/IBM fallbacks from member roles while preserving the intended language families. |
| F09 | Tighten home next-class and supporting sections; preserve the existing hero separation. |

## Verification

- `bun install --frozen-lockfile`: PASS.
- `bun run build`: PASS.
- `bun run lint`: PASS, 0 errors and 856 existing warnings.
- Unit suite: 1,200 pass / 84 fail; deployed baseline: 1,197 pass / 88 fail. No new failing test names. Remaining failures include legacy styling/translation snapshots and existing contract checks. Differences in native tests are not native fixes.
- Typecheck: 62 diagnostics, matching the baseline with no new diagnostic signatures. NOT a clean typecheck.
- Browser route matrix: 302 cases (196 primary, 92 secondary, 14 aliases), no detected browser errors, automated accessibility violations or horizontal overflow.
- Additional responsive checks: 15 cases. Recovery/localized state checks: 18. Dialogs, permissions and local transactional fixtures: 48. Date/locale/text enlargement behavior: 12. All passed.
- Navigation: 30 transitions across Hebrew, Arabic and English, light/dark, under 4x CPU throttling; no stuck navigation. This is not field INP.
- Cached lessons remain visible after an injected refresh failure; retry restores fresh data. No native lifecycle guarantee is inferred.
- Final entry CSS: auth 249,373 bytes raw / 39,249 gzip; marketing 227,340 raw / 35,490 gzip. Baseline shared entry was 570,200 raw / 83,152 gzip. Full-app foundation imports preserve the original CSS rules in the original order (only boundary whitespace is normalized).
- Final Lighthouse medians (three runs per page): auth performance 82 / LCP 3.53 s; public performance 85 / LCP 3.53 s. TBT 0 ms, accessibility 100. Local simulated measurements, not production field data.
- Compared 97 protected backend/runtime files against the deployed candidate: zero changes.

## Coverage and limits

Primary rendering covers the actual public, auth/recovery, member, admin and instructor route inventory in Hebrew at 390×844 and 1440×900, both appearances. Representative Arabic and English routes were checked in both appearances and widths. Alias routes, narrow/tablet/landscape cases, 200% text, keyboard focus/trapping/restoration, dialogs, image/font loading, theme initialization and saved preferences were included. See the linked JSON matrices for exact combinations; not every language/state/viewport permutation was tested.

All authenticated evidence uses sanitized local fixtures. Booking and management actions used intercepted fixture responses, never production writes.

NOT TESTED: real authenticated backend integration; live bookings, payments, cancellations, notifications, account changes or reset emails; VoiceOver on a physical device; every manual WCAG contrast judgment; production field INP/Core Web Vitals; every native background-resume interval; a new TestFlight/App Store binary. This web release does not distribute the separate native launch correction.

Visual differences from the approved concept remain subject to owner review. Functional checks do not establish aesthetic approval.
