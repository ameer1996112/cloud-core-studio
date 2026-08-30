# Task 15 Report — Accessibility, responsive, and localization verification

## Outcome and scope

Task 15 adds a fail-closed accessibility evidence contract, browser-backed interaction
checks, and a capture-by-capture visual inspection ledger over the Task 13 production
presentation harness. The harness remains isolated: its destructive confirmation callback
resolves locally, and no Supabase client, service module, mutation, or real external data is
used.

Automated evidence is complete. Manual VoiceOver evidence is not complete and is not
claimed: all 21 required journey/language rows remain `pending-manual` for the parent
operator because VoiceOver was not operated during this implementation session.

## TDD record and failures fixed

The evidence test was created before its parser and documents. Its first run failed with
`Cannot find module '../../tools/ui-audit/accessibility-evidence'`; after adding the parser,
it remained red until both evidence documents existed. The focus-surface completeness test
was also observed red when the sand record was absent, then green only after the browser
artifact explicitly contained all five named surfaces.

The first browser run exposed two product defects:

- Support contact cards overflowed the 320 CSS-pixel (400% reflow-equivalent) layout in
  HE/AR/EN. Shrinkable grid/flex children and a safe email break opportunity removed the
  overflow.
- The app-marketing gold focus ring lacked 3:1 non-text contrast on the ivory surface. It
  now uses the semantic blue focus color with a white halo and an ivory-on-navy final-CTA
  override.

The regression checks then passed at 640 and 320 CSS pixels and on white, ivory, sand,
navy, and image-backed surfaces.

## Automated evidence

- Interaction matrix: 48/48 tier-A scenario/locale rows passed with no recorded failure.
- Keyboard/dialog: Tab traversal, native Enter/Space activation, Escape dismissal,
  forward/backward focus trap, and trigger focus return passed.
- Focus surfaces: 5/5 passed at a 3 px outline; computed contrast was white 5.69:1,
  ivory 5.60:1, sand 4.31:1, navy 9.49:1, and image-backed 9.49:1.
- Reflow: 48/48 passed at 640 CSS px (200% equivalent) and 48/48 at 320 CSS px
  (400% equivalent), allowing at most one CSS pixel of subpixel tolerance.
- Media preferences: reduced-motion and forced-colors checks recorded for all 48 rows;
  states without an enabled control are explicitly `not-applicable`, not asserted as pass.
- Representative latency: dialog 13.9 ms, schedule filtering 1.2 ms, table filtering
  3.7 ms; 3/3 are below 200 ms.
- Manifest: 319 scenarios valid.
- Axe: 288/288 scans completed, 18 total moderate landmark reports retained from the
  fixture matrix, 0 serious/critical violations.
- Evidence unit test: 8 passed, 0 failed.
- Focused Task 15/support/manifest suite: 21 passed, 0 failed.
- Repository unit/integration suite: 955 passed, 6 environment-gated skips, 0 failed
  across 142 files.
- Lint: exit 0, 0 errors with `--quiet`.
- Production build: exit 0; existing TanStack `inputValidator()` deprecation output remains.

The machine-readable interaction artifact is
`artifacts/ui-audit/current/interaction-results.json`. Generated current artifacts remain
ignored build output; the committed evidence tables and completeness test preserve the
required coverage contract.

## Visual inspection

All 288 Task 13 captures were regenerated after the product fixes and inspected in 16
route/state contact sheets, each containing the 18 HE/AR/EN × six-viewport variants. Every
artifact has an explicit row in `docs/design/visual-regression-results.md` covering:

- hierarchy;
- clipping;
- safe areas;
- logical alignment;
- locale expansion;
- overlays;
- state clarity;
- final disposition.

The final ledger records 288 accepted dispositions and zero unresolved failures. The
support 320 px overflow and app-marketing focus discrepancy are logged with their original
current-artifact pattern, corrected artifact pattern, and disposition. `/download` and
`/instagram` preserve their expected Hebrew/bilingual presentation from the route-state
matrix and are not treated as untranslated locale claims.

## Manual evidence still required

