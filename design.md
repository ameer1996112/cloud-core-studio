# Active visual brief — Cloud & Core neutral member candidate

## Neutral application redesign — September 7, 2026

The active visual direction for the member application and authentication surfaces is a
near-white/white/charcoal boutique-studio interface. Light uses `#F9F9F9`, `#FFFFFF`,
`#F0F0F0`, and `#202020`; dark uses `#111111`, `#191919`, `#222222`, and `#EEEEEE`.
Warmth comes from the approved studio photograph, not cream, blue, or gold panels.
The existing Assistant/DM Sans/IBM Plex Sans Arabic font setup, full approved logo artwork,
five member destinations, OS-driven light/dark behavior, and all route/controller contracts
remain authoritative. Primary actions are compact charcoal controls; gold is not used as a
filled action or information hierarchy.

Home, schedule, class details, bookings, packages, profile, authentication and recovery use
the shared neutral member shell. The home no-booking state uses one bounded approved studio
image; utility routes remain information-led. Dates, class metadata, balances, plan facts and
actions stay in meaningful DOM order and remain content-sized at mobile and desktop widths.
The implementation is a local review candidate only. It does not authorize production writes,
deployment, commits, or visual approval.

## Historical A1 member completion — September 7, 2026

The following A1 visual direction is retained as historical implementation context only. Its
navy/gold/serif/pill presentation is superseded by the neutral candidate above.

The owner has now authorized finishing the member application. The A1 visual direction extends to My Bookings, Packages and Profile, superseding earlier deferrals of these three routes only. Existing home, schedule, class detail and auth/recovery remain the reference within the app. Admin/instructor and public marketing routes are outside this member completion.

Bookings use the shared time/identity/action row with explicit attendance and waitlist labels; optional concierge guidance follows the reservations. Packages pair a compact actual wallet summary with equal-weight factual plan comparisons and grouped history. Profile uses a compact identity heading, editable details and a quieter privacy/session rail. Mobile keeps the same DOM reading order. Colors, script-specific type, focus and navigation follow A1. There are no new image assets or decorative photographs on utility screens.

Authentication, permissions, callbacks, business rules, prices, credits, payment handoff, localization and saved theme behavior remain authoritative. This is an implemented review candidate, not visual approval or authorization to deploy. Evidence: `docs/design-review/member-completion/REPORT.md`.


**Active September 7, 2026: [AURA_IMPLEMENTATION_TASK.md](AURA_IMPLEMENTATION_TASK.md).** Applies to member home, schedule, their existing class-detail presentation and shared member navigation. The exact selected reference is https://www.aura.build/design-systems/premium-app-ui. Implementation remains a candidate for owner visual review.

For these screens, A1 supersedes conflicting visual requirements from Quiet Strength V1, Studio Editorial V2, V2.1, production refinement and CLOUD_CORE_VISUAL_RESET.md, including their preserved card shells, overlaps, content order, typography and navigation treatment. The original deferral of auth/recovery, bookings, packages and profile is superseded by the authorized A1 extensions in this file. All security, business, accessibility and engineering rules below remain binding.

## Observed reference

The actual iframe is **Luma Grand Suite — Premium iOS Hotel UI**: three dark mobile hotel screens. Exposed source and rendered measurements are private in `docs/design-reference/aura-premium-app-ui/`. The gallery DESIGN.md incorrectly describes driving routes and contradicts the preview; it is not used to infer styling. Download buttons require sign-in/Pro; the public iframe HTML is exposed in srcdoc and was inspected normally.

Measured app content: 24px gutters; 30px serif greeting, 26px serif featured title, 23px section title; sans-serif 14–15px supporting copy; 321×324 featured image with a bottom contrast gradient and 30px corners; 22px secondary-card corners; 40px filter pills; 44px icon controls; 72px five-item navigation. The reference contains only English mobile/dark layouts. White device-showcase canvas and phone hardware are not application UI.

## Cloud & Core adaptations

