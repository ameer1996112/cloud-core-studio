# Guest Public Access Verification

Tracked verification for Task 2 guest schedule/detail review lives in:

- `tests/unit/guestScheduleGuestHandoff.test.mjs`
- `tests/unit/guestDetailGuestBranch.test.mjs`

What those tracked checks prove:

- `guestScheduleGuestHandoff.test.mjs`
  - the signed-out schedule renders the guest detail context
  - the guest "Open classes" stat excludes a sold-out class
  - invoking a schedule card's `onOpen` selects that class id and a rerender passes the selected `classId` into `ClassDetailSheet`
- `guestDetailGuestBranch.test.mjs`
  - the real guest detail branch renders `Sign in to book` for an open class
  - the real guest detail branch renders `Sign in for booking options` for a full class
  - the guest detail branch does not expose waitlist/package/top-up CTAs in those cases

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
- The tracked verification above is render-level and mock-assisted; it does not claim a successful live signed-out browser walkthrough or authenticated runtime session in this local environment.