VoiceOver remains pending for these seven journeys in each of HE, AR, and EN (21 rows):

1. auth;
2. booking;
3. cancellation;
4. payment result;
5. instructor attendance;
6. admin destructive confirmation;
7. global navigation.

Each row requires a recording or transcript artifact before it can be changed to `pass`.
Axe and Playwright results are not substituted for assistive-technology operation.

## Repository boundary

`progress.md` was not modified. No backend, schema, role, booking, payment, or production
data behavior changed. No environment file was read, written, staged, or committed.

## Independent review fix round 1 — 2026-08-29

This section supersedes the automation paths, counts, and measurements above where they
differ. All six review findings were closed with fail-closed tests and regenerated browser
evidence.

1. The committed schema-v2 interaction artifact is now
   `docs/design/evidence/task-15-interaction-results.json`. The evidence validator requires
   the exact 48 canonical scenario/language keys, check-specific status vocabularies,
   typed not-applicable reasons, exact table-to-artifact status and anchor correlation,
   source SHA-256 freshness, artifact SHA-256 identity, and matching `generatedAt`. Tests
   reject fabricated, duplicate, missing, extra, blanket-status, stale-hash, and
   stale-timestamp evidence.
2. Keyboard verification traverses every enabled DOM tabbable in canonical tab order with
   no control cap: 156/156 controls were reached and focus-checked. Activation evidence
   also covers 156/156 controls. Buttons and links use Enter/Space as applicable and assert
   intended DOM, state, form-validation, or URL effects; static fields and controls retain
   explicit typed not-applicable reasons. Dialog Enter/Space, Escape, forward/reverse focus
   trap, and trigger focus return passed.
3. Reduced-motion inspection covered every one of 2,487 rendered elements and both
   pseudos for each (4,974 pseudo inspections), including animation, transition,
   iteration, and smooth-scroll behavior. Forced-colors inspection covered all 282
   governed focusable/control/content targets, not a first match.
4. Schedule latency now renders and filters representative deterministic class records
   through the production `filterScheduleClasses` function extracted from
   `member.schedule.tsx`; it is not a synthetic counter. Final measured flows were dialog
   16.4 ms, production schedule filtering 1.7 ms, and table filtering 6.6 ms, all below
   200 ms.
5. Image focus evidence targets the real app-marketing brand link over
   `/images/textures/ivory-paper.svg`. The final 3 px blue indicator is isolated from the
   image pixels by a computed opaque 6 px ivory halo and measures 5.60:1 against that
   backing. White, ivory, sand, navy, and image-backed surfaces all pass (5.69, 5.60,
   4.31, 9.49, and 5.60:1).
6. The discrepancy ledger now covers both failures with reproducible artifacts. Before
   evidence was rendered from exact prior revision
   `0b2d63ca9acee404b58b931453f0bbfa4ea7fae3` into
   `docs/design/evidence/task-15-before-0b2d63c/`; corrected evidence is in
   `docs/design/evidence/task-15-after/`. Its measurements and screenshot hashes prove
   support overflow changed from 63 px to 0 px in HE/AR/EN and image focus changed from a
   2.04:1 gold outline without backing to the 5.60:1 backed blue indicator. The evidence
   completeness test recomputes every retained screenshot SHA-256.

Final verification for this round:

- Interaction checks: 48/48 canonical scenario/language rows passed, with 156/156
  keyboard, focus, and activation records.
- Reflow: 48/48 at 200% and 48/48 at 400%; reduced motion 48/48; forced-colors 48/48.
- Capture: 288/288 screenshots regenerated; the existing systematic ledger retains
  288 accepted dispositions and 0 unresolved failures.
- Axe: 288/288 scans, 0 serious/critical violations.
- Manifest: 319 route-state scenarios valid.
- Evidence test: 12 passed, 0 failed.
- Focused evidence/manifest/support suite: 25 passed, 0 failed, 1,113 assertions.
- Repository unit/integration suite: 959 passed, 6 environment-gated skips, 0 failed,
  11,566 assertions across 142 files.
