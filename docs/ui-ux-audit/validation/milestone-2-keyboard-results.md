# Milestone 2 keyboard verification

Automated input used Playwright keyboard events. The manual pass used a headed Chrome for Testing window on macOS and real keyboard input through the browser UI.

| Route/state | Language | Action | Expected | Actual | Pass/fail |
| --- | --- | --- | --- | --- | --- |
| Packages | EN | Tab to package action; Enter | Open payment sheet | Opened; initial focus was the first payment option | Pass |
| Payment sheet | EN | Tab through methods/actions | Logical contained order | Cash → secure online payment → cancel → continue | Pass |
| Payment sheet | EN | Escape | Close and restore trigger focus | Closed; focus returned to the exact package button | Pass |
| Payment pending | EN | Rapid pointer, Enter, and Space activation | One request per isolated scenario | Exactly one classified mutation in each scenario | Pass |
| Payment error | EN | Tab/Enter retry | Retry once | One additional request; feedback remained in context | Pass |
| Account | EN | Tab to deletion request; Enter | Open named confirmation dialog | Opened; initial focus was Cancel, not destructive submit | Pass |
| Deletion dialog | EN | Tab and Shift+Tab | Focus remains trapped | Wrapped between Cancel and Submit; background unavailable | Pass |
| Deletion dialog | EN | Escape | Close and restore trigger focus | Closed after exit animation; trigger focus restored | Pass |
| Deletion dialog | EN | Keyboard Cancel | Close and restore focus | Passed | Pass |
| Deletion pending | EN | Rapid pointer, Enter, and Space activation | One request per isolated scenario | Exactly one classified mutation in each scenario | Pass |
| Deletion error | EN | Keyboard retry/support recovery | Reachable and meaningful | Retry activated once; support link remained reachable | Pass |

Automated keyboard assertions also passed for payment Enter-open, duplicate prevention, retry, deletion Enter/Space open, focus trap, Escape, Cancel, focus restoration, duplicate prevention, and retry.
