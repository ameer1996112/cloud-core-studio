import type { MessageEventType, MessageLanguage } from "@/lib/messaging.types";

export const ADMIN_BOOKING_ALERT_EVENT = "booking_registered_admin" satisfies MessageEventType;
export const ADMIN_BOOKING_ALERT_FALLBACK_EMAIL = "cloudandcorestudio@gmail.com";

export function resolveAdminBookingAlertPolicy(input: {
  contactEmail?: string | null;
  classId: string;
}): {
  eventType: typeof ADMIN_BOOKING_ALERT_EVENT;
  language: MessageLanguage;
  email: string;
  pushRecipient: "admin_group";
  deepLink: string;
} {
  return {
    eventType: ADMIN_BOOKING_ALERT_EVENT,
    language: "he",
    email: input.contactEmail?.trim() || ADMIN_BOOKING_ALERT_FALLBACK_EMAIL,
    pushRecipient: "admin_group",
    deepLink: `/admin/classes/${encodeURIComponent(input.classId)}`,
  };
}