- Lint: exit 0, 0 errors and 747 pre-existing warnings.
- Production build: exit 0; existing TanStack deprecation output remains.

VoiceOver was not operated in this fix round. The same 21 auth, booking, cancellation,
payment-result, instructor-attendance, admin-destructive-confirmation, and
global-navigation rows across HE/AR/EN remain honestly `pending-manual` for the parent
operator. `progress.md` remains untouched, and the production-backed harness performs no
real external mutation.

## VoiceOver-driven fix round 2 — 2026-08-30

The parent operator's actual macOS VoiceOver run exposed mixed-English copy in the Hebrew
fixture and an English `Class schedule` H1 in the Hebrew/Arabic schedule adapter. This
round localizes the fixture title, program label, destructive confirmation, attendance
heading/filter/caption/columns/statuses, focus-surface labels, and the schedule H1 through
typed HE/AR/EN contracts. Fixture documents and roots now carry the requested `lang` and
logical `dir`; English deliberately retains `Class schedule`.

Booking and cancellation are now separate directly addressable journeys rather than
audit-only clones. Booking composes the production lesson reservation card and
`BookingActionPanel`. Cancellation composes a pure `MemberCancellationDialog` extracted
from the real member bookings route; that route now uses the same component without
changing its mutation or view-state behavior. Audit handlers are deterministic local
state only and never call a service or mutation. Direct targets for all seven journeys
are recorded in `docs/design/accessibility-verification.md`.

TDD red/green evidence for this round:

- the schedule regression first failed on the hard-coded English H1 in HE, then on the
  unintended generic English `Schedule`, and passed only with exact HE/AR localization
  while preserving `Class schedule` in EN;
- the shared fixture catalog test first failed on the reported English leakage;
- the booking/cancellation test first failed while both were collapsed into the generic
  fixture, then passed after adding distinct production-backed journeys;
- the evidence test failed on the non-reproducible after-revision label and passed with
  exact source revision `fe455d4a1937cab5d472e58d1a157f5ede22dc83`;
- the final focused run exposed that the direct-target documentation table was being
  parsed as manual VoiceOver evidence. The parser now accepts only exact four-column
  journey/language/status/artifact rows and rejects invalid evidence without confusing
  adjacent tables.

Automated assistive-technology fixture checks now exercise all 7 journeys in HE/AR/EN:
21/21 passed with exact document locale/direction, H1, accessible control names,
applicable live status, dialog/outcome behavior, and cross-language leakage rejection.
Global navigation additionally checks the localized language-selection group name. These
are browser semantic checks that establish a stable surface for the operator; they are
not VoiceOver evidence and did not alter any manual status row.

Final verification for this round:

- Interaction checks: 48/48 canonical scenario/language rows and 21/21 localized journey
  semantic rows passed; artifact errors: 0.
- Representative latency: dialog 20.3 ms, production schedule filtering 2.5 ms, and
  table filtering 3.2 ms; all 3/3 remain below 200 ms.
- Capture: 288/288 deterministic screenshots regenerated after the schedule heading
  change; the systematic ledger retains 288 accepted dispositions and 0 unresolved
  failures.
- Axe: 288/288 scans passed with 0 serious/critical violations.
- Manifest: 319 route-state scenarios valid.
- Focused evidence/journey/manifest/booking/support suite: 58 passed, 0 failed, 1,400
  assertions across 5 files.
- Repository unit/integration suite: 964 passed, 6 environment-gated skips, 0 failed,
  11,805 assertions across 143 files.
- Lint: exit 0, 0 errors and 748 pre-existing warnings.
- Production build: exit 0; existing TanStack deprecation output remains.

VoiceOver was not operated by this implementer. Manual rows remain unchanged for the
parent operator to update only from their recordings/transcripts. `progress.md` remains
untouched, and no real external data was mutated.

## Independent review fix round 3 — 2026-08-30

This round closes the six fail-closed evidence findings and incorporates the parent
operator's completed VoiceOver session without attributing that manual operation to the
implementer.

