# Cloud & Core Design System Proposal

**Working name:** Quiet Strength
**Status:** Proposal only — do not implement during the audit phase

## Purpose

Quiet Strength should make every Cloud & Core experience feel calm, personal, premium, and operationally clear. Premium quality comes from proportion, typography, alignment, photography, accessibility, and reliable interaction—not decoration.

## Brand principles

1. **Calm before clever.** The next action and current state must be obvious before an expressive treatment is added.
2. **Strength through restraint.** Navy provides structure, ivory provides air, and gold marks only meaningful detail.
3. **Personal, not casual.** Copy sounds like a thoughtful studio host: warm, direct, and specific.
4. **Real movement.** Use genuine Cloud & Core people, studio, equipment, and light. Avoid generic fitness stock.
5. **One studio, three languages.** Arabic, Hebrew, and English are designed concurrently; RTL is not a mirrored afterthought.
6. **Trust is visible.** Price, credits, eligibility, availability, cancellation effect, payment status, and permissions are explained before commitment.

## Token architecture

Use three layers only:

- **Raw tokens:** literal palette and measurements, private to the theme.
- **Semantic tokens:** `text-primary`, `surface-raised`, `action-primary`, `status-danger`.
- **Component tokens:** rare, scoped exceptions such as `class-card-overlay`.

Do not expose raw palette names in route code. Do not create route-specific aliases for existing semantic roles.

## Color system

Values below are starting points and require contrast validation in real components.

### Foundations

| Role | Proposed value | Use |
|---|---|---|
| `foundation.navy` | `#0B1D3A` | Primary actions, strongest ink, dark surfaces |
| `foundation.navy-strong` | `#07162D` | Hover/pressed dark action |
| `foundation.ivory` | `#FAF7F2` | Page background |
| `foundation.white` | `#FFFFFF` | Raised controls/cards |
| `foundation.sand` | `#E8DFD1` | Muted panels and dividers |
| `accent.gold` | `#D4AF6A` | Border, icon, rule, large decorative accent only |

### Text

| Role | Proposed value | Rule |
|---|---|---|
| `text.primary` | `#0B1D3A` | Default copy and headings |
| `text.secondary` | `#536074` | Supporting copy; verify 4.5:1 on all surfaces |
| `text.muted` | `#667085` | Metadata only when contrast passes |
| `text.inverse` | `#FAF7F2` | On navy |
| `text.link` | `#173057` | Links; underline on hover/focus and in body copy |

Gold must never be normal-size body text on ivory/white. If gold-colored text is essential, use a darker accessible gold such as the current editorial `#8F6727`, then validate size/weight/background.

### Semantic status colors

| Role | Foreground | Soft surface | Additional cue |
|---|---|---|---|
| Success | `#356044` | pale green | Check icon + explicit success text |
| Warning | `#795B20` | pale amber | Alert icon + consequence text |
| Danger | `#8D4D52` | pale rose | Error icon + recovery/action |
| Info | `#375A7A` | pale blue | Info icon + contextual explanation |
| Disabled | secondary text | sand/white mix | Disabled attribute + reason nearby |

Never encode availability, payment, attendance, or error state by color alone.

## Typography

### Families

- Hebrew UI: Assistant.
- Arabic UI: Noto Sans Arabic.
- English UI: Assistant.
- Brand/editorial Latin only: Cormorant Garamond.
- Numbers/codes: the active UI family with tabular figures; mono only for technical identifiers.

Self-host and subset required weights. Avoid synthetic bold/italic. Cormorant should not be used for dense operational/admin text.

### Type scale

| Token | Mobile | Desktop | Weight | Use |
|---|---:|---:|---:|---|
| `display-lg` | 40 | 56 | 600 | Marketing hero only |
| `display-md` | 32 | 40 | 600 | Route hero |
| `heading-1` | 28 | 32 | 650 | Page title |
| `heading-2` | 22 | 24 | 650 | Major section |
| `heading-3` | 18 | 20 | 650 | Card/section title |
| `body-lg` | 17 | 18 | 400 | Introductory copy |
| `body` | 16 | 16 | 400 | Default copy/forms |
| `body-sm` | 14 | 14 | 400/500 | Supporting copy |
| `label` | 14 | 14 | 600 | Control labels |
| `meta` | 12 | 12 | 600 | Short metadata only |

