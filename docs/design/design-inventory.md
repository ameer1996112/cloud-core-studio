# Cloud & Core Design Inventory

**Inventory date:** 2026-08-28
**Scope:** `src/` UI code and styles; audit only

## Technical foundation

| Area | Current implementation |
|---|---|
| Framework | React 19, TypeScript, Vite 8, TanStack Start |
| Routing | TanStack Router file routes; generated `src/routeTree.gen.ts` |
| Data | TanStack Query and Supabase |
| Styling | Tailwind CSS v4 plus `src/styles.css`, `src/styles/tokens.css`, and app-marketing CSS |
| Component foundation | Radix UI primitives with local shadcn-style wrappers |
| Icons | Lucide React |
| Fonts | Assistant, Noto Sans Arabic, Cormorant Garamond; Google Fonts link plus installed `@fontsource` packages |
| Mobile shell | Responsive web plus Capacitor iOS/Android shell |
| Accessibility tooling | ESLint only; no axe dependency or automated accessibility test suite found |
| Visual/E2E tooling | Playwright scripts, route guard tests, app-store screenshot tooling; no general visual-regression baseline suite |

## Source footprint

- `src/styles.css`: 11,409 lines.
- `src/styles/tokens.css`: 61 lines.
- `src/components/app-marketing/app-marketing.css`: 933 lines.
- Shared React components: 78 TSX files.
- UI route TSX files: 56, including layouts and redirects.
- Literal inventory: 80 unique hex colors, 322 unique `rgb/rgba` expressions, 411 unique `px/rem/em` values, 26 unique media-query forms, and 37 `!important` declarations.

## Declared design tokens

### Core colors

| Token | Value | Current role |
|---|---|---|
| `--color-navy` | `#0B1D3A` | Primary action, headline, ink |
| `--color-navy-strong` | `#07162D` | Hover/deeper ink |
| `--color-navy-elevated` | `#173057` | Elevated navy tone |
| `--color-ivory` | `#FAF7F2` | Page foundation |
| `--color-surface` | `#FFFFFF` | Card/control surface |
| `--color-sand` | `#E8DFD1` | Neutral surface |
| `--color-blue` | `#E8DFD1` | Alias currently equal to sand; misleading name |
| `--color-gold` | `#D4AF6A` | Accent, borders, icons, some text |
| `--color-text-primary` | `#0B1D3A` | Primary text |
| `--color-text-secondary` | `#5F6B7E` | Secondary text |
| `--color-success` | `#4F6B57` | Success |
| `--color-danger` | `#8D4D52` | Destructive/error |

Semantic aliases map these values into `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, and `ring`. Legacy `brass`, `ink`, and `powder` aliases remain.

### Complete literal hex inventory

The following normalized values occur in `src/**/*.{css,ts,tsx}`. Several are three-digit literals or alpha hexes and should be migrated to roles, not preserved as a palette.

`#039`, `#07162d`, `#071a32`, `#08152b`, `#0b1d3a`, `#102443`, `#10274c`, `#111`, `#173057`, `#25d366`, `#26364d`, `#475367`, `#4b5563`, `#4f6b57`, `#516075`, `#536074`, `#53627a`, `#556174`, `#596477`, `#5f6b7e`, `#667085`, `#6b5c44`, `#6b7890`, `#6f7a8c`, `#7d6841`, `#847`, `#8d4d52`, `#8f6727`, `#9a6d22`, `#9ea8b7`, `#a37e3d`, `#b7cce6`, `#b88b3d`, `#c59b4e`, `#c9d1dc`, `#cbd2dc`, `#ccc`, `#d1d5db`, `#d4af6a`, `#d4af6a33`, `#d4af6a55`, `#d7bf90`, `#d7dde5`, `#d8ae58`, `#dab86f`, `#ded3c3`, `#e7c77f`, `#e7f1f6`, `#e8bd66`, `#e8dfd1`, `#e8dfd140`, `#ed7966`, `#ede5d8`, `#efc36b`, `#efe5d4`, `#efe5d8`, `#efeae2`, `#f1e9df`, `#f1ebe1`, `#f25f4c`, `#f2ede4`, `#f4ebdf`, `#f4efe7`, `#f5eddf`, `#f5f0e9`, `#f7f1e8`, `#f7f2ea`, `#f8d88f`, `#f8f4ec`, `#faf6ef`, `#faf7f2`, `#fafafa`, `#fff`, `#fff8e9`, `#fff8ec`, `#fffaf1`, `#fffaf3`, `#fffdf8`, `#fffdf9`, `#ffffff`.