1. Every enabled tabbable is traversed with no cap. Each enabled button and checkbox has
   both Enter and Space evidence; links have Enter navigation-intent evidence; editable
   fields have a real value-change assertion. Auth submit actions produce localized safe
   live status, schedule cards open localized detail state, and signup checkboxes toggle.
   No enabled button or checkbox is waived.
2. Nested keyboard, focus, activation, reduced-motion, forced-colors, representative-flow,
   and AT-semantic evidence uses strict enums and recomputed aggregate reconciliation.
   Passing focus order is nonempty where applicable. Forced-colors pass requires a
   complete nonempty target set with `checked === total` and no recorded failures.
3. The AT evidence validator requires the exact seven-journey by three-language catalog,
   exact target URL, and exact ordered check list. Tests prove fabricated target and check
   text fail. The parent operator's 21/21 manual VoiceOver passes are recorded separately
   in `docs/design/evidence/task-15-voiceover-transcript.md`, including environment,
   no-mutation safety, exact journey targets, observed localized names, and explicit
   operator attribution.
4. Artifact freshness now hashes the sorted transitive local import closure rooted at the
   audit entrypoint and interaction runner. TypeScript AST traversal follows static,
   exported, dynamic, and CommonJS imports; CSS imports and alias/relative resolution are
   included. The closure test proves the rendered fixture, visual adapters, production
   lesson card, and core localization catalog are dependencies.
5. Forced-colors inspection now covers every visible governed focusable, control, image,
   heading, and ordinary body-text target. The final 48 rows inspected 684 targets with
   nonzero text coverage and zero target failures. The image-backed focus check resolves
   its actual opaque halo through a DOM color probe and retains the real product texture,
   3 px outline, and 5.60:1 computed contrast evidence.
6. Locale leakage checks collect the union of visible and accessible strings across each
   journey's initial, open-dialog, and outcome states. Wrong HE/AR/EN scripts and
   unapproved Latin strings fail; narrow proper-name, product, and required Apple legal
   phrases are allowlisted explicitly. The discrepancy ledger and reproducible before/
   after support and app-marketing artifacts remain unchanged and valid.

TDD and verification for this round:

- Initial evidence test: red with a missing dependency-closure export; after the first
  implementation pass, 15 passed and 4 remained red against the deliberately stale
  interaction artifact. The first regenerated browser artifact exposed only two
  global-navigation locale-policy false positives; the next run exposed the computed
  halo serialization gap. Both were fixed with narrow tests/contracts before the final
  green run.
- Interaction checks: 48/48 canonical scenario/language rows passed; all 156 enabled
  tabbables were traversed, focus checked, and given an activation/editability record.
- Reflow: 48/48 at 200% and 48/48 at 400%. Reduced motion: 48/48 across 2,496 elements
  and 4,992 pseudos. Forced colors: 48/48 across 684 governed targets.
- Focus surfaces: 5/5 passed; white 5.69:1, ivory 5.60:1, sand 4.31:1, navy 9.49:1,
  image-backed 5.60:1, all with a 3 px outline.
- Representative latency: dialog 15.8 ms, production schedule filtering 2.1 ms, and
  table filtering 5.4 ms; 3/3 below 200 ms.
- Automated AT fixture semantics: 21/21 passed with exact catalog checks. Parent-operated
  VoiceOver: 21/21 passed with transcript evidence; 0 pending manual rows.
- Capture: 288/288 regenerated. The full overview and all 72 auth-state variants were
  reinspected; no clipping, safe-area, logical-alignment, locale-expansion, overlay, or
  state-clarity failure was found. The ledger remains 288 accepted, 0 unresolved.
- Axe: 288/288 scans, 0 serious/critical violations.
- Focused evidence/journey tests: 23 passed, 0 failed, 591 assertions.
- Repository unit/integration suite: 970 passed, 6 environment-gated skips, 0 failed,
  12,113 assertions across 143 files.
- Lint: exit 0, 0 errors and 748 pre-existing warnings.
- Production build: exit 0; existing TanStack deprecation output remains.

