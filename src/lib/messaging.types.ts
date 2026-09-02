export type MessageLanguage = "he" | "ar" | "en";

export type MessageEventType =
  | "member_welcome"
  | "booking_confirmed"
  | "booking_registered_admin"
  | "booking_cancelled"
  | "booking_changed"
  | "booking_checked_in"
  | "booking_no_show_followup"
  | "class_cancelled_by_admin"
  | "class_time_changed"
  | "class_location_changed"
  | "class_instructor_changed"
  | "class_reminder_planning"
  | "class_reminder_final"
  | "class_published"
  | "class_open_spots"
  | "class_recommendation"
  | "weekly_schedule"
  | "daily_briefing"
  | "waitlist_joined"
  | "waitlist_position_changed"
  | "waitlist_spot_available"
  | "waitlist_accepted"
  | "waitlist_offer_expired"
  | "waitlist_removed"
  | "payment_request_received"
  | "payment_pending_reminder"
  | "payment_confirmed"
  | "payment_failed"
  | "payment_refunded"
  | "receipt_issued"
  | "membership_activated"
  | "credits_low"
  | "credits_depleted"
  | "membership_expiring"
  | "membership_expired"
  | "subscription_renewal_upcoming"
  | "subscription_renewal_succeeded"
  | "subscription_renewal_failed"
  | "subscription_paused"
  | "subscription_cancelled"
  | "human_handoff"
  | "staff_reply"
  | "human_handoff_resolved"
  | "urgent_studio_announcement"
  | "trial_followup"
  | "retention_reminder";

export const MESSAGE_CHANNELS = ["in_app", "push", "email", "whatsapp"] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];
export type ExternalMessageChannel = Exclude<MessageChannel, "in_app">;
export type ExternalChannelAvailability = Record<ExternalMessageChannel, boolean>;
export type MessageDirection = "inbound" | "outbound";
export type TemplateVersion = "v2";
export type ConversationStatus = "unassigned" | "claimed" | "resolved";

export type DeliveryStatus =
  | "queued"
  | "enqueued"
  | "sending"
  | "accepted"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "dead_letter"
  | "suppressed"
  | "expired"
  | "cancelled"
  | "delivery_unknown";

export type DeliveryFailureClass = "transient" | "permanent" | "ambiguous" | "configuration";

export type NotificationFamily =
  | "booking"
  | "class"
  | "waitlist"
  | "payment"
  | "membership"
  | "communication"
  | "engagement";

export type NotificationTier =
  | "critical"
  | "transactional"
  | "reminder"
  | "promotional"
  | "inbox_only";

export type NotificationPreferenceKey =
  | "classOperations"
  | "classReminders"
  | "scheduleOpenings"
  | "waitlist"
  | "payments"
  | "membership"
  | "staffReplies"
  | "recommendations"
  | "marketing";

export type ApnsInterruptionLevel = "passive" | "active" | "time-sensitive";

export type NotificationActionId =
  | "view_class"
  | "cancel_booking"
  | "claim_spot"
  | "book_now"
  | "view_schedule"
  | "choose_package"
  | "fix_payment"
  | "contact_studio"
  | "reply"
  | "view_membership"
  | "view_receipt";

export type MessagingDeliveryPreferences = {
  pushEnabled?: boolean | null;
  whatsappEnabled?: boolean | null;
  emailEnabled?: boolean | null;
  scheduleUpdates?: boolean | null;
  classOperations?: boolean | null;
  classReminders?: boolean | null;
  scheduleOpenings?: boolean | null;
  waitlist?: boolean | null;
  payments?: boolean | null;
  membership?: boolean | null;
  staffReplies?: boolean | null;
  recommendations?: boolean | null;
  marketing?: boolean | null;
  sound?: boolean | null;
  timeSensitive?: boolean | null;
};
