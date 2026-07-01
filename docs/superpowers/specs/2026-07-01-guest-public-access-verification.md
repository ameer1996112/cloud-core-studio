# Guest Public Access Verification

Tracked verification for Task 2 guest schedule/detail review lives in:

- `tests/unit/guestScheduleGuestHandoff.test.mjs`
- `tests/unit/guestDetailGuestBranch.test.mjs`

What those tracked checks prove:

- `guestScheduleGuestHandoff.test.mjs`
  - the real `/member/schedule` route component is rendered through its public auth gate with a mock auth snapshot, not just `MemberScheduleContent(session=null)`
  - the signed-out public render shows the guest schedule surface and the guest "Open classes" stat with sold-out classes excluded
  - invoking a real schedule card `onOpen` selects `open-class`, and the guest rerender uses guest-scoped schedule/detail query keys before rendering the real guest-safe detail CTA output
  - rerendering that same public route with a signed-in member auth snapshot and the same selected class proves the member branch switches to member-scoped schedule/detail query keys and no longer renders the guest CTA copy
  - the same tracked file also verifies that member booking cancellation invalidates member-scoped schedule queries without targeting the guest schedule scope
- `guestDetailGuestBranch.test.mjs`
  - the real guest detail branch still has a focused supplemental check for the full-class guest message
  - it verifies `Sign in for booking options` plus the no-waitlist/package/top-up constraint for a full guest class

Verified commands:

```bash
bun test tests/unit/guestScheduleGuestHandoff.test.mjs
bun test tests/unit/guestDetailGuestBranch.test.mjs
```

Local live-preview blocker:

- A signed-out preview run was attempted with `bun start` and Playwright against `/member/schedule`.
- The route could not be exercised locally because the preview environment was missing `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, so the app rendered its global env-error state before schedule data could load.

Local authenticated-runtime blocker:

- Signed-in runtime validation for the member schedule/detail flow remained blocked for the same local-env reason.
- The tracked verification above is render-level and mock-assisted; it does not claim a successful live signed-out browser walkthrough or an authenticated runtime session in this local environment.
