# Cloud & Core Design Inventory — Implemented State

**Original inventory:** 2026-08-28

**Final inventory:** 2026-08-30
**Scope:** production UI sources, isolated audit adapters, and executable design contracts. Final audit score: **92/100**.

## Technical foundation

| Area | Implemented state |
|---|---|
| Framework | React 19, TypeScript, Vite 8, TanStack Start |
| Routing/data | TanStack Router and Query with existing Supabase contracts unchanged |
| Styling | Tailwind CSS v4 plus source-owned base/public/member/instructor/admin sheets |
| Components | Radix UI primitives, local wrappers, and role-specific presentation components |
| Icons | Lucide React; decorative icons hidden and icon controls named by contract |
| Fonts | Local Fontsource Assistant HE/Latin, Noto Sans Arabic, and Cormorant Garamond; no Google Fonts request |
| Shells | `PublicShell`, `AppShell`, member/instructor/admin route style owners, root recovery fallback |
| Localization | HE/AR/EN core and lazy role namespaces; document direction plus bidi formatters |
| Accessibility | axe matrix, interaction checks, forced-colors/reflow/reduced-motion checks, and manual VoiceOver transcript |
| Visual evidence | Guarded fixture app; 16 visual public/guest surfaces and 288 six-viewport HE/AR/EN captures, plus 303 nonvisual dispositions including 170 protected-runtime blocked states |
| Performance | Deterministic bundle provenance/budgets and fail-closed local production Lighthouse runner |

The fixture boundary requires `UI_AUDIT_FIXTURES=true`, rejects application production mode and configured remote hosts, and contains deterministic records only. It neither authenticates nor mutates backend data.

## Current source footprint

| Source | Current size |
|---|---:|
| `src/styles.css` compatibility entry | 2 lines |
| `src/styles/base.css` | 6,870 lines |
| `src/styles/public.css` | 2,674 lines |
| `src/styles/member.css` | 346 lines |
| `src/styles/instructor.css` | 6 lines |
| `src/styles/admin.css` | 2,105 lines |
| `src/components/app-marketing/app-marketing.css` | 945 lines |
| Shared/component TSX files | 94 |
| UI route TSX files | 56 |
| Current literal inventory | 108 unique hex values, 69 unique `rgb/rgba` forms, 365 unique `px/rem/em` forms, 27 media-query forms |
| Current `!important` baseline | 34 declarations |

Literal counts no longer serve as the quality gate by themselves. The executable style contract now rejects unapproved hardcoded presentation values, physical direction rules, decorative gold body text, duplicate breakpoint recipes, new `!important` declarations, route-owner violations, and cascade drift. Existing approved literals are named palette/component primitives rather than silent route-local values.

## Implemented token architecture

`src/styles/tokens.css` now separates:

1. Semantic roles: `--cc-text-*`, `--cc-surface-*`, `--cc-action-*`, `--cc-state-*`, focus, target, motion, and spacing.
2. Named palette/presentation primitives: `--cc-palette-*`, `--cc-alpha-*`, and bounded component palettes.
3. Compatibility aliases: the original `--color-*`, `--space-*`, type, radius, shadow, and transition names used by unmigrated selectors.

### Accessibility-critical tokens

| Contract | Implemented value |
|---|---|
| Primary text | `--cc-text-primary: #24303c` |
| Secondary text | `--cc-text-secondary: #52606d` |
| Canvas / raised | `#fffdf8` / `#ffffff` |
| Primary action | `#173b57` with ivory foreground |
| Destructive action | `#b42318` with white foreground |
| Focus, light surfaces | `3px solid #0b63ce`, 3 px offset |
| Focus, navy surfaces | `#8fc8ff` |
| Minimum target | `2.75rem` (44 px) |
| Reduced motion | 1 ms duration, one iteration, automatic scroll behavior |

The final interaction artifact verifies the actual focus indicator on white, ivory, sand, navy, and an image-backed product surface. Forced-color checks cover 900/900 applicable targets and 156/156 pre-focus/focused deltas.

## Typography and mixed-direction content

- Assistant is the Hebrew and Latin UI family; Noto Sans Arabic owns Arabic UI; Cormorant Garamond is limited to editorial Latin brand copy.
- Required faces and weights are local Fontsource imports in `src/routes/__root.tsx`.
- Default body/forms are at least 14–16 px. A legacy mobile selector still raises `text-[9px]`, `text-[10px]`, and `text-[11px]` utilities; it is retained compatibility debt, not an implemented source-typography ideal.
- `BidiValue`, `BidiDateTime`, and `EmbeddedContactText` isolate phones, email, URLs, identifiers, localized dates/times, and currency without rewriting the visible value.
- Route-level bidi scanning includes computed/static composition and fails closed on bypasses.

## Radius, elevation, spacing, and motion

Canonical component roles resolve through `--cc-radius-button`, `--cc-radius-input`, `--cc-radius-card`, `--cc-radius-panel`, and `--cc-radius-chip`. Legacy class recipes are mapped at the compatibility layer and frozen by computed-cascade evidence.

The base spacing scale is 4, 8, 12, 16, 24, 32, and 48 px; layout-specific optical values remain permitted only where registered by the style contract. Elevation uses the card/sidebar/elevated roles plus bounded component presentation tokens. Reduced-motion overrides are checked against every authored animation, transition, scroll behavior, and pseudo-element in the registered UI.

