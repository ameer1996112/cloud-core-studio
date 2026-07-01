# Admin Class Delete And Cancel Workflow Design

## Goal

Add a safe admin workflow for removing class sessions without risking bookings, credits, receipts, attendance history, waitlist state, notification history, or RLS boundaries.

The workflow must split destructive actions into:

- `Delete class` for empty mistake classes only.
- `Cancel class` for operationally real classes that already touched members.

## Scope

In scope:

- Admin class detail workflow in `/admin/classes/$id`.
- New safe server-side class delete/cancel entrypoints in `src/lib/admin.functions.ts`.
- New Supabase RPC design for guarded class deletion and idempotent class cancellation.
- Localized UI copy for Hebrew, English, and Arabic.
- Result-summary UX for cancellation outcomes.
- Validation and QA for delete blocking, cancellation behavior, and idempotency.
- Final report update in `docs/admin-lesson-workflow-final-polish-report.md`.

Out of scope:

- Running database migrations before explicit approval.
- Broad schedule/calendar redesign outside the class detail destructive workflow.
- Removing audit or notification history.
- Changing member-facing payment, receipt, attendance, or package rules beyond what safe class cancellation needs.

## Current Gap

The current implementation is not safe enough for this workflow:

- `deleteClass` directly deletes from `classes`.
- `setClassStatus("cancelled")` changes class status and prepares cancellation drafts, but does not cancel bookings, close waitlist rows, handle refunds, or provide class-level idempotency.
- The admin UI in `src/routes/_authenticated/admin/classes/$id.tsx` uses browser `confirm()` flows instead of explicit, state-aware modals.

This means the existing behavior is too weak for real studio operations and too permissive for destructive actions.

## Product Rules

### Delete Class

Use delete only when the class was created by mistake and has no dependent activity.

Delete must be allowed only when all of these are true:

- no bookings exist for the class
- no attendance records exist for the class
- no waitlist entries exist for the class
- no notification logs exist for the class
- no payment, receipt, or credit history can be reached through class-linked booking records

If any dependency exists, hard delete must be blocked and the UI must steer the admin to the cancel flow instead.

### Cancel Class

Use cancel when the class has reached members or operational workflows.

Cancel applies when any of these are true:

- bookings exist
- waitlist entries exist
- the class was published and may already be visible to members
- member credits or notifications may be affected

Cancellation must preserve history while making the class non-bookable and operationally closed.

## Backend Architecture

Use explicit backend actions instead of trusting the browser or route-level orchestration.

### New Server Entry Points

Add two new admin functions in `src/lib/admin.functions.ts`:

- `adminDeleteClass`
- `adminCancelClass`

These functions remain the only route-facing entrypoints for destructive class actions. The route must stop using direct `deleteClass` and raw `setClassStatus("cancelled")` for this workflow.

### New RPC Design

Add two Supabase RPCs after approval:

- `admin_delete_class(p_actor_id uuid, p_class_id uuid)`
- `admin_cancel_class(p_actor_id uuid, p_class_id uuid, p_reason text default null, p_notify boolean default true, p_refund boolean default true)`

Both RPCs must enforce admin-only access and keep the safety rules server-side.

## Delete Behavior

`admin_delete_class` should:

1. Verify actor is admin.
2. Read the class and dependency counts.
3. Refuse deletion if the class has any protected dependent records.
4. Return a structured blocked result that the UI can interpret cleanly.
5. Delete only truly empty classes.

Recommended response shape:

```ts
type AdminDeleteClassResult =
  | { status: "deleted" }
  | {
      status: "blocked";
      reason:
        | "has_bookings"
        | "has_attendance"
        | "has_waitlist"
        | "has_notifications"
        | "has_financial_history";
      counts: {
        bookings: number;
        attendance: number;
        waitlist: number;
        notifications: number;
      };
    };
```

This keeps delete decisions deterministic and safe even if the UI is bypassed.

## Cancel Behavior

`admin_cancel_class` should be the operational path.

It should:

1. Verify actor is admin.
2. Lock and read the class row.
3. Return a no-op result if the class is already cancelled.
4. Mark the class status as `cancelled`.
5. Cancel only active booked rows.
6. Refund credits only when the applicable business rule says to refund.
7. Close or cancel open waitlist entries.
8. Create notification draft/log rows for affected booked members using the existing notification draft system.
9. Return a structured summary for the admin UI.

Recommended response shape:

