export type AdultInquiryQueue =
  | "new_inquiry"
  | "needs_reply"
  | "needs_class_option"
  | "waiting_suitable_time"
  | "waiting_next_schedule"
  | "trial_booked"
  | "trial_today"
  | "payment_pending"
  | "attendance_unresolved"
  | "continuation_needed"
  | "purchased";

export type AdultInquiryQueueInput = {
  reservationState: string | null;
  classStartsAt: string | null;
  attendanceStatus: string | null;
  paymentStatus: string | null;
  continuationOutcome: string | null;
  nextAction?: string | null;
  inquiryCreatedAt?: string | null;
};

export function adultInquiryQueue(
  inquiry: AdultInquiryQueueInput,
  now = new Date(),
): AdultInquiryQueue {
  if (inquiry.continuationOutcome === "purchased") return "purchased";
  if (inquiry.attendanceStatus === "attended" && !inquiry.continuationOutcome) {
    return "continuation_needed";
  }

  const startsAt = inquiry.classStartsAt ? new Date(inquiry.classStartsAt) : null;
  const isPast = Boolean(startsAt && startsAt.getTime() < now.getTime());
  const isToday = Boolean(
    startsAt &&
    startsAt.getFullYear() === now.getFullYear() &&
    startsAt.getMonth() === now.getMonth() &&
    startsAt.getDate() === now.getDate(),
  );

  if (isPast && inquiry.reservationState === "booked" && !inquiry.attendanceStatus) {
    return "attendance_unresolved";
  }
  if (inquiry.paymentStatus === "pending" || inquiry.paymentStatus === "requested") {
    return "payment_pending";
  }
  if (isToday && inquiry.reservationState === "booked") return "trial_today";
  if (inquiry.reservationState === "booked") return "trial_booked";
  if (inquiry.nextAction === "waiting_suitable_time") return "waiting_suitable_time";
  if (inquiry.nextAction === "waiting_next_schedule") return "waiting_next_schedule";
  if (inquiry.nextAction === "offer_class") return "needs_class_option";
  if (inquiry.nextAction === "reply") return "needs_reply";
  return "new_inquiry";
}

export const ADULT_INQUIRY_QUEUE_LABELS: Record<AdultInquiryQueue, string> = {
  new_inquiry: "New inquiry",
  needs_reply: "Needs reply",
  needs_class_option: "Needs class option",
  waiting_suitable_time: "Waiting for suitable time",
  waiting_next_schedule: "Waiting for next schedule",
  trial_booked: "Trial booked",
  trial_today: "Trial today",
  payment_pending: "Payment pending",
  attendance_unresolved: "Attendance unresolved",
  continuation_needed: "Trial attended — continuation needed",
  purchased: "Purchased",
};