The 322 `rgb/rgba` literals are mostly opacity permutations of navy, gold, ivory, white, sand, and slate. Repetition is especially high for navy alpha values (roughly 0.025–0.98), gold alpha values (0.05–0.90), ivory/white alpha values, and shadow overlays. They should be represented by semantic surface/border/elevation tokens rather than maintained as separate colors.

## Typography

### Families

- UI Hebrew: Assistant, 400/500/600/700.
- UI Arabic: Noto Sans Arabic, 400/500/600/700.
- UI Latin: Assistant.
- Brand/editorial Latin: Cormorant Garamond, 300–700 with italics.
- Mono: browser/system mono via Tailwind for codes and identifiers.

### Declared size tokens

| Token | Value |
|---|---:|
| `--text-xs` | 12 px |
| `--text-sm` | 14 px |
| `--text-base` | 16 px |
| `--text-lg` | 17 px |
| `--text-xl` | 21 px |
| `--text-2xl` | 28 px |
| `--text-3xl` | 36 px |

Additional brand utilities declare a 13/15/17/20/28/40/56 scale. Route-local sizes range from 9 px microcopy to 72 px display type, with many arbitrary Tailwind values. RTL rules correctly remove Latin-style tracking/italics from Hebrew/Arabic.

## Spacing and sizing

### Declared spacing

`4, 8, 12, 16, 24, 32, 48 px` as `--space-1/2/3/4/6/8/12`.

### Actual usage

There are 411 unique `px/rem/em` literals, including layout widths, icon sizes, offsets, font sizes, negative transforms, and breakpoints. Common control heights are tokenized at 44, 48, and 52 px. Common route padding is 16–32 px mobile and up to 48 px desktop. The scale is present but not enforced.

## Radii

| Token | Value | Intended use |
|---|---:|---|
| `--radius-sm` | 6 px | Small items |
| `--radius-md` | 10 px | Inputs/buttons |
| `--radius-lg` | 16 px | Cards |
| `--radius-pill` | 999 px | Chips/pills |
| `--cc-radius-panel` | 18 px | Panels |

Observed one-offs include 14, 18, 22, 28, 32 px, `2rem`, `9999px`, and route-specific rounded utilities. Some prior documentation names button/input/card/panel radii as 14/12/18/22 px, but current token aliases resolve mostly to 10/10/16/18 px. This is a versioned-token mismatch.

## Shadows and elevation

Declared:

- `--shadow-card`: `0 1px 8px rgba(11,29,58,.06)`.
- `--shadow-sidebar`: `-4px 0 24px rgba(11,29,58,.08)`.
- `--shadow-elevated`: `0 4px 20px rgba(11,29,58,.10)`.

Observed route-local shadows extend to large 28–34 px offsets and 80–92 px blur, inset borders, colored glows, and multiple-layer shadows. Download, payment result, auth, promo, and marketing each introduce additional elevation language.

## Breakpoints

Tailwind defaults are used through `sm`, `md`, `lg`, and `2xl`. CSS also uses custom thresholds at 390, 420, 430, 460, 480, 520, 640/641, 720, 760, 767/768, 780, 800, 860, 900, 920, 960, 1024, 1040, 1080, 1100, 1180, and 1536 px, plus a 700 px height query. This fragmentation makes intermediate tablet behavior difficult to predict.

## Icons

Lucide React is the standard icon set. Icons are frequently marked `aria-hidden` when decorative, and `IconButton` requires an `aria-label`. Exceptions exist in route-local raw buttons; these need lint/test coverage. Brand marks and store badges are image/SVG assets, not Lucide icons.

## Component inventory

### Primitives

Accordion, alert dialog, alert, aspect ratio, avatar, badge, bidi, breadcrumb, button, calendar, carousel, chart, checkbox, collapsible, command, context menu, dialog, drawer, dropdown menu, form, hover card, input OTP, input, label, menubar, navigation menu, pagination, popover, progress, radio group, resizable panels, scroll area, select, separator, sheet, sidebar, skeleton, slider, sonner/toast, switch, table, tabs, textarea, toggle group, toggle, tooltip.

### Application shells

- `AppShell`: desktop sidebar, mobile drawer, member bottom navigation, locale menu, notifications/onboarding.
- `RequiredAppUpdate`: blocking native update state.
- Public routes implement separate shells; no single shared `PublicShell` exists.

### Member

