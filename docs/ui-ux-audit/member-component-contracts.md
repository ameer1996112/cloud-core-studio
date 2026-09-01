# Member component contracts — milestone 2

## `MemberFeedbackPanel`

**Purpose.** Present a persistent, in-context member result or recovery message. It centralizes semantic live-region, focus-target and RTL-safe layout styling without embedding a business action.

**Variants.** `info` for guidance/already-open status, `success` for a completed request supported by a backend response, and `error` for a failed action.

**Required props.** `variant`, `title`, and `children`.

**Optional props.** `live` (`off`, `polite`, `assertive`; defaults to `off`) and `className`.

**Accessible behavior.** The panel is a programmatically focusable status region. An assertive error has `role="alert"`; all other states have `role="status"`. The caller is responsible for choosing an appropriate live level and moving focus only when a result needs attention.

**RTL/LTR behavior.** It inherits the route `dir`, uses logical `text-start`, and contains no ordered numeric or currency formatting. Callers must use a directional-isolation primitive such as `BidiValue kind="currency"` (or `LtrInline` where appropriate) for mixed-direction numbers/currency.

**Mobile/disabled/loading behavior.** The panel has no controls and its text wraps at 320px. It must describe a related action’s current state; it does not own disabled/loading behavior.

**Correct use.** `PaymentMethodSheet` shows a failed session-creation message with a retry instruction. `MemberAccount` shows submitted, duplicate, and failed deletion-request results after the existing request completes.

**Incorrect use.** Do not use it as a generic card, a one-line toast, a visual shell for unrelated content, or a container for a destructive submit button.