The final tracked interaction artifact is
`docs/design/evidence/task-15-interaction-results.json`, generated at
`2026-08-29T23:29:02.915Z` with SHA-256
`9ee2e6d57b87fcea2bf9d59622fee2f57ade01023db408a00b5ead3363e2112b`.
`progress.md` remains untouched, no environment file was changed, and no external data or
service was mutated.

## Independent review fix round 4 — 2026-08-30

This round closes the five remaining evidence-integrity and inspection-depth findings.

1. Activation validation now derives exact assertions from typed production-fixture adapters.
   Buttons require both exact Enter and Space outcomes, checkboxes require the native Enter
   no-toggle plus Space toggle contract, links require exact Enter navigation intent, and fields
   require the exact edit contract. Auth and schedule assertions include the exact localized live
   status or opened-state text. Adversarial tests prove fabricated per-key text and arbitrary
   auth/schedule statuses fail validation.
2. The evidence validator reads the tracked VoiceOver transcript itself. It verifies the
   documented transcript SHA-256, parent-operator attribution, declared macOS VoiceOver
   environment, and exactly 21 unique journey/language sections with PASS, canonical URL, and the
   exact ordered manual-observation catalog. Missing, fabricated, duplicate, and identity-stale
   transcripts all fail. This validates the tracked record's completeness and identity; it does
   not claim cryptographic proof that a human operated VoiceOver.
3. Dependency freshness follows CSS `@import` and `url(...)` references, resolves public-root
   paths, and includes `public/images/textures/ivory-paper.svg`. A temporary-fixture test proves
   changing that asset changes the dependency-closed SHA-256. The supported product-image-aware
   command is now `bun run ui-audit:interactions`; Task 15 documentation and the Task 16 release
   command use that package script.
4. Forced-colors inspection now visits every visible leaf text-bearing element, all controls,
   focusables and images, plus accessibility-only text referenced by `aria-labelledby` or
   `aria-describedby`. Controls include native links. Passing evidence requires nonzero text and
   every scenario-applicable focusable/control/image category, full checked/total reconciliation,
   forced-color text contrast of at least 4.5:1, control border/focus contrast of at least 3:1 (or
   equivalent link/disabled-control foreground distinction), and zero target failures. Alpha
   colors are composited over the resolved forced `Canvas` backdrop. Adversarial zero-category and
   equal-color evidence fails.
5. Locale inspection now collects visible text, hidden label/description sources, `aria-label`,
   `aria-description`, `aria-valuetext`, title, placeholder and alt text, and value-derived
   input/select/textarea strings across the exercised states. A snapshot-fixture regression proves
   hidden English label text, an English ARIA description, and an English form status all fail the
   Hebrew policy while the narrow proper-name/technical allowlist remains valid.

Red-first evidence was captured for every seam: fabricated activation/status results initially
returned no validation errors; transcript deletion/fabrication/duplication initially passed;
the product texture was absent from closure and asset edits left the SHA unchanged; zeroed
app-scenario forced-color categories were accepted; and the accessibility-string snapshot helper
was absent. Each focused adversarial test now passes.

Final verification for this round:

- Supported Playwright interaction command: 48/48 canonical scenario/language rows and 21/21
  automated AT-semantic rows passed.
- Keyboard/focus/activation: all 156 enabled tabbables traversed, focus-checked and given an exact
  activation or edit outcome.
- Forced colors: 48/48 passed across 900 checked targets: 156 focusables, 171 controls, 657 text
  targets and 57 images; 0 target failures.
- Reduced motion: 48/48 passed across 2,496 elements and 4,992 pseudos.
- Representative latency: dialog 16.7 ms, production schedule filtering 2.5 ms, table filtering
  7 ms; 3/3 below 200 ms.
- Focused Task 15 evidence suite: 26 passed, 0 failed, 379 assertions.
- Repository unit/integration suite: 976 passed, 6 environment-gated skips, 0 failed, 12,130
  assertions across 143 files. The suite was run with the Bun binary directory explicitly on PATH
  because several child-process tests invoke `bun` by name.
- Lint: exit 0, 0 errors and 748 pre-existing warnings.
- Production build: exit 0.

