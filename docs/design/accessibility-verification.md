# Accessibility verification

**Audit date:** 2026-08-29

**Fixture:** isolated Task 13 production-presentation harness; no external services or mutations

**Automated artifact:** `docs/design/evidence/task-15-interaction-results.json`

**Artifact generatedAt:** `2026-08-30T16:26:14.275Z`

**Artifact SHA-256:** `298b10efc8634d82952c627dae2bb7d8ed706412ad644a48b2cea38ac0c6d399`

**Forced-colors targets:** `1033/1033`

**Forced-colors focus deltas:** `198/198`

**Representative latency (ms):** `dialog=16.7; schedule=7.9; table=5.7`

**VoiceOver transcript SHA-256:** `65f58e170262196b92f08cd34101eb6af43b0df672e3d1373c00655c1938522e`

## Result

Playwright recorded 48/48 tier-A scenario/locale rows without failures. It traversed all 198 enabled tabbables in computed focus order, recorded an activation result or typed not-applicable reason for each, and checked visible focus for every reached control. The run inspected transition, animation, scroll, `::before`, and `::after` styles across 2,833 elements plus 5,666 pseudos. Forced-color target and focus-delta totals are reported only in the mechanically checked metadata above; coverage includes ordinary headings and body text. The 200% and 400% equivalent reflow checks ran against every production presentation registered by Task 13. Escape, focus trapping, and focus return were exercised on the production `AdminDestructiveAction` dialog in the same isolated fixture.

Representative-flow measurements are reported only in the mechanically checked latency metadata above. All are below the 200 ms budget. The schedule result is rendered by the same `filterScheduleClasses` function used by the production member schedule over deterministic class records, rather than a synthetic counter.

The same artifact records 21/21 automated assistive-technology fixture-semantic checks: all seven manual journeys in HE/AR/EN expose the requested document language and direction, localized headings and control names, applicable live-region/status semantics, and no cross-language catalog leakage. Booking and cancellation additionally exercise their local success outcomes, and both cancellation dialogs are opened and checked. These automated checks are distinct from the parent operator’s manual VoiceOver results recorded below.

A `not-applicable` result means the captured presentation exposes no enabled control for that check, or the behavior belongs to the representative dialog/filter flow rather than that static state. It is a recorded disposition, not a pass claim.

## Automated tier-A evidence

The supported interaction regeneration command is `bun run ui-audit:interactions`. The package
script supplies Bun's `.webp=file` loader because the production-backed fixtures import product
imagery.

