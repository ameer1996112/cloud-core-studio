# Member account premium polish design

## Goal

Make the authenticated member account page feel calm, premium, and intentionally composed on phones and desktop browsers. Improve the visual hierarchy and spacing of every section, with particular attention to the legal links and account-deletion-request area, without changing member-facing behavior or backend contracts.

## Scope

The implementation is limited to `/member/account`, its directly related member styles, and focused regression coverage. It preserves:

- profile and personal-concierge data flow;
- sign-out behavior;
- privacy, terms, and support destinations;
- deletion-request submission, confirmation, focus, loading, success, error, retry, and support behavior;
- localization and RTL/LTR behavior;
- Supabase and server-function contracts.

No new design system, navigation pattern, copy change, payment change, deletion behavior, or unrelated member-page redesign is included.

## Visual direction

Use a refined editorial composition rather than a collection of heavy cards. The page should feel spacious and structured through typography, grouping, subtle surfaces, and disciplined rhythm.

- Keep the page in a centered, controlled-width column on desktop.
- Retain the existing navy, ivory, sand, gold, and slate token palette.
- Use gold as a restrained divider and focus accent, not long-form text.
- Use existing typography and radius tokens.
- Prefer subtle borders and low-depth shadows over visually heavy boxes.
- Preserve clear text alignment using logical properties in RTL and LTR.

## Page composition

### Page introduction

Keep the existing member introduction component and data. Refine its spacing relative to the first section so the introduction reads as a deliberate opening rather than a disconnected header.

### Account sections

Profile details, personal preferences, session, and privacy remain separate semantic sections. Give every section consistent vertical rhythm and a clear relationship between its heading, explanation, controls, actions, and feedback.

On desktop, editable profile fields retain a two-column grid where content permits. On mobile, all fields and actions use one column with at least 44-pixel touch targets and safe wrapping.

### Save actions

Keep the existing production-safe save buttons and disabled-state logic. Their action rows retain explicit separation from the preceding fields, stable button sizing, readable disabled contrast, and persistent status placement.

### Session action

Present sign-out as a secondary account action. It remains discoverable and full-width on compact mobile layouts without visually competing with profile-saving actions.

### Legal actions

Privacy, Terms, and Support remain three independent links. They must not touch or resemble a segmented control.

- Desktop: balanced three-column layout.
- Mobile: single-column layout.
- Use the shared spacing token `--space-3` between controls.
- Preserve visible focus, hover, minimum touch-target size, and logical alignment.

### Deletion-request area

Place the existing deletion-request controls inside a restrained warning panel using a warm, low-contrast tinted surface. The panel communicates risk through hierarchy, copy, iconography, and the final destructive action—not red color alone.

Inside the panel:

1. The explanatory copy appears first.
2. The optional deletion-reason field has sufficient spacing and a readable label.
3. The verified next-step explanation remains visible.
4. Persistent success or error feedback remains in context.
5. The deletion-request button sits in its own action row with clear separation from the textarea and explanatory copy.

The destructive button keeps the existing label, confirmation dialog, loading and duplicate-prevention behavior. No request is described as a completed account deletion.

## Responsive behavior

At widths up to 640 pixels:

- sections use compact but generous horizontal padding;
- form fields, legal links, session action, and deletion action use a single column;
- long Hebrew and Arabic text wraps without clipping;
- the fixed member navigation does not obscure the final panel or feedback;
- the page has no horizontal overflow.

At tablet and desktop widths:

- the main column remains intentionally bounded;
- profile fields may use two columns;
- legal actions use three equal columns;
- the deletion panel remains readable and does not stretch excessively.

## Accessibility

- Preserve semantic section headings and navigation labeling.
- Maintain visible shared focus styles.
- Retain keyboard operation and at least 44-pixel touch targets.
- Preserve deletion dialog focus management and live-region behavior.
- Ensure warning and destructive meaning are communicated through text and semantics, not color alone.
- Validate contrast using real content and existing accessible tokens.
- Respect reduced-motion behavior; this polish does not require new motion.

## Implementation boundaries

Expected production files are limited to:

- `src/routes/_authenticated/member/account.tsx` when a semantic wrapper or class is required;
- `src/styles/member.css` for scoped account-page presentation;
- existing tokens only, unless an accessibility defect proves a missing token;
- focused unit or browser tests for the account-page layout contract.

Business logic remains in the route and existing server functions. Styling must not hide or duplicate mutation logic.

## Verification

- Add a focused regression assertion for legal-link spacing and deletion-panel hierarchy.
- Run focused member-account and cascade-contract tests.
- Run lint and the production build.
- Authenticate only against local Supabase using the fake member fixture.
- Visually inspect Hebrew, Arabic, and English at representative mobile and desktop widths.
- Assert no horizontal overflow and verify 44-pixel touch targets.
- Capture representative before/after evidence without production data.
- Reset the local fixture after verification.

## Success criteria

- The account page reads as one coherent premium editorial experience.
- Adjacent actions never visually collide.
- The deletion-request area is clearly separated, calm, and appropriately cautionary.
- Primary, secondary, and destructive actions are visually distinct.
- Mobile and desktop layouts are balanced and readable.
- RTL and LTR layouts remain correct.
- No account, deletion, authentication, localization, or backend behavior changes.
