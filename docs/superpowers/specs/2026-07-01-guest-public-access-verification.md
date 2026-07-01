# Guest Public Access Verification

Tracked verification for Task 2 guest schedule/detail review lives in:

- `tests/unit/guestScheduleGuestHandoff.test.mjs`
- `tests/unit/guestDetailGuestBranch.test.mjs`

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
- Source-level and render-level verification still confirmed that the signed-out route hands `viewerContext="guest"` into `ClassDetailSheet`, and that the real guest detail branch renders guest-safe CTAs for open and full classes.
