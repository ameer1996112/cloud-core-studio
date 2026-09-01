# Accessibility audit (WCAG 2.2 AA target)

## Evidence and limitations

Final authenticated loaded-data evidence is available for English at 390px. VoiceOver, actual 200% browser zoom, and the complete authenticated dialog keyboard matrix remain unverified and must not be inferred from this addition.

Manual checks used the live accessibility tree, keyboard Tab, visible focus, semantic snapshots, code review and 320px layout checks. The direct `axe` CLI could not initialize in this restricted environment (two 30-second attempts produced no report), so **no automated-violation count is claimed**. VoiceOver/NVDA and authenticated-dialog checks have not yet been executed with the available safe local member fixture.

## Findings

| ID    | Level       | Evidence                                                                     | Finding and recommendation                                                                                                                                                                                                                                                         |
| ----- | ----------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AX-01 | P1          | `src/styles/theme-session.css:697`; `src/styles/base-components.css:112-115` | Global focus is a 3px, 18%-opacity gold shadow with no contrasting outline. On ivory/white it is unlikely to meet WCAG 2.4.7 / 1.4.11 non-text contrast. Preserve gold as the brand color but use a 2px navy outline plus 2px gold outer ring, at least 3:1 against both surfaces. |
| AX-02 | P2          | `src/components/app-shell/AppShell.tsx:402-465`                              | The language control is a hand-rolled menu: it uses `role=menu`/`menuitemradio`, but no Escape/arrow-key handling, roving tabindex, or focus restoration. Replace with a tested menu/listbox primitive or implement the APG keyboard contract.                                     |
| AX-03 | P1          | `public-class-detail-en-390x844.png`; `ClassDetailSheet.tsx:647-670, 658`    | Class location is visually and semantically truncated (“At Cloud & Core…”). Essential booking information must be fully available without hover; remove `truncate` for location or give the full address a labelled expandable disclosure.                                         |
| AX-04 | P2          | `src/routes/__root.tsx:48-98`, `src/routes/_authenticated/route.tsx:27-68`   | Local source error/404 copy contains hard-coded Hebrew. Production currently served English correctly, creating a parity risk. All failure copy must come from `t()` and retain `lang`/`dir`.                                                                                      |
| AX-05 | Observation | Live snapshots of landing, auth, schedule, support                           | Skip link, landmark-like regions/navigation, headings, labelled auth fields, required attributes and accessible class-card names are present. Auth errors use `role=alert`; auth/loading uses polite live regions.                                                                 |
| AX-06 | Observation | `src/styles/public-pages.css:863`, `member.css:2363`, `auth.css`             | Reduced-motion overrides exist for several member/public effects. Verify the compiled stylesheet covers every keyframe before sign-off.                                                                                                                                            |

## Manual results

- Keyboard: landing and checkout expose a visible **Skip to content** link; its 390px focus state is captured in `checkout-en-focus-390x844.png`.
- Semantics: guest class cards announce class, time and “Details & booking”; the detail sheet provides a labelled close button.
- Forms: auth and checkout have labels/required state; checkout plan radios are inside labels and terms uses a checkbox.
- Dialogs: Radix `Dialog` is used for class detail and cancellation. The guest detail close control worked live; focus trapping and Escape need authenticated/dialog-specific verification.
- Language: live HE, AR and EN switching updated the page copy and direction. Local typography imports Assistant (Hebrew/Latin) and Noto Sans Arabic with 400/600/700 weights.
- Touch: member bottom tabs are at least 52px high in `AppShell`; public controls inspected were generally at least 44px.

## Milestone 2 additions

- **P2-02 package payment:** `PaymentMethodSheet` displays the server-provided amount without client-side arithmetic and uses `BidiValue kind="currency"` for mixed-direction currency isolation. Its payment-session failure is an in-context assertive message rather than toast-only feedback; the primary action exposes loading and disabled state while a checkout session is pending. These are implemented/source-asserted; payment mutation states have not been manually or automatically exercised in this release candidate.
- **P2-03 deletion request:** The destructive action opens a labelled Radix alert dialog, whose cancel and submit actions are designed for keyboard operation. Submission has repeat protection. The persistent result panel receives programmatic focus; submitted/already-open states use a polite live region and failed submission uses an assertive alert plus the existing support route. It accurately says “request,” never “account deleted.” These are implemented/source-asserted; the authenticated dialog/result matrix has not yet been manually verified.
- **Remaining evidence gap:** A safe local member session now exists and authenticated route access is verified, but VoiceOver/NVDA output, a real keyboard pass through the authenticated dialog, automated axe, and 200% browser zoom remain unexecuted. This is not claimed as complete evidence.

## Exit criteria

Run axe against each public route and authenticated route state; complete VoiceOver keyboard/screen-reader passes for dialog, language menu, notifications, booking confirmation and cancellation; verify 200% browser zoom; and resolve AX-01 through AX-04.