```ts
type AdminCancelClassResult = {
  status: "cancelled" | "already_cancelled";
  classStatus: "cancelled";
  summary: {
    bookingsCancelled: number;
    creditsReturned: number;
    waitlistClosed: number;
    notificationsPrepared: number;
    notificationsManualReview: number;
  };
  warnings: string[];
};
```

## Idempotency Rules

Class cancellation must be idempotent.

Calling `admin_cancel_class` twice must not:

- create duplicate credit transactions
- duplicate booking cancellation side effects
- duplicate waitlist closure
- duplicate notification logs
- produce a second operational refund

Idempotency should rely on persistent state, not only frontend guards:

- already-cancelled class status short-circuits future side effects
- only bookings in active booked state are cancelled
- only open waitlist entries are closed
- notification drafts continue using `notification_logs.idempotency_key`

The second call should return a stable summary that reflects current state, not rerun side effects.

## Refund And Notification Handling

Use the existing building blocks where possible:

- booking cancellation/refund behavior should reuse existing booking cancellation semantics or equivalent ledger-safe SQL
- notification creation should keep using the existing draft/log system and idempotency keys

Notification failures must not fail the class cancellation itself.

Instead:

- cancellation completes
- failed notification preparation or delivery is recorded as warning/manual review
- the admin sees the issue in the result summary

This preserves operational safety over messaging reliability.

## UI Design

Update `src/routes/_authenticated/admin/classes/$id.tsx` to use a bottom danger zone, clearly separated from routine actions.

### Primary Class Actions

Keep normal actions in the non-destructive section:

- `Edit class`
- `Send reminder`
- `Add member`

### Danger Zone

Place destructive actions at the bottom:

- `Cancel class`
- `Delete class` only when safe

The danger zone should use calm destructive styling:

- explicit contrast from normal actions
- not saturated red across the whole panel
- confirmation required
- not easy to trigger accidentally

### Cancel Modal

The cancel modal should show:

- class title
- date and time
- booking count
- waitlist count
- estimated credit impact
- notification impact
- optional cancellation reason textarea
- confirmation checkbox when bookings exist

Primary action:

- `Cancel class`

Secondary action:

- `Back`

Required checkbox copy:

- Hebrew: `אני מבין/ה שהשיעור יבוטל והמשתתפות יקבלו עדכון.`
- English: `I understand this class will be canceled and members will be notified.`

The route should render a clear result summary after success.

### Delete Modal

The delete modal should state that the action is only for mistake classes with no registrations.

If backend validation blocks deletion, the UI should pivot into safe guidance:

- explain the class cannot be deleted because dependent activity exists
- recommend cancelling instead

The route must stop using browser `confirm()` for either action.

## Localization

Add the requested labels and messages to the i18n system for Hebrew, English, and Arabic.

Required copy includes:

- `Cancel class`
- `Delete class`
- `This class will be canceled and members will be notified`
- `You can’t delete a class with active bookings. Cancel it instead.`

Hebrew and Arabic copy should follow the approved wording from the request, with the same operational meaning.

## Route Data Requirements

The class detail route needs enough state to drive the destructive workflow without guessing:

- class status
- active booking count
- waitlist count
- whether delete is safe
- whether cancellation confirmation checkbox is required

Use a dedicated backend summary/metadata path for these fields:

- return these fields from a dedicated backend summary/metadata path tied to the class detail screen
- do not duplicate eligibility logic in the browser

The UI may render optimistically, but backend responses remain the source of truth.

## Testing Plan

Automated checks after implementation:

- `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`
- `/Users/ameeramer/.bun/bin/bun run build`
- `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs`

Additional coverage:

- unit tests for new i18n keys and any summary helper formatting
- server-side tests for:
  - delete allowed on truly empty class
  - delete blocked when bookings exist
  - delete blocked when waitlist or attendance exists
  - cancel class updates status and preserves history
  - cancel class returns credits once
  - cancel class is idempotent on second call
  - notification draft creation does not duplicate logs

Browser QA target:

- admin class detail route
- destructive actions visible only in the correct context
- cancel summary visible after success
- canceled class no longer appears bookable in member-facing surfaces if visible

## Acceptance Criteria

- Admin can delete only truly empty mistake classes.
- Classes with bookings or dependent records cannot be hard-deleted.
- Cancel class flow is explicit, calm, and hard to trigger accidentally.
- Cancellation preserves operational history.
- Credits are handled safely.
- Notifications are prepared safely and do not make cancellation fail.
- Second cancellation does not duplicate refunds or messages.
- The backend, not the browser, is the source of truth for destructive safety.