The final interaction artifact was generated at `2026-08-29T23:48:10.281Z`, has SHA-256
`e9f4eb6300d70d0b847f245d1ca7b4a35a26059be5a067d9c699b2f85bbfa567`, and records dependency
source SHA-256 `1007cdc4b5b6e8eca33f7f62a7c0783f778b1815ee5310d8381f1ec6f896a830`.
The parent-operated VoiceOver transcript remains 21/21 PASS with SHA-256
`65f58e170262196b92f08cd34101eb6af43b0df672e3d1373c00655c1938522e`.
`progress.md` remains untouched; no environment file, external data, or external service was
mutated.

## Independent review fix round 5 — 2026-08-30

This round closes the final two narrow P1 findings plus the requested transcript-caveat guard.

1. Link activation validation no longer accepts a prefix-only assertion. A typed catalog maps
   every committed actionable link control to its exact local path/query or external destination,
   including localized `/app?lang=...`, reset-password mode, Instagram campaign query, App Store,
   `itms-apps:`, WhatsApp, email, and telephone targets. Loopback origins are normalized without
   weakening paths or queries. A fabricated `https://fabricated.example/` intent now fails the
   exact control catalog.
2. Forced-color targets classify visible text inside buttons, links, inputs, selects, and textareas
   as text-bearing. Empty fields inspect their `::placeholder` foreground. Every such target must
   independently meet 4.5:1 text contrast; control border or focused outline must separately meet
   3:1 unless the control is disabled. High-contrast borders, arbitrary shadows, and underlines can
   no longer excuse 1:1 control text. Red-first helper tests cover all three false-positive cases
   and positive system-color examples.
3. Transcript validation now requires the explicit statement that the tracked parent-operator
   transcription is not cryptographic proof of human operation. A negative test removes only that
   caveat and recomputes the documented SHA-256; validation still fails on the missing manual-
   evidence caveat, proving the check is independent of artifact hash identity.

The formatter-stable browser run passed 48/48 canonical scenario/language rows and 21/21 automated
AT-semantic rows. Forced colors checked 900/900 targets with 156 focusables, 171 controls, 813
text-bearing targets, 57 images, and zero failures. Representative latency remained below 200 ms:
dialog 18 ms, production schedule filtering 1.9 ms, and table filtering 7.3 ms.

Final gates: the focused Task 15 suite passed 30/30 with 388 assertions; the repository unit and
integration suite passed 981 tests with 6 environment-gated skips, 0 failures, and 12,144
assertions across 143 files. Lint exited 0 with 0 errors and 748 pre-existing warnings. The
production build passed.

The final interaction artifact was generated at `2026-08-30T00:03:03.698Z`, has SHA-256
`2f31a0a487b27cbe7d569ac177e440b8470c27ac128b667d4312f7ba84862aaa`, and records dependency
source SHA-256 `f4af784dec48a7f258299749b290f036aa0705c025a9880f826c46d5f8ec7a7a`.
The parent-operated VoiceOver transcript remains 21/21 PASS and retains its explicit manual,
non-cryptographic attribution caveat. `progress.md` remains untouched; no environment file,
external data, or external service was mutated.

## Independent review fix round 6 — 2026-08-30

This round closes the three reproducible fail-open seams with red-first adversarial coverage.

1. Link evidence now validates catalog presence, assertion syntax, and exact target equality as
   separate conditions. An unknown `a:Unknown new link` paired with a malformed `fabricated`
   assertion produces both the missing-catalog and malformed-assertion errors; empty and omitted
   targets independently produce the malformed-assertion error, so no `null === null` comparison
   can pass. The existing exact external-destination fabrication test remains green.
2. Forced-color text contrast now composites authored alpha and the effective ancestor-opacity
   chain over the resolved exterior/background pixels before applying 4.5:1. Control boundaries
   are compared with the adjacent exterior background, while actual focused outlines or measured
   shadow rings are independently compared with the exterior at 3:1. A static border cannot stand
   in for focus, and an arbitrary shadow cannot pass without measurable width and contrast.
   Adversarial tests reject 0.01-opacity black-on-white text, a 1:1 focus ring beside a strong
   static border, and a boundary that contrasts only with the control interior; positive opaque
   text, exterior boundary, and focused system-color cases pass.