| Reference | Application implementation |
| --- | --- |
| Full photographic discovery card with bottom title/metadata | Actual upcoming class, genuine room photo, title/time/status/action in one image region; cancellation text directly below |
| Smaller discovery objects | Shared SessionRows for real recurring classes, without repetitive or unsupported service photos |
| Compact filter pills | Existing date scopes and search; advanced filters in an accessible disclosure |
| Detail image and grouped supporting information | Existing class-detail dialog, scrollable reading surface with retained actions |
| Five-item navigation | The five actual localized member destinations with a clear active icon and safe-area clearance |

Approved navy #0B1D3A, ivory #FAF7F2 and restrained gold #D4AF6A replace the reference's black/hotel colors. Light mode and the centered 1180px desktop two-column layout are explicit adaptations, not claimed reference variants. Gold is used for the featured action and selected date, never small text on ivory. No blur layers, fake hardware, hotel content, ratings or new business metrics.

English display roles use the reference's serif character via system Georgia; UI uses the existing self-hosted DM Sans. Hebrew uses existing Heebo Phase One, Arabic IBM Plex Sans Arabic; their scale/weight carries hierarchy without negative script tracking. Font rendering must be checked, not assumed. Original logo artwork is unchanged. Hero crop is 50% 80%, not mirrored in RTL.

## Preserved contracts and review

Keep auth/recovery, permissions, routes, data queries, server contracts, prices, credits, eligibility, booking/cancellation/waitlists, payments, notifications and stored locale/theme choices. Schedule filter calculations are moved intact into a presentation component; query/auth/promotion/mutation ownership stays in the controller. Detail callbacks and guards remain unchanged. No production writes, auth bypass, real bookings/payments, messages, commits, pushes, hosted previews or deployments.

Before/after screenshots and current checks belong under `docs/design-review/aura-a1/`; fixtures are labeled and excluded from production routing. Passing checks does not confer visual approval. The original home/schedule/detail review gate is superseded by the authorized extensions; stop after the member completion candidate for owner review.

## A1 extension — authentication and recovery (September 7, 2026)

The owner authorized extending the accepted member direction to sign-in/recovery. This extension originally covered auth/recovery only; the later member-completion amendment above now also authorizes bookings, packages and profile. Authentication uses the same genuine rounded photo treatment with the current state heading in its lower reading area, an unboxed form, restrained gold primary action, existing multilingual type and compact language controls. Desktop pairs the large photographic heading with a narrow form; mobile stacks a 216px content-growing photo region and form, with submit visible at 390×844. This is an adaptation: the inspected Aura reference did not contain authentication screens.

A shared presentation-only AuthFrame covers sign-in, registration, forgot/check-email and validated recovery/invalid-link states. Token validation, sessions, password requirements, consent defaults, locale persistence and redirects stay in their route controllers. No wallpaper/floating-form-card requirement from older briefs applies. Use the existing navy/ivory theme behavior; do not reset saved preferences. Scope evidence: docs/design-review/aura-auth-a1/.

---

## Historical visual specifications (superseded)

# Cloud & Core — Studio Editorial

Application design specification · Version 2.0
Prepared September 6, 2026. Proposed implementation candidate, **not owner visual approval or a new brand book**.

This root implementation brief records the owner's supplied Studio Editorial V2 specification. It supersedes Quiet Strength visual direction only. The previous root document is archived at `docs/design-review/v2/previous-design-v1.md`. Existing security, engineering and business rules remain binding. The complete owner-supplied specification in the task is authoritative where this implementation digest is shorter.

## Decision and scope

Replace the rejected composition, not merely its colors. Build an authentic photographic studio entrance, an image-led booking pass, substantial multilingual typography, and compact member information. This is an operational application, not a marketing funnel.

Phase 1 only: authentication and all existing states, member home, necessary shared foundations/components, responsive navigation. Schedule, bookings, packages, profile, admin and instructor redesigns wait for owner visual review.

Rejected screenshots expected under `docs/design-review/v2/rejected/` are diagnostic references, never targets or production assets. Their absence does not block the explicitly specified layout. Aura is optional composition inspiration; do not claim its preview was reviewed when unavailable, or copy its images, services or business text.

