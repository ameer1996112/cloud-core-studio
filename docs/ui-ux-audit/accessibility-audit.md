# Accessibility audit (WCAG 2.2 AA target)

## Evidence and limitations

Final authenticated evidence covers EN/HE/AR, mobile/tablet/desktop, intercepted mutation states, exact request counts, headed keyboard interaction, 36 axe scans, and actual Chrome 200% zoom. VoiceOver alone remains pending and is not inferred from automation.

Manual checks used a headed Chrome browser, real Tab/Shift+Tab/Enter/Space/Escape input, visible focus, and actual browser zoom. `@axe-core/playwright` completed 36 scans with zero violations at every impact level. VoiceOver was not operated.

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

- **P2-02 package payment:** The server-provided amount, `BidiValue` isolation, persistent assertive recovery, loading/disabled state, exact duplicate counts, headed keyboard flow, EN/HE/AR, responsive layout, axe, and real 200% zoom passed.
- **P2-03 deletion request:** The labelled Radix alert dialog, focus trap/restoration, pending protection, exact duplicate counts, persistent focusable result, polite/assertive live regions, retry/support recovery, EN/HE/AR, responsive layout, axe, and real 200% zoom passed.
- **Remaining evidence gap:** Manual VoiceOver output only. It remains a full audit-closure criterion and is not replaced by semantics, axe, or keyboard evidence.

## Exit criteria

Run axe against each public route and authenticated route state; complete VoiceOver keyboard/screen-reader passes for dialog, language menu, notifications, booking confirmation and cancellation; verify 200% browser zoom; and resolve AX-01 through AX-04.
