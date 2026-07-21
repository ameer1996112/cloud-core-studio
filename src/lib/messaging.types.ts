export type MessageLanguage = "he" | "ar" | "en";

export type MessageEventType =
  | "booking_confirmed"
  | "booking_cancelled"
  | "class_cancelled_by_admin"
  | "class_time_changed"
  | "class_reminder_planning"
  | "class_reminder_final"
  | "class_open_spots"
  | "waitlist_joined"
  | "waitlist_spot_available"
  | "payment_request_received"
  | "payment_pending_reminder"
  | "payment_confirmed"
  | "payment_failed"
  | "receipt_issued"
  | "human_handoff";

export type MessageChannel = "in_app" | "push" | "email" | "whatsapp";
export type ExternalMessageChannel = Exclude<MessageChannel, "in_app">;
export type ExternalChannelAvailability = Record<ExternalMessageChannel, boolean>;
export type MessageDirection = "inbound" | "outbound";
export type TemplateVersion = "v2";
export type ConversationStatus = "unassigned" | "claimed" | "resolved";

export type DeliveryStatus =
  | "queued"
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