| Scope  | Scenario                                    | Language | Keyboard       | Activation     | Escape         | Focus          | 200% | 400% | Reduced motion | Forced colors | Latency        | Artifact                                                                                             |
| ------ | ------------------------------------------- | -------- | -------------- | -------------- | -------------- | -------------- | ---- | ---- | -------------- | ------------- | -------------- | ---------------------------------------------------------------------------------------------------- |
| tier-a | guest-app-default | ar | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-app-default/ar |
| tier-a | guest-app-default | en | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-app-default/en |
| tier-a | guest-app-default | he | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-app-default/he |
| tier-a | guest-auth-default | ar | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-auth-default/ar |
| tier-a | guest-auth-default | en | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-auth-default/en |
| tier-a | guest-auth-default | he | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-auth-default/he |
| tier-a | guest-auth-mode-forgot-default | ar | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-auth-mode-forgot-default/ar |
| tier-a | guest-auth-mode-forgot-default | en | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-auth-mode-forgot-default/en |
| tier-a | guest-auth-mode-forgot-default | he | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-auth-mode-forgot-default/he |
| tier-a | guest-auth-mode-signup-default | ar | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-auth-mode-signup-default/ar |
| tier-a | guest-auth-mode-signup-default | en | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-auth-mode-signup-default/en |
| tier-a | guest-auth-mode-signup-default | he | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-auth-mode-signup-default/he |
| tier-a | guest-auth-mode-signup-disabled | ar | not-applicable | not-applicable | not-applicable | not-applicable | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-auth-mode-signup-disabled/ar |
| tier-a | guest-auth-mode-signup-disabled | en | not-applicable | not-applicable | not-applicable | not-applicable | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-auth-mode-signup-disabled/en |
| tier-a | guest-auth-mode-signup-disabled | he | not-applicable | not-applicable | not-applicable | not-applicable | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-auth-mode-signup-disabled/he |
| tier-a | guest-download-default | ar | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-download-default/ar |
| tier-a | guest-download-default | en | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-download-default/en |
| tier-a | guest-download-default | he | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-download-default/he |
| tier-a | guest-instagram-default | ar | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-instagram-default/ar |
| tier-a | guest-instagram-default | en | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-instagram-default/en |
| tier-a | guest-instagram-default | he | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-instagram-default/he |
| tier-a | guest-member-schedule-default | ar | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-member-schedule-default/ar |
| tier-a | guest-member-schedule-default | en | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-member-schedule-default/en |
| tier-a | guest-member-schedule-default | he | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-member-schedule-default/he |
| tier-a | guest-member-schedule-empty | ar | not-applicable | not-applicable | not-applicable | not-applicable | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-member-schedule-empty/ar |
| tier-a | guest-member-schedule-empty | en | not-applicable | not-applicable | not-applicable | not-applicable | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-member-schedule-empty/en |
| tier-a | guest-member-schedule-empty | he | not-applicable | not-applicable | not-applicable | not-applicable | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-member-schedule-empty/he |
| tier-a | guest-payment-result-status-failed-error | ar | not-applicable | not-applicable | not-applicable | not-applicable | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-payment-result-status-failed-error/ar |
| tier-a | guest-payment-result-status-failed-error | en | not-applicable | not-applicable | not-applicable | not-applicable | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-payment-result-status-failed-error/en |
| tier-a | guest-payment-result-status-failed-error | he | not-applicable | not-applicable | not-applicable | not-applicable | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-payment-result-status-failed-error/he |
| tier-a | guest-payment-result-status-success-success | ar | not-applicable | not-applicable | not-applicable | not-applicable | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-payment-result-status-success-success/ar |
| tier-a | guest-payment-result-status-success-success | en | not-applicable | not-applicable | not-applicable | not-applicable | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-payment-result-status-success-success/en |
| tier-a | guest-payment-result-status-success-success | he | not-applicable | not-applicable | not-applicable | not-applicable | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-payment-result-status-success-success/he |
| tier-a | guest-privacy-default | ar | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-privacy-default/ar |
| tier-a | guest-privacy-default | en | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-privacy-default/en |
| tier-a | guest-privacy-default | he | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-privacy-default/he |
| tier-a | guest-promo-yoga-lina-default | ar | not-applicable | not-applicable | not-applicable | not-applicable | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-promo-yoga-lina-default/ar |
| tier-a | guest-promo-yoga-lina-default | en | not-applicable | not-applicable | not-applicable | not-applicable | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-promo-yoga-lina-default/en |
| tier-a | guest-promo-yoga-lina-default | he | not-applicable | not-applicable | not-applicable | not-applicable | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-promo-yoga-lina-default/he |
| tier-a | guest-reset-password-error | ar | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-reset-password-error/ar |
| tier-a | guest-reset-password-error | en | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-reset-password-error/en |
| tier-a | guest-reset-password-error | he | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-reset-password-error/he |
| tier-a | guest-support-default | ar | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-support-default/ar |
| tier-a | guest-support-default | en | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-support-default/en |
| tier-a | guest-support-default | he | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-support-default/he |
| tier-a | guest-terms-default | ar | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-terms-default/ar |
| tier-a | guest-terms-default | en | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-terms-default/en |
| tier-a | guest-terms-default | he | pass | pass | not-applicable | pass | pass | pass | pass | pass | not-applicable | docs/design/evidence/task-15-interaction-results.json#guest-terms-default/he |

## Manual VoiceOver evidence

The parent operator manually completed all 21 canonical journeys in Brave on macOS with VoiceOver enabled. The implementer did not independently operate VoiceOver; the exact observations, environment, safe localhost targets, and operator attribution are preserved in the linked transcript.