## Preserve the application

Inspect the actual stack, routing, styles, fonts, assets, locale persistence/defaults, theme preferences, auth/recovery, data hooks and native wrapper. Preserve authentication/session and recovery-token checks, roles, authorization, route guards, API contracts, queries, schema, prices, plans, credits, eligibility, booking/cancellation rules, waitlists, payments, notifications and destinations. Retain validation and errors. Do not translate or overwrite stored business content.

No production writes, test accounts, bookings, cancellations, payments or messages. No auth bypass, pushes or deployment. Preserve unrelated local edits. Use a safe local workflow. An isolated component fixture excluded from production builds is allowed for visual review; label evidence as fixture and authenticated E2E NOT TESTED.

## Authentic assets and palette

Only approved full transparent lockups: `Cloud_Core_logo_transparent_navy.png` and `Cloud_Core_logo_transparent_ivory.png`. Preserve full artwork, proportions, descriptor and clear space. No crop, recolor, filter, reconstruction, screenshot extraction or invented variant. One foreground logo per screen region; the physical studio sign in a photograph is part of the room.

Logo starting widths: mobile auth 150–180px, desktop auth 190–220px, member header 108–132px. Navy on light; ivory on dark photography. Only genuine approved Cloud & Core studio photography. Keep architecture, fabric color and room facts; crop/compress only. Do not mirror for RTL. Record focal positions and actual delivery. Reserve media dimensions and eagerly load the initial photo. Report missing assets honestly.

Palette: Deep Navy #0B1D3A, Soft Ivory #FAF7F2, Warm Gold #D4AF6A, Powder Blue #B7CCE6, Warm Sand #E8DFD1, Slate Blue Gray #6F7A8C. Gold is a small finishing detail, never small informational text on ivory. Proposed derivatives: reading surface #FFFEFB, secondary ink #526078, control border #7C8493, navy hairline at 13%. Preserve semantic status colors and existing dark preference behavior.

Integrate existing theme tokens. Four layers: ivory canvas, authentic photography, warm reading surface, compact navy membership pass. Control radius12px, panel/media24px, small8px. One soft navy elevation on auth and booking panels; no nested frames, glass, noise, metallic text or artificial luxury effects.

## Typography and rhythm

Retain suitable existing licensed fonts with a reason; Manrope/Heebo/IBM Plex Sans Arabic are candidates, not mandates. The logo supplies serif contrast; do not use a Latin serif as the Hebrew design solution. No negative Hebrew/Arabic tracking. Comfortable script-specific line heights and tabular figures.

Mobile/desktop starting sizes: auth heading30–32/38–44; greeting28–30/36–40; section21–23/24–26; featured title23–26/28–30; featured time32–36/40–44; row title18–20/20–22; body/fields/buttons16; metadata14/14–15; bottom nav12–13. Most headings500–600, not an all-bold page.

Spacing scale4,8,12,16,20,24,32,40,48,64. Mobile gutters20; desktop max1180–1240 and32–48 outer gutters. Section gaps24–32. Inputs52–56 high, primary52–54, small interactions at least44×44 target. Persistent labels, visible boundaries, readable values and errors. Navy primary, usable quiet secondary. No input motion.

## Authentication — studio entrance

One continuous full-width photograph, at least viewport height when content permits, behind a bounded opaque inset panel. Never a beige half-page next to a photo.

Desktop1440×900: panel430–460 wide, internal32–40, outer clearance56–72; position inline-end (left in RTL, right in English). Leave the studio visibly open. Ivory full logo in the open upper photo region. Locale control outside main form sequence. Use a localized navy scrim for logo contrast, not a muddy blanket.

Mobile390×844:20px photo-visible gutters, ivory logo above the panel, panel begins around170–200 from top,20–24 internal padding. Keep photo above AND around the panel for its entire natural height. Navy fallback. Email, password and submit visible in the initial keyboard-closed viewport; secondary/footer content may scroll. No fixed/clipped height or tiny text to fit.