Minimum mobile body text is 14 px. Do not solve source typography with global selectors that rewrite arbitrary `text-[9px]` utilities.

## Spacing and grid

### Spacing scale

`0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96` px.

- Component internal gaps: 8–16 px.
- Card padding: 16 mobile, 20–24 desktop.
- Page gutters: 16 at 360–430, 24 at tablet, 32–48 at desktop.
- Section rhythm: 32 mobile, 48–64 desktop.
- Avoid new spacing literals unless the value is a documented optical correction.

### Grid

- 360–639: four columns, 16 px gutter, 16 px margin.
- 640–1023: eight columns, 24 px gutter, 24 px margin.
- 1024+: twelve columns, 24–32 px gutter, 32–48 px margin.
- Content max widths: 720 px reading, 1120 px application, 1280 px dense admin.
- Forms should generally cap at 560 px; data tables may use the full application width.

## Radius

| Token | Value | Use |
|---|---:|---|
| `radius-control` | 12 px | Inputs, buttons, selects |
| `radius-card` | 18 px | Cards |
| `radius-panel` | 24 px | Major surfaces, sheets |
| `radius-overlay` | 24 px | Dialogs |
| `radius-pill` | 999 px | Chips, segmented controls |

Photography may use `radius-card` or square editorial crops. Do not introduce 28/32 px route-specific values without a documented component role.

## Elevation

| Token | Treatment | Use |
|---|---|---|
| `elevation-0` | No shadow, border only | Default cards |
| `elevation-1` | `0 2px 10px rgba(11,29,58,.07)` | Raised interactive card |
| `elevation-2` | `0 8px 28px rgba(11,29,58,.12)` | Sticky/floating navigation |
| `elevation-3` | `0 20px 60px rgba(11,29,58,.18)` | Dialog/sheet only |

Use elevation to communicate layering, not luxury. Avoid glow stacks and backdrop blur on ordinary content.

## Icon rules

- Lucide is the default set.
- Standard sizes: 16 inline, 20 control, 24 section, 32 status illustration.
- Decorative icons: `aria-hidden="true"`.
- Icon-only controls: mandatory localized accessible name and 44×44 px target.
- Directional icons use logical forward/back helpers and flip in RTL; universal icons do not flip.
- Never use emoji as the only state indicator.

## Motion

- Durations: 120 ms immediate feedback, 180 ms controls, 240 ms overlays, 320 ms major reveal.
- Easing: standard ease-out for entry, ease-in for exit.
- Motion must clarify hierarchy or state; no perpetual decorative movement.
- Respect `prefers-reduced-motion` by removing transforms, parallax, animated gradients, and nonessential fades.
- Loading spinners require visible status text or an accessible live announcement when longer than one second.

## Responsive rules

- Design mobile first at 360 px, then validate 390, 430, 768, 1024, and 1440.
- Use three layout ranges: compact `<640`, medium `640–1023`, wide `≥1024`; add exceptions only for proven component needs.
- Primary actions remain visible without covering content or keyboard controls.
- Tables use one of three declared patterns: priority-column table, stacked record cards, or horizontal data region with explicit affordance.
- Never hide required information solely because the viewport is small.
- Validate 200% zoom and increased text without fixed-height clipping.

## RTL and localization rules

- Set `lang` and `dir` at the document root; components inherit direction.
- Use logical CSS properties and Tailwind logical utilities.
- Use `<bdi>` or `dir="auto"` for user-generated names and mixed titles.
- Force `dir="ltr"` for email, phone, URL, payment reference, promo code, and numeric time ranges while preserving surrounding alignment.
- Render time ranges as an isolated value, e.g. `<bdi dir="ltr">09:30–10:45</bdi>`.
- Date, number, and currency formatting goes through `Intl` with explicit locale/currency/time zone.
- Back/forward arrows flip; check, play, clock, payment-card, and brand marks do not.
- Hebrew and Arabic copy must be reviewed independently; avoid assuming one RTL layout proves the other.
- Every public shell exposes the same localized language control.

## Photography