| Journey                        | Language | Status | Recording or transcript                                                                |
| ------------------------------ | -------- | ------ | -------------------------------------------------------------------------------------- |
| auth                           | he       | pass   | docs/design/evidence/task-15-voiceover-transcript.md#auth-he                           |
| auth                           | ar       | pass   | docs/design/evidence/task-15-voiceover-transcript.md#auth-ar                           |
| auth                           | en       | pass   | docs/design/evidence/task-15-voiceover-transcript.md#auth-en                           |
| booking                        | he       | pass   | docs/design/evidence/task-15-voiceover-transcript.md#booking-he                        |
| booking                        | ar       | pass   | docs/design/evidence/task-15-voiceover-transcript.md#booking-ar                        |
| booking                        | en       | pass   | docs/design/evidence/task-15-voiceover-transcript.md#booking-en                        |
| cancellation                   | he       | pass   | docs/design/evidence/task-15-voiceover-transcript.md#cancellation-he                   |
| cancellation                   | ar       | pass   | docs/design/evidence/task-15-voiceover-transcript.md#cancellation-ar                   |
| cancellation                   | en       | pass   | docs/design/evidence/task-15-voiceover-transcript.md#cancellation-en                   |
| payment-result                 | he       | pass   | docs/design/evidence/task-15-voiceover-transcript.md#payment-result-he                 |
| payment-result                 | ar       | pass   | docs/design/evidence/task-15-voiceover-transcript.md#payment-result-ar                 |
| payment-result                 | en       | pass   | docs/design/evidence/task-15-voiceover-transcript.md#payment-result-en                 |
| instructor-attendance          | he       | pass   | docs/design/evidence/task-15-voiceover-transcript.md#instructor-attendance-he          |
| instructor-attendance          | ar       | pass   | docs/design/evidence/task-15-voiceover-transcript.md#instructor-attendance-ar          |
| instructor-attendance          | en       | pass   | docs/design/evidence/task-15-voiceover-transcript.md#instructor-attendance-en          |
| admin-destructive-confirmation | he       | pass   | docs/design/evidence/task-15-voiceover-transcript.md#admin-destructive-confirmation-he |
| admin-destructive-confirmation | ar       | pass   | docs/design/evidence/task-15-voiceover-transcript.md#admin-destructive-confirmation-ar |
| admin-destructive-confirmation | en       | pass   | docs/design/evidence/task-15-voiceover-transcript.md#admin-destructive-confirmation-en |
| global-navigation              | he       | pass   | docs/design/evidence/task-15-voiceover-transcript.md#global-navigation-he              |
| global-navigation              | ar       | pass   | docs/design/evidence/task-15-voiceover-transcript.md#global-navigation-ar              |
| global-navigation              | en       | pass   | docs/design/evidence/task-15-voiceover-transcript.md#global-navigation-en              |

### Direct manual journey targets

Run `bun run ui-audit:dev`, append the target below to the fixture origin, and replace
`{lang}` with `he`, `ar`, or `en`. Booking and cancellation are separate local-state
journeys. Their handlers update only the rendered fixture; they never call a service or
mutation.

| Journey                        | Target                                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| auth                           | `/?scenario=guest-auth-default&language={lang}&evidence=1`                                                                 |
| booking                        | `/?scenario=guest-member-schedule-default&language={lang}&evidence=1&interaction=1&journey=booking`                        |
| cancellation                   | `/?scenario=guest-member-schedule-default&language={lang}&evidence=1&interaction=1&journey=cancellation`                   |
| payment-result                 | `/?scenario=guest-payment-result-status-success-success&language={lang}&evidence=1`                                        |
| instructor-attendance          | `/?scenario=guest-member-schedule-default&language={lang}&evidence=1&interaction=1&journey=instructor-attendance`          |
| admin-destructive-confirmation | `/?scenario=guest-member-schedule-default&language={lang}&evidence=1&interaction=1&journey=admin-destructive-confirmation` |
| global-navigation              | `/?scenario=guest-app-default&language={lang}&evidence=1`                                                                  |

## Focus surface coverage

The automated rows collectively exercised white, ivory, sand, navy, and image-backed surfaces. Focus uses computed browser styles rather than class-name assumptions. The image-backed check focuses the real app-marketing brand link over `/images/textures/ivory-paper.svg`; its computed opaque 6 px ivory halo isolates the 5.60:1 outline from worst-case image pixels. The app-marketing pass changed its low-contrast gold-on-ivory ring to the semantic blue ring with that opaque halo, plus an ivory-on-navy override for the final CTA.

## Reflow and responsive method

The 200% and 400% checks use 640 and 320 CSS-pixel layouts, respectively, as the reflow-equivalent widths for a 1280 CSS-pixel desktop viewport. Each check waits for fonts and two animation frames, then rejects document-level horizontal overflow beyond one CSS pixel. The first red run found support contact cards wider than the 320 px viewport; the product cards now use shrinkable flex/grid children and an email break opportunity.

## Scope boundary

Authenticated mutation journeys remain blocked in the Task 13 matrix. The interaction lab now provides separate safe booking and cancellation presentation journeys: booking composes the production lesson card and booking action panel, while cancellation reuses the pure `MemberCancellationDialog` extracted from the production bookings route. Instructor and admin targets likewise compose their production presentation components. None claims authenticated end-to-end behavior or calls a mutation.
