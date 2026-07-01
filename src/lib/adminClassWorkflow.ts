export type AdminDeleteBlockedReason =
  | "has_bookings"
  | "has_attendance"
  | "has_waitlist"
  | "has_notifications"
  | "has_financial_history";

export type AdminDeleteClassResult =
  | { status: "deleted" }
  | {
      status: "blocked";
      reason: AdminDeleteBlockedReason;
      counts: {
        bookings: number;
        attendance: number;
        waitlist: number;
        notifications: number;
        financial: number;
      };
    };

export type AdminCancelClassResult = {
  status: "cancelled" | "already_cancelled";
  classId: string;
  summary: {
    bookingsCancelled: number;
    creditsReturned: number;
    waitlistClosed: number;
    notificationsPrepared: number;
    notificationsManualReview: number;
  };
  warnings: string[];
};

export type AdminClassWorkflowSnapshot = {
  canDelete: boolean;
  canCancel: boolean;
  requiresCancelConfirmation: boolean;
  blockedDeleteReason: AdminDeleteBlockedReason | null;
};

export function deriveAdminClassWorkflowSnapshot(input: {
  status: string;
  bookings: number;
  waitlist: number;
  attendance: number;
  notifications: number;
  financial: number;
}): AdminClassWorkflowSnapshot {
  const blockedDeleteReason =
    input.bookings > 0
      ? "has_bookings"
      : input.attendance > 0
        ? "has_attendance"
        : input.waitlist > 0
          ? "has_waitlist"
          : input.notifications > 0
            ? "has_notifications"
            : input.financial > 0
              ? "has_financial_history"
              : null;

  return {
    canDelete: blockedDeleteReason === null,
    canCancel: input.status === "scheduled",
    requiresCancelConfirmation: input.bookings > 0 || input.waitlist > 0,
    blockedDeleteReason,
  };
}

export function formatAdminClassCancellationSummary({
  lang,
  summary,
}: {
  lang: "he" | "en" | "ar";
  summary: AdminCancelClassResult["summary"];
}): string[] {
  if (lang === "he") {
    return [
      `${summary.bookingsCancelled} הרשמות בוטלו`,
      `${summary.creditsReturned} קרדיטים הוחזרו`,
      `${summary.waitlistClosed} ברשימת ההמתנה נסגרה`,
      `${summary.notificationsPrepared} הודעות נוצרו`,
      `${summary.notificationsManualReview} הודעה דורשת טיפול ידני`,
    ];
  }

  if (lang === "ar") {
    return [
      `تم إلغاء ${summary.bookingsCancelled} حجوزات`,
      `تمت إعادة ${summary.creditsReturned} أرصدة`,
      `تم إغلاق ${summary.waitlistClosed} من قائمة الانتظار`,
      `تم إنشاء ${summary.notificationsPrepared} إشعارات`,
      `${summary.notificationsManualReview} إشعار يحتاج متابعة يدوية`,
    ];
  }

  return [
    `${summary.bookingsCancelled} bookings cancelled`,
    `${summary.creditsReturned} credits returned`,
    `${summary.waitlistClosed} waitlist entries closed`,
    `${summary.notificationsPrepared} notifications created`,
    `${summary.notificationsManualReview} notifications need manual review`,
  ];
}