## Component inventory

### Foundations and primitives

- Actions: Button, IconButton, link/action styles, Toggle, ToggleGroup.
- Fields: Input, Textarea, Select, Checkbox, RadioGroup, Switch, OTP, Label, FieldMessage.
- Composites: Dialog, AlertDialog, Sheet, Drawer, Popover, menus, tabs, carousel, command, tooltip.
- State: AsyncState, Skeleton, toast region, Badge, Progress, EmptyIllustration, MemberOutcomePanel.
- Data: Table, ResponsiveDataList, cards, metrics, roster/list alternatives.
- Visual: ResponsiveImage, ImageBackdrop, ClassMoodImage, VisualClassCard, CloudCardVisual, InstructorAvatar.

The primitive contract requires localized accessible names, 44 px targets, explicit disabled/loading state, active focus, Radix title/description semantics, focus trap/return, and persistent status where a toast alone would be insufficient.

### Shells and route families

- `PublicShell` owns the one public `main`, skip target, compact/default header, language switcher, and public support/navigation pattern.
- `AppShell` owns authenticated desktop/mobile navigation, safe-area/content clearance, localized drawer controls, and explicit focus return.
- Member presentation components cover schedule filtering, class details, booking consequences, cancellation, packages, account/payment outcomes, and recovery.
- Instructor presentation covers upcoming class, participant/attendance outcomes, and empty/loading/error states.
- Admin presentation uses shared page/header/KPI, responsive list/table alternatives, state derivation, destructive confirmation, and localized attendance/status output.

## CSS ownership and loading boundaries

`tools/ui-audit/route-style-contract.json` is authoritative:

| Sheet | Runtime owner |
|---|---|
| `src/styles/base.css` | `src/routes/__root.tsx` |
| `src/styles/public.css` | `src/components/public/PublicShell.tsx` |
| `src/styles/member.css` | `src/routes/_authenticated/member/route.tsx` |
| `src/styles/instructor.css` | `src/routes/_authenticated/instructor/route.tsx` |
| `src/styles/admin.css` | `src/routes/_authenticated/admin/route.tsx` |
| `src/styles.css` | compatibility entry importing only `./styles/base.css` |

Route sheets may remain loaded after client navigation, so selectors must remain isolated. The cascade baseline verifies source order, specificity, layers, logical direction, media conditions, and the exact retained winners.

## Compatibility ledger

| Compatibility surface | Owner | Current disposition | Removal review |
|---|---|---|---|
| `src/styles.css` base-only entry | UI platform owner | Retained so legacy imports cannot eagerly load role CSS | 2026-10-15 |
| `--color-*`, `--space-*`, old type/radius/shadow/transition aliases | Design-system owner | Retained while remaining source selectors move to `--cc-*` roles | 2026-10-15 |
| `--color-blue` aliasing sand | Design-system owner | Deprecated; no new use permitted | 2026-09-30 |
| `brass`/`ink`/`powder` utility vocabulary | Design-system owner | Compatibility-only; semantic roles required for new work | 2026-10-15 |
| 34 approved `!important` declarations | UI platform owner | Frozen in `style-important-baseline.json`; any addition or value drift fails | 2026-09-30 |
| Mobile 9/10/11 px microcopy floor | Route-family owners | Retained to protect unconverted source labels; original POLISH-05 debt remains visible | 2026-09-30 |
| Legacy radius/elevation winners | UI platform owner | Mapped to canonical roles and frozen by cascade baseline | 2026-10-15 |

Dates are review deadlines, not automatic deletion dates. Removal requires capture, interaction, style, lint, and production build gates.

## Evidence and known limitations

- Final visual/artifact manifest: `artifacts/ui-audit/final/manifest.json`.
- Screenshots: 288 public/guest files under `artifacts/ui-audit/final/screenshots/`; no direct protected member/instructor/admin screenshot is claimed.
- Axe: 288 scans, zero serious/critical and 18 moderate app-marketing `landmark-unique` findings.
- Interaction: 48/48 scenario/locale rows, 21/21 AT semantics, representative latency below 200 ms.
- Bundle: all configured raw/gzip/font/import-provenance budgets pass.
- Performance: valid local HE mobile LCP remains 4,386/4,202/5,447 ms and fails the 2,500 ms gate.
- Locale validity: the full production audit stops when `home-ar` reports `html[lang=he]`.
- Task flow: the registration CTA remains below the initial 390×844 viewport.
- Role-responsive coverage: 170 protected-runtime states remain blocked from direct screenshots.
- Compatibility: source microcopy, aliases, approved important declarations, and cascade baselines remain scheduled removal work.
- Tooling debt: six environment-gated database tests skip and lint reports 748 existing warnings.

The 300-file final evidence tree is intentionally retained because the implementation plan requires published screenshots and usable Lighthouse traces. Its 288 PNGs and six raw report/trace JSON payloads have per-file SHA-256 and size entries in the final manifest; no Git LFS or external storage policy was introduced.

## Inventory conclusion

Cloud & Core now has an explicit, executable design system rather than only an implicit visual vocabulary. The **92/100** score carries seven deductions: registration task priority, source microcopy, compatibility aliases/baselines, protected-role responsive screenshots, Arabic root validity, app-marketing landmark identity, and local-production LCP. These remain bounded, named release work rather than waived findings.
