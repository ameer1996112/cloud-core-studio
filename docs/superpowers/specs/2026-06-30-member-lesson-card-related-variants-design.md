# Member Lesson Card Related Variants Design

## Goal

Make the lesson cards on the member home page and member lessons/schedule page feel premium, clean, and related without being identical. The home page should sell the next best action. The schedule page should help members compare lessons quickly.

## Scope

In scope:

- `/member` lesson surfaces:
  - featured/recommended lesson card
  - recommended list cards
  - upcoming lesson mini cards if they use the same visual system
- `/member/schedule` lesson list cards
- Shared lesson card component structure, visual variants, responsive behavior, RTL/LTR alignment, and card image treatment.
- Class detail sheet image/card polish is limited to reusing the same image rules if the existing card component already feeds it.

Out of scope:

- Database schema changes.
- Booking, waitlist, payment, receipt, auth, RLS, or notification logic.
- New lesson data model.
- Replacing the whole member app shell.
- Real browser deployment work.

## Design Direction

Use one shared card system with related variants:

- Home page: premium editorial cards that feel like invitations.
- Schedule page: scannable cards that make comparison easy.

The two variants share typography, chips, image rules, CTA styling, state colors, and localization behavior. They differ in density, hierarchy, and image prominence.

## Home Page Design

The home page should show one primary lesson invitation when there is a recommended or next action. It should not look like a giant schedule row.

Home featured card:

- Balanced two-column layout on desktop/tablet.
- Stacked layout on mobile.
- Image panel should be composed and uncropped enough to show the lesson clearly.
- Details panel should avoid large empty whitespace.
- Title, chips, instructor/studio, time, duration, and spots should be visible without visual clutter.
- One dominant CTA based on state: book, renew credits, manage booking, or join waitlist.
- Secondary text should be minimal and operational, not marketing copy.

Home recommended list cards:

- Smaller than the featured card.
- Use thumbnails or restrained image panels.
- Show only essentials: time, title, instructor/location, spots, CTA.
- Keep the rhythm tight so the home page does not feel repetitive.

## Schedule Page Design

The schedule page should prioritize scanning and comparison.

Schedule cards:

- Consistent list-card structure for every lesson.
- First lesson of a day may be slightly emphasized, but not radically different.
- Stable image thumbnail/panel that does not crop the subject awkwardly.
- No huge blank areas.
- Time and availability should be easy to compare at a glance.
- Title and CTA should have clear hierarchy.
- Metadata chips should wrap cleanly and never collide with image or CTA.
- Keep all cards keyboard-accessible as real buttons.

## Image Rules

- Use lesson images as inspection assets, not decorative backgrounds.
- Avoid full-card dark overlays that make cards feel heavy.
- Use `object-fit: contain` or careful focal-position rules where cropping damages the subject.
- Keep brand mark/art badges away from important image content.
- If a lesson image is unavailable, use the existing generated art tile system as a controlled fallback.
- Do not use duplicate-looking photo cards repeatedly without variant or density differences.

## RTL/LTR Rules

- Hebrew and Arabic content stays RTL with right-aligned labels, titles, metadata, and CTA rows.
- English content stays LTR with left-aligned labels, titles, metadata, and CTA rows.
- Time, duration numbers, phone-like values, and technical tokens remain stable and readable.
- Mixed Hebrew/English titles continue using the existing bidi helpers.

## Component Architecture

Keep one source of truth for lesson card behavior:

- `VisualClassCard` remains the shared renderer.
- It should expose clear variants:
  - `homeFeature`
  - `homeList`
  - `scheduleList`
  - `scheduleLead` for the first card in each day, using subtle emphasis only
- Existing `hero`, `standard`, and `compact` variants can be mapped or renamed internally if that keeps the change small.
- `ClassArtTile`, image resolution helpers, state/CTA logic, and localization helpers stay shared.
- Route files should choose the right variant, not duplicate card markup.

## Data Flow

No data contract changes are required.

Cards continue using:

- class title and localized program metadata
- `starts_at`
- `duration_minutes`
- capacity and booked count
- instructor
- room/studio location
- image URLs and generated asset fallbacks
- derived booking/waitlist/credits state

## State Handling

Every visible card state must remain supported:

- booked
- waiting
- available
- almost full
- full
- low credits
- package required
- cancelled/closed

The state should affect CTA, small badges, and subtle border/accent treatment. It should not completely change the layout.

## Responsive Behavior

Target checks:

- Mobile 390px: cards stack cleanly, no text overlap, no horizontal overflow.
- iPad 820px: home feature has enough breathing room, schedule cards stay scannable.
- Desktop 1440px: cards do not become stretched, sparse, or overly wide.

Use stable dimensions and responsive constraints for image panels, CTA areas, chips, and metadata rows.

## Accessibility

- Each lesson card remains a real `<button>` or accessible link-like button.
- Focus state must be visible.
- Images used decoratively should be `alt=""`; meaningful class image context should be represented by visible text.
- CTA meaning must be present in text, not only icon.
- Cards should be reachable and usable with keyboard.

## Testing Plan

Automated:

- `bun run lint`
- `bun run build`
- `bunx tsx tests/unit/i18n.test.mjs`
- Any existing lesson-card helper tests if present.

Visual QA:

- `/member` in Hebrew, Arabic, English.
- `/member/schedule` in Hebrew, Arabic, English.
- Mobile 390 x 844.
- iPad 820 x 1180.
- Desktop 1440 x 900.

Check:

- no cropped/hidden lesson subject
- no CTA/image/badge overlap
- no excessive whitespace
- no horizontal overflow
- no console or hydration errors
- home and schedule feel related but not identical

## Acceptance Criteria

- Home page lesson card feels premium and intentional.
- Schedule cards are clean, compact, and easy to scan.
- Home and schedule share a coherent card system but use different density.
- Images are not awkwardly cropped.
- Hebrew/Arabic/English layouts are correct.
- No booking/payment/auth/schema logic is changed.
- Build passes.