3. Transcript caveat validation now operates on reader-visible Markdown after removing HTML
   comments, script/style/template content, and hidden or `aria-hidden` raw-HTML regions. Moving
   the required non-cryptographic manual-attribution caveat into an HTML comment and recomputing
   the documented SHA-256 still fails validation.

The stricter browser pass exposed a real product failure: nine app-language, signup-checkbox, and
schedule role-button rows had a passing focus outline but no independent forced-color control
boundary. Native checkboxes also suppressed an authored border under their platform appearance.
Production CSS now supplies a `ButtonText` boundary for native and ARIA controls in forced colors,
uses an explicit Canvas/Highlight checkbox and radio treatment, and restores the app-marketing
language button boundary after its component-level `border: 0`. The change uses normal cascade
ordering without `!important`; the checked route-cascade participant digests were refreshed and
all 40 style/cascade contract tests pass.

Final verification for round 6:

- Supported Playwright interactions: 48/48 canonical scenario/language rows and 21/21 automated
  assistive-technology semantic rows passed.
- Keyboard and activation: 156/156 enabled controls were traversed and have exact outcome records.
- Forced colors: 900/900 governed targets passed, comprising 156 focusables, 171 controls, 813
  text-bearing targets, and 57 images, with 0 failures.
- Reduced motion: 2,496 elements and 4,992 pseudos were inspected.
- Representative latency: dialog 15.9 ms, production schedule filtering 6.9 ms, and table
  filtering 5.9 ms; all 3/3 remain below 200 ms.
- Focused Task 15 evidence suite: 35 passed, 0 failed, 400 assertions.
- Focused stylesheet contracts: 40 passed, 0 failed, 328 assertions.
- Repository unit/integration suite: 986 passed, 6 environment-gated skips, 0 failed, 12,156
  assertions across 143 files.
- Lint: exit 0, 0 errors and 748 pre-existing warnings.
- Production build and the UI-audit fixture build: exit 0.

The final interaction artifact was generated at `2026-08-30T00:38:16.212Z`, has SHA-256
`41297308ea0a21dc0771d7bd8168b81ae1116eb1503d0322388c655bc2be8f0e`, and records dependency
source SHA-256 `eafb117c657e73834ebb1462ec927d601156892d3d685ea9e5c072eee8c129d8`.
The parent-operated VoiceOver transcript remains 21/21 PASS with its visible manual,
non-cryptographic attribution caveat and SHA-256
`65f58e170262196b92f08cd34101eb6af43b0df672e3d1373c00655c1938522e`.
`progress.md` remains untouched; no environment file, external data, or external service was
mutated.

## Independent review fix round 7 — 2026-08-30

This round closes the two remaining forced-colors calculation seams with red-first adversarial
coverage and no architectural refactor.

1. Rendered backgrounds are now resolved by collecting each element-to-canvas background layer
   and compositing every layer exactly once in paint order. The element background and adjacent
   exterior are resolved independently, so a translucent ancestor cannot be reused or
   double-composited. The exact regression case—a transparent text child on 50% black over white—
   now resolves to gray (`rgb(128, 128, 128)`), and white text at about 3.95:1 fails the required
   4.5:1 threshold. Nested-alpha positive and negative cases protect the full walk.
2. Focus evidence now compares the unfocused and focused computed styles. An outline, border, or
   shadow qualifies only when it appears or materially changes on focus; shadows must also be
   non-inset and measurably thick. Indicator contrast is measured against the independently
   resolved adjacent exterior. Tests reject an unchanged static 3px black shadow and a changed
   inset shadow, while accepting a new contrasting outer ring. The browser artifact records and
   reconciles one focus-delta measurement for every focusable target.

Final verification for round 7:

- Supported Playwright interactions: 48/48 canonical scenario/language rows and 21/21 automated
  assistive-technology semantic rows passed.
- Forced colors: 900/900 governed targets passed with 0 failures, including 156/156 focusable
  targets with recorded before/after focus-delta evidence.
