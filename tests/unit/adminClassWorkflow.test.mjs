import { strict as assert } from "node:assert";
import {
  deriveAdminClassWorkflowSnapshot,
  formatAdminClassCancellationSummary,
} from "../../src/lib/adminClassWorkflow.ts";

assert.deepEqual(
  deriveAdminClassWorkflowSnapshot({
    status: "scheduled",
    bookings: 0,
    waitlist: 0,
    attendance: 0,
    notifications: 0,
    financial: 0,
  }),
  {
    canDelete: true,
    requiresCancelConfirmation: false,
    canCancel: true,
    blockedDeleteReason: null,
  },
);

assert.deepEqual(
  deriveAdminClassWorkflowSnapshot({
    status: "scheduled",
    bookings: 2,
    waitlist: 1,
    attendance: 0,
    notifications: 0,
    financial: 1,
  }),
  {
    canDelete: false,
    requiresCancelConfirmation: true,
    canCancel: true,
    blockedDeleteReason: "has_bookings",
  },
);

assert.deepEqual(
  formatAdminClassCancellationSummary({
    lang: "he",
    summary: {
      bookingsCancelled: 3,
      creditsReturned: 3,
      waitlistClosed: 1,
      notificationsPrepared: 3,
      notificationsManualReview: 1,
    },
  }),
  [
    "3 הרשמות בוטלו",
    "3 קרדיטים הוחזרו",
    "1 ברשימת ההמתנה נסגרה",
    "3 הודעות נוצרו",
    "1 הודעה דורשת טיפול ידני",
  ],
);

console.log("admin class workflow helpers OK");