Keep all sign-in, signup, recovery, pending, errors, check-email, password visibility, paste/autocomplete, locale persistence and footer/schedule destinations. Recovery-request success must never unlock the password-change form without actual validated recovery session. Content grows naturally for languages, validation, short windows and enlarged text. Reduce decorative space at short heights; focused controls remain scrollable. No member bottom nav on auth.

## Member home

Ivory shell; compact header and greeting. Mobile order: next booking (or honest no-booking), membership, available classes/full schedule, studio message and relevant support. Normal announcements follow tasks; urgent operational content may lead.

Desktop about8/4 with28–32 gap. Booking and available rows in main column; membership and utility actions in secondary, shared top baseline. Avoid full-browser rows with distant actions.

### BookingPass

Real HTML with real data and existing actions. Desktop: full-width photo230–280 high, information panel inset16–20 and overlapping media lower edge24–32 using normal-flow negative margin. Group identity/instructor/room, time/date/duration, status/actions. Title28–30, time40–44. Action opens existing booking management; calendar secondary. Status explicit and secondary.

Mobile: photo140–170 high remains visible; light reading pass overlaps16–20. Tight time/date and title/metadata, then action. Ordinary component target310–360 but grow to retain essential content. Policy stays accessible and accurate; no invented deadline/credit promise. Do not place a long policy paragraph between class title and action.

### MembershipPass

Desktop compact navy220–270 minimum content height. Distinct actual plan name, remaining entitlement and expiry. Mobile compact row/block88–112 target with wrapping and expiry retained; clear existing details link. No invented denominator, usage percentage, streak, countdown or scarcity. Unlimited needs actual entitlement wording; never infer unlimited from null/zero. Stored plan names remain authentic.

Loading: honest placeholders, never fake zeros. Error: explicit retry. No booking: schedule discovery without fabricated class. No membership: actual state/relevant route without new eligibility rules. Waitlisted/cancelled/completed preserve status; never label them confirmed.

At390×844 aim for greeting, booking action and membership before first scroll; never hide data to achieve target.

## Shared class rows and navigation

One shared presentation system with existing adapters/actions. Desktop time column88–104, flexible identity/metadata, nearby action140–160, ordinary row100–120 high. Mobile time/title first, metadata and nearby action112–144 target; allow growth. Quiet dividers. No invented/repeated service imagery or fabricated scarcity. Preserve details/book/waitlist/manage semantics and avoid nested interactions.

Existing five localized destinations: Home, Schedule, My Bookings, Packages, Profile. Preserve notification and sign-out behavior. Desktop header80–88; mobile72–80 plus safe area, genuine full logo. Mobile bottom nav fixed to viewport, ivory raised surface/top separator, sand selected state, readable labels/icons. Reserve actual nav height plus safe area once and gap. Test at multiple scroll positions; full-page screenshot bar position is not evidence of a defect.

## Language, accessibility, performance

Hebrew first, then Arabic and English. Preserve default/saved locale/theme. Logical properties, bdi or explicit direction for mixed names/times/emails/currency. Never mirror photos/logos/non-directional symbols. Existing locale and studio timezone formatting. Stored single-language text retains content and language/direction metadata; report missing translations.

WCAG2.2 AA checks: normal text4.5:1, qualifying large3:1, visible controls/focus, keyboard labels/errors/dialogs, no obscured focus.44×44 is project target, not a claim about every WCAG minimum.200% text,320px reflow, long names/titles, Arabic shaping, no hover-only information.

Transitions140–220ms for state/color; reduced motion honored. No entrance delays, scroll hijacking, parallax, autoplay video, decorative animation packages, cursor effects or physics. Avoid layout shifts and duplicate fonts; measure performance before claiming scores.

## Workflow and delivery gates

Primary installed skill: redesign-existing-projects. Its scan/diagnose/fix method applies; app-specific composition, genuine assets, scripts and business rules override generic font swaps, icon swaps, motion, decoration and marketing formulas. Optional high-end-visual-design/minimalist-ui selectively, never whole bundle installation.