Class detail sheet, premium class card, schedule filter panel, notification center, push onboarding, WhatsApp onboarding, weekly promo, yoga promo.

### Admin

Admin page shell/header/metric card, class danger zone, class roster drawer, Studio Pulse, push campaigns, concierge command center/template library/previews, delivery monitoring, yoga promotion.

### Visual

Responsive image, image backdrop, class mood image, visual class card, cloud card visual, empty illustration, instructor avatar.

## Pattern inventory

### Buttons

- Shared `Button` variants: default, destructive, outline, secondary, ghost, link.
- Sizes: default, small, large, icon.
- Legacy/class utilities: `btn-navy`, `btn-ghost`, `btn-outline`, `cta-navy`, `session-button`, `settings-save-button`.
- Route-local raw buttons remain common (224 `<button>` occurrences across routes/components).

### Inputs and forms

- Shared Input, Textarea, Select, Checkbox, RadioGroup, Switch, OTP, React Hook Form wrappers.
- Route-specific classes include editorial, settings, schedule-search, calendar, and delivery-monitoring inputs.
- Auth has explicit labels, validation associations, autofocus-to-error behavior, autocomplete, password visibility, and strength feedback.

### Cards and panels

Shared Card primitive plus member cards, admin cards, page panels, metric cards, lesson cards, visual class cards, package cards, promo cards, legal cards, and editorial campaign panels. Duplication is highest in surface, padding, radius, and shadow recipes.

### Dialogs and sheets

Radix Dialog/AlertDialog/Sheet are shared. Member class detail and admin roster use sheets; destructive admin actions use alert dialogs/danger-zone patterns. Close targets are commonly 40 px and should move to 44 px.

### Navigation

- Root redirects to auth.
- Guest schedule header with support/sign-in.
- Auth language pill and legal footer.
- App marketing top navigation and language control.
- Authenticated desktop sidebar, mobile drawer, and member bottom navigation.
- Legal language switcher.

### Status indicators

Badges, chips, availability meter, success/error icons, toasts, inline alerts, loading spinners, skeletons, empty illustrations, and metric cards. Success/danger have semantic tokens; warning/info rely more heavily on route-local values.

### Tables

Shared Table primitive plus admin-specific table/card hybrids for members, payments, reports, attendance, messaging, and class rosters. Mobile behavior is route-specific and not governed by one responsive-table contract.

### Empty/loading/error states

- Empty: `MemberEmptyState`, `EmptyIllustration`, admin empty panels, schedule empty state.
- Loading: shared Skeleton, route spinners, query placeholders, and progress indicators.
- Error: root error boundary, route error cards, toasts, form errors, payment result states.
- Missing: one cross-role state contract defining title, explanation, primary/secondary recovery, announcement, and retry behavior.

## Duplicate and one-off components

Likely duplicates:

- Public header, wordmark, locale switcher, and CTA groups across auth, marketing, schedule, legal, Instagram, and download.
- Metric cards in admin pages and Studio Pulse.
- Empty-state containers across member/admin routes.
- Button recipes split between shared `Button`, CSS utilities, and raw route classes.
- Card/panel surface recipes repeated in CSS.
- Direction-aware value formatting implemented both through bidi helpers and local `dir` attributes.

One-off systems:

- Instagram editorial landing.
- Download/update landing.
- App marketing page and its 933-line CSS file.
- Yoga Lina promo landing/banner.
- Delivery monitoring console.
- Concierge command center and previews.

These one-offs are legitimate product surfaces, but they should consume shared foundations and shell rules.

## Hardcoded values and dead/unused definitions

- Hardcoded literals remain extensive; the complete counts above are the authoritative inventory.
- `--color-blue` currently equals sand, making the name semantically incorrect.
- Tailwind theme declarations such as `--radius-sm: var(--radius-sm)` and `--color-navy: var(--color-navy, ...)` are self-referential and obscure source ownership.
- Legacy aliases (`brass`, `ink`, `powder`) coexist with current semantic names.
- Local app-marketing and Instagram palettes repeat core brand values under new names.
- Prior documented radius values no longer exactly match current token resolution.
- Dead-code certainty requires a production coverage trace; static search alone cannot prove a CSS selector unused. Treat unreferenced or compatibility selectors as candidates, not confirmed deletions.

## Inventory conclusion

The current UI has a real design system in practice, but it is implicit and duplicated. The next system should preserve the brand foundation and best components while reducing token aliases, route-local palettes, arbitrary lengths, breakpoint variants, and raw button/card recipes.