- Representative latency: dialog 16.3 ms, production schedule filtering 4.6 ms, and table
  filtering 7.1 ms; all 3/3 remain below 200 ms.
- Focused Task 15 evidence suite: 38 passed, 0 failed, 410 assertions.
- Focused stylesheet contracts: 40 passed, 0 failed, 328 assertions.
- Repository unit/integration suite: 989 passed, 6 environment-gated skips, 0 failed, 12,166
  assertions across 143 files.
- Lint: exit 0, 0 errors and 748 pre-existing warnings.
- Production build: exit 0 (`built in 3.58s`).

The final interaction artifact was generated at `2026-08-30T00:51:02.271Z`, has SHA-256
`ec5477ad74e96142078fc54cd90b727113d97d38facd6d0a3d69222e9d26edcc`, and records dependency
source SHA-256 `3d68d53c9cbe7eeea872d095c275062eddfb2072028654f39507e37f4a8d80ab`.
The parent-operated VoiceOver transcript remains 21/21 PASS with its visible manual,
non-cryptographic attribution caveat. `progress.md` remains untouched; no environment file,
external data, or external service was mutated.

## Independent review fix round 8 — 2026-08-30

This round closes the two requested evidence seams with red-first adversarial coverage.

1. Forced-color pixels now use one target-to-canvas paint chain. At each element, the descendant
   pixel is composited over that element's background, then that element's CSS `opacity` is
   applied once to the resulting group before it is painted into the next ancestor. The adjacent
   exterior derives from the same chain with the target layer removed, so an opaque ancestor is
   never duplicated as both the element background and exterior. The exact transparent-child,
   white-text, black-parent-at-50%-opacity case renders a gray background with white text at about
   3.95:1 and fails 4.5:1; a nested high-opacity group case remains a passing positive control.
2. The accessibility evidence validator now reconciles the verification summary with the parsed
   artifact for forced-color checked/total targets, captured/expected focus deltas, and each exact
   representative-flow latency. Independent mutations to any of those three summary fields fail
   validation. The tracked summary now reports the final regenerated values rather than the stale
   pre-round counts and timings.

Final verification for round 8:

- Supported Playwright interactions: 48/48 canonical scenario/language rows and 21/21 automated
  assistive-technology semantic rows passed.
- Forced colors: 900/900 governed targets passed with 0 failures, including 156/156 focus-delta
  measurements.
- Representative latency: dialog 17 ms, production schedule filtering 6 ms, and table filtering
  6.3 ms; all 3/3 remain below 200 ms.
- Focused Task 15 evidence suite: 40 passed, 0 failed, 415 assertions.
- Repository unit/integration suite: 991 passed, 6 environment-gated skips, 0 failed, 12,171
  assertions across 143 files.
- Lint: exit 0, 0 errors and 748 pre-existing warnings.
- Production build: exit 0 (`built in 2.89s`).

The final interaction artifact was generated at `2026-08-30T01:14:04.209Z`, has SHA-256
`6f8228072a854c9abc29587e06fedf66eb164961eb15156037d3e3bd144c5456`, and records dependency
source SHA-256 `dad83f860a867c39ffc170b743160756863365f6d0327efd3c0d4a7f94b157ca`.
The parent-operated VoiceOver transcript remains 21/21 PASS with its visible manual,
non-cryptographic attribution caveat. `progress.md` remains untouched; no environment file,
external data, or external service was mutated.

## Independent review fix round 9 — 2026-08-30

The verification result prose no longer repeats the mechanically checked forced-color totals,
focus-delta totals, or measured flow latencies. It points readers to the correlated metadata,
which is now the single numeric source of truth. Red-first adversarial tests also inject stale
former-style count and latency sentences; evidence validation rejects both, preventing an
unvalidated duplicate from being reintroduced.

Focused Task 15 evidence tests passed 41/41 with 417 assertions. Lint exited 0 with 0 errors and
748 pre-existing warnings, and the production build passed in 3.12 seconds. The interaction
source, browser logic, tracked artifact, VoiceOver evidence, and `progress.md` remain untouched.