- Use real studio, instructors, members with consent, hammocks, mats, light, and Hurfeish context.
- Prefer natural light, calm negative space, and movement with control.
- Avoid generic stock poses, over-retouching, neon gym lighting, and AI-looking people/equipment.
- Provide width/height or aspect ratio to prevent CLS; use AVIF/WebP and responsive sources.
- Text overlays require a tested contrast scrim and must survive the brightest image region.
- Meaningful photos have concise alt text; atmospheric duplicates use empty alt.

## Content and UX writing

- Lead with the user’s state: “2 credits available,” “Class full—join waitlist,” “Booking confirmed.”
- Use one primary verb per screen.
- Explain consequences before confirmation: credit used, price, cancellation deadline, refund/credit result, waitlist behavior.
- Avoid vague “Something went wrong” when a safe, specific cause/recovery exists.
- Success messages name what changed and the next useful action.
- Destructive actions name the object and permanence; confirmation labels repeat the action.
- Maintain a shared term glossary across Arabic, Hebrew, and English for class, session, package, credit, booking, waitlist, instructor, and cancellation.

## Component hierarchy

1. Foundations: color, type, space, grid, radius, elevation, motion, bidi.
2. Primitives: text, icon, button, input, badge, divider, spinner, skeleton.
3. Composites: field, status message, segmented control, date picker, search, card, empty state.
4. Domain components: class card, credit balance, plan card, participant row, payment status, attendance control.
5. Patterns: booking confirmation, cancellation, waitlist, checkout, destructive admin dialog, responsive data table.
6. Shells: PublicShell, MemberShell, InstructorShell, AdminShell.

Routes compose patterns and shells; they do not invent new foundations.

## Required component states

Every interactive component documents default, hover, focus-visible, pressed, selected, disabled, loading, error, success, and read-only where relevant. Every domain component documents loading, empty, error, permission denied, and stale/offline behavior.

### Booking action contract

- Available: show seats, credit/price effect, and “Book class.”
- Full: show “Full” plus whether waitlist is available.
- Waitlist: explain ordering/notification and CTA “Join waitlist.”
- Ineligible: disabled CTA plus visible reason and recovery.
- Pending: lock repeat action and preserve context.
- Success: announce confirmation, class/time, credit change, cancellation deadline, calendar action.
- Failure: preserve details and offer retry/support without duplicate booking.

## Accessibility rules

- WCAG 2.2 AA is the release floor.
- Normal text ≥4.5:1; large text and UI graphics ≥3:1.
- Focus appearance uses a solid high-contrast 2–3 px token with offset; no control removes it without an equal replacement.
- Touch targets are at least 44×44 CSS px.
- One `main` landmark per page; headings are ordered.
- Fields have persistent labels, instructions, and programmatic error association.
- Dialogs trap focus, close on Escape when safe, and return focus to the trigger.
- Dynamic success/error/loading messages use appropriate live regions without excessive interruption.
- Authentication supports password managers, paste, autocomplete, zoom, and clear recovery.
- Fixed navigation cannot cover focused content or validation messages.

## Correct and incorrect usage

| Correct | Incorrect |
|---|---|
| Navy body text on ivory; gold border accent | Small gold paragraph text on ivory |
| One navy primary button and one quiet secondary action | Three equally weighted gold/navy CTA cards |
| Real studio photo with stable aspect ratio | Generic fitness stock or decorative AI imagery |
| `padding-inline`, `inset-inline-start`, bidi-isolated time | Hardcoded left/right and reversed time punctuation |
| Explicit “Uses 1 credit; 4 remain” before booking | “Confirm” with no cost/credit consequence |
| Solid visible focus ring | Transparent glow that disappears on white |
| Semantic status text + icon + color | Red/green color alone |
| Shared public locale control | Language selection only on sign-in |
| Three responsive ranges with tested exceptions | A new breakpoint for each route |

## Governance

- Token changes require contrast results and visual diffs.
- New literals require design-system review.
- New route-level CSS is allowed only for layout composition, not new button/card/type systems.
- CI should fail on accessibility regressions, missing screenshots in the agreed matrix, or bundle-budget violations.
- Version the system and publish migration notes; do not silently change semantic token meaning.
