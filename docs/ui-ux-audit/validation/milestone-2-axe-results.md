# Milestone 2 axe results

`@axe-core/playwright` ran after each selected state was settled. The complete machine-readable result is `milestone-2-automated-closure-results.json`.

| Route/state group | Language | Viewport | Critical | Serious | Moderate | Minor | Result | Notes |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| Packages, payment summary/loading/error, account, deletion dialog/loading/success/error | EN | 390 × 844 | 0 | 0 | 0 | 0 | Pass | Nine states |
| Same critical state set | EN | 1440 × 900 | 0 | 0 | 0 | 0 | Pass | Nine states |
| Same critical state set | AR | 320 × 720 | 0 | 0 | 0 | 0 | Pass | Nine RTL states |
| Same critical state set | AR | 1440 × 900 | 0 | 0 | 0 | 0 | Pass | Nine RTL states |

Total: 36 scans, zero critical, serious, moderate, or minor violations. A serious contrast failure initially exposed the muted package-status eyebrow at 4.43:1; the semantic text color was corrected and the entire matrix reran cleanly. Axe supplements but does not replace keyboard, zoom, or VoiceOver testing.