Inspect, capture accessible before, briefly report verified plan, implement real existing app, inspect rendered images and correct concrete failures. Gate new auth inset-photo composition; photo-led booking overlap on mobile/desktop; identifiable task data/action; contrast/readable UI; full logo; no clipping; multilingual direction; preserved flows; actual engineering checks; honest scope.

Capture viewport screenshots at100% zoom: auth/home × Hebrew/Arabic/English ×390×844/1440×900 =12 after, plus accessible before. Identify locale, viewport, theme and fixture status; private docs, never public assets. Also check360×800,430×932,768×1024,1024×768,1440×700,320-wide,200% text, focus, short/keyboard viewport where supported, multiple scroll positions, long content, loading/empty/error and existing dark mode. Browser emulation is not a native-device test.

Run configured build, lint, typecheck and relevant tests. Smoke untouched routes affected by shared changes. Record commands/results, pre-existing/new failures, image paths, visual gates, fixtures, missing assets/references and NOT TESTED flows at `docs/design-review/v2/REPORT.md`. Stop after candidate/evidence for owner visual review. No extension to other routes, push or deployment.

Primary references: https://raw.githubusercontent.com/Leonxlnx/taste-skill/main/skills/redesign-skill/SKILL.md ; https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html ; https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html ; https://www.w3.org/International/articles/inline-bidi-markup/ . Optional visual reference: https://www.aura.build/templates/non-j-aurai-plutot-29 . No preview matching or visual approval is claimed.


## Scoped V2.1 presentation amendment — September 7, 2026

Status: implemented candidate for owner visual review; Phase 1 is **not visually approved**. The owner-authorized [V2.1 refinement](docs/design-review/v2.1/V2_1_VISUAL_REFINEMENT.md) supersedes only the typography, color hierarchy and local component finish described above. V2 composition, routes, accessibility, security and business requirements remain binding. This does not restore Quiet Strength V1.

Phase 1 uses display/utility pairs: Frank Ruhl Libre / Assistant for Hebrew, Noto Naskh Arabic / IBM Plex Sans Arabic for Arabic, and Bodoni Moda / DM Sans for English. Display weight 500 is limited to the auth/recovery title and member greeting; controls and class information retain utility typography. Local WOFF2 subsets and SIL OFL notices are included.

The scoped light palette uses porcelain #F5F1EA, surface #FFFCF7, subtle #EAE2D7 and ink #142131. BookingPass keeps its photo and overlap but its information panel becomes the principal ink surface; MembershipPass becomes a quieter subtle surface. Dark mode retains preference handling with #101925 canvas, #182537 surface and restrained #C7AE87 actions. Membership metadata uses primary ink because secondary #626975 on the subtle surface measures only 4.30:1. Controls use 11px radii and major panels 18px, without changing navigation architecture.

Evidence and limitations: [V2.1 report](docs/design-review/v2.1/REPORT.md). Home captures are isolated local component fixtures, not authenticated member tests. This amendment does not authorize the remaining-route redesign or deployment.


## Production-informed Phase 1 refinement

The owner rejected the V2.1 colors and overall presentation and requested a new candidate grounded in the current production application. This instruction supersedes V2.1's mandatory serif pairings and porcelain/champagne treatment for this candidate. Authentication/recovery, BookingPass, MembershipPass, class rows and five-destination navigation remain the scope. All existing security, business, language and theme-preference rules remain unchanged.

The public production auth page was inspected directly at https://cloudandcorestudio.com/auth. The revised candidate uses production navy #0B1D3A with crisp #FCFDFF reading surfaces, #F3F6FA canvas and restrained #E4EDF7 powder-blue grouping. Headings use the existing script-appropriate sans families: Assistant, DM Sans and IBM Plex Sans Arabic. The genuine logo and studio photograph are unchanged. Booking details use a compact desktop band, with responsive mobile grouping and retained photography; class-row actions stay adjacent to their content.

This remains a proposed local visual candidate, not owner-approved or deployed. Production member home requires authentication and was not accessed; home review uses isolated local fixtures. See [production comparison and report](docs/design-review/production-refinement/REPORT.md).
