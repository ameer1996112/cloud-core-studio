import type {
  ApnsInterruptionLevel,
  ExternalMessageChannel,
  MessageChannel,
  MessageEventType,
  NotificationActionId,
  NotificationFamily,
  NotificationPreferenceKey,
  NotificationTier,
} from "@/lib/messaging.types";

export type NotificationEventDefinition = {
  family: NotificationFamily;
  tier: NotificationTier;
  channels: readonly MessageChannel[];
  fallbackChannels: readonly ExternalMessageChannel[];
  preference: NotificationPreferenceKey | null;
  frequencyPolicy: "none" | "promotional";
  immediate: boolean;
  interruptionLevel: ApnsInterruptionLevel;
  sound: "none" | "default" | "brand_important";
  actions: readonly NotificationActionId[];
  zeroCreditAction?: NotificationActionId;
  memberVisible: boolean;
  copyStatus: "approved" | "draft";
  defaultEnabled: boolean;
};

const current = (
  definition: Omit<NotificationEventDefinition, "copyStatus" | "defaultEnabled">,
): NotificationEventDefinition => ({ ...definition, copyStatus: "approved", defaultEnabled: true });

const future = (
  definition: Omit<NotificationEventDefinition, "copyStatus" | "defaultEnabled">,
): NotificationEventDefinition => ({ ...definition, copyStatus: "draft", defaultEnabled: false });

const transactional = {
  fallbackChannels: [] as const,
  preference: null,
  frequencyPolicy: "none" as const,
  interruptionLevel: "active" as const,
  sound: "default" as const,
  memberVisible: true,
};

const critical = {
  tier: "critical" as const,
  fallbackChannels: ["whatsapp", "email"] as const,
  frequencyPolicy: "none" as const,
  immediate: true,
  interruptionLevel: "time-sensitive" as const,
  sound: "brand_important" as const,
  memberVisible: true,
};

const reminder = {
  tier: "reminder" as const,
  fallbackChannels: [] as const,
  frequencyPolicy: "none" as const,
  immediate: false,
  interruptionLevel: "active" as const,
  sound: "default" as const,
  memberVisible: true,
};

const promotional = {
  tier: "promotional" as const,
  channels: ["in_app", "push"] as const,
  fallbackChannels: [] as const,
  frequencyPolicy: "promotional" as const,
  immediate: false,
  interruptionLevel: "passive" as const,
  sound: "none" as const,
  memberVisible: true,
};

export const NOTIFICATION_EVENT_CATALOG = {
  booking_confirmed: current({
    ...transactional,
    family: "booking",
    tier: "transactional",
    channels: ["in_app", "push", "whatsapp", "email"],
    immediate: true,
    actions: ["view_class", "cancel_booking"],
  }),
  booking_cancelled: current({
    ...transactional,
    family: "booking",
    tier: "transactional",
    channels: ["in_app", "push", "whatsapp", "email"],
    immediate: true,
    actions: ["view_schedule"],
  }),
  booking_changed: future({
    ...transactional,
    family: "booking",
    tier: "transactional",
    channels: ["in_app", "push", "email"],
    immediate: true,
    actions: ["view_class"],
  }),
  booking_checked_in: future({
    ...transactional,
    family: "booking",
    tier: "inbox_only",
    channels: ["in_app"],
    immediate: true,
    interruptionLevel: "passive",
    sound: "none",
    actions: ["view_class"],
  }),
  booking_no_show_followup: future({
    ...promotional,
    family: "booking",
    preference: "marketing",
    actions: ["view_schedule", "contact_studio"],
  }),
  class_cancelled_by_admin: current({
    ...critical,
    family: "class",
    channels: ["in_app", "push", "whatsapp", "email"],
    preference: "classOperations",
    actions: ["view_schedule", "contact_studio"],
  }),
  class_time_changed: current({
    ...critical,
    family: "class",
    channels: ["in_app", "push", "whatsapp", "email"],
    preference: "classOperations",
    actions: ["view_class", "contact_studio"],
  }),
  class_location_changed: future({
    ...critical,
    family: "class",
    channels: ["in_app", "push", "whatsapp", "email"],
    preference: "classOperations",
    actions: ["view_class", "contact_studio"],
  }),
  class_instructor_changed: future({
    ...transactional,
    family: "class",
    tier: "transactional",
    channels: ["in_app", "push"],
    preference: "classOperations",
    immediate: false,
    actions: ["view_class"],
  }),
  class_reminder_planning: current({
    ...reminder,
    family: "class",
    channels: ["in_app", "push", "whatsapp"],
    preference: "classReminders",
    actions: ["view_class", "cancel_booking"],
  }),
  class_reminder_final: current({
    ...reminder,
    family: "class",
    channels: ["in_app", "push", "whatsapp"],
    preference: "classReminders",
    actions: ["view_class"],
  }),
  class_published: future({
    ...promotional,
    family: "class",
    preference: "scheduleOpenings",
    actions: ["view_schedule"],
  }),
  class_open_spots: current({
    ...promotional,
    family: "class",
    preference: "scheduleOpenings",
    actions: ["book_now", "view_schedule", "choose_package"],
    zeroCreditAction: "choose_package",
  }),
  class_recommendation: future({
    ...promotional,
    family: "class",
    preference: "recommendations",
    actions: ["book_now", "view_class", "choose_package"],
    zeroCreditAction: "choose_package",
  }),
  waitlist_joined: current({
    ...reminder,
    family: "waitlist",
    channels: ["in_app", "push"],
    preference: "waitlist",
    actions: ["view_class"],
  }),
  waitlist_position_changed: future({
    ...transactional,
    family: "waitlist",
    tier: "inbox_only",
    channels: ["in_app"],
    preference: "waitlist",
    immediate: false,
    interruptionLevel: "passive",
    sound: "none",
    actions: ["view_class"],
  }),
  waitlist_spot_available: current({
    ...critical,
    family: "waitlist",
    channels: ["in_app", "push", "whatsapp"],
    preference: "waitlist",
    actions: ["claim_spot", "view_class"],
  }),
  waitlist_accepted: future({
    ...transactional,
    family: "waitlist",
    tier: "transactional",
    channels: ["in_app", "push", "whatsapp", "email"],
    preference: "waitlist",
    immediate: true,
    actions: ["view_class"],
  }),
  waitlist_offer_expired: future({
    ...transactional,
    family: "waitlist",
    tier: "inbox_only",
    channels: ["in_app"],
    preference: "waitlist",
    immediate: true,
    interruptionLevel: "passive",
    sound: "none",
    actions: ["view_schedule"],
  }),
  waitlist_removed: future({
    ...transactional,
    family: "waitlist",
    tier: "transactional",
    channels: ["in_app", "push"],
    preference: "waitlist",
    immediate: true,
    actions: ["view_schedule"],
  }),
  payment_request_received: current({
    ...transactional,
    family: "payment",
    tier: "transactional",
    channels: ["in_app", "push", "email"],
    preference: "payments",
    immediate: true,
    actions: ["fix_payment"],
  }),
  payment_pending_reminder: current({
    ...reminder,
    family: "payment",
    channels: ["in_app", "push", "whatsapp"],
    preference: "payments",
    actions: ["fix_payment", "contact_studio"],
  }),
  payment_confirmed: current({
    ...transactional,
    family: "payment",
    tier: "transactional",
    channels: ["in_app", "push", "whatsapp", "email"],
    preference: "payments",
    immediate: true,
    actions: ["view_membership"],
  }),
  payment_failed: current({
    ...critical,
    family: "payment",
    channels: ["in_app", "push", "whatsapp", "email"],
    preference: "payments",
    actions: ["fix_payment", "contact_studio"],
  }),
  payment_refunded: future({
    ...transactional,
    family: "payment",
    tier: "transactional",
    channels: ["in_app", "push", "email"],
    preference: "payments",
    immediate: true,
    actions: ["view_membership"],
  }),
  receipt_issued: current({
    ...transactional,
    family: "payment",
    tier: "inbox_only",
    channels: ["in_app", "email"],
    preference: "payments",
    immediate: true,
    interruptionLevel: "passive",
    sound: "none",
    actions: ["view_receipt"],
  }),
  membership_activated: future({
    ...transactional,
    family: "membership",
    tier: "transactional",
    channels: ["in_app", "push", "email"],
    preference: "membership",
    immediate: true,
    actions: ["view_membership", "view_schedule"],
  }),
  credits_low: future({
    ...reminder,
    family: "membership",
    channels: ["in_app", "push"],
    preference: "membership",
    actions: ["choose_package"],
  }),
  credits_depleted: future({
    ...reminder,
    family: "membership",
    channels: ["in_app", "push"],
    preference: "membership",
    actions: ["choose_package"],
  }),
  membership_expiring: future({
    ...reminder,
    family: "membership",
    channels: ["in_app", "push", "email"],
    preference: "membership",
    actions: ["view_membership", "choose_package"],
  }),
  membership_expired: future({
    ...transactional,
    family: "membership",
    tier: "transactional",
    channels: ["in_app", "push", "email"],
    preference: "membership",
    immediate: true,
    actions: ["choose_package"],
  }),
  subscription_renewal_upcoming: future({
    ...reminder,
    family: "membership",
    channels: ["in_app", "push", "email"],
    preference: "membership",
    actions: ["view_membership"],
  }),
  subscription_renewal_succeeded: future({
    ...transactional,
    family: "membership",
    tier: "transactional",
    channels: ["in_app", "push", "whatsapp", "email"],
    preference: "membership",
    immediate: true,
    actions: ["view_membership"],
  }),
  subscription_renewal_failed: future({
    ...critical,
    family: "membership",
    channels: ["in_app", "push", "whatsapp", "email"],
    preference: "membership",
    actions: ["fix_payment", "contact_studio"],
  }),
  subscription_paused: future({
    ...transactional,
    family: "membership",
    tier: "transactional",
    channels: ["in_app", "push", "email"],
    preference: "membership",
    immediate: true,
    actions: ["view_membership", "contact_studio"],
  }),
  subscription_cancelled: future({
    ...transactional,
    family: "membership",
    tier: "transactional",
    channels: ["in_app", "push", "email"],
    preference: "membership",
    immediate: true,
    actions: ["view_membership", "contact_studio"],
  }),
  human_handoff: current({
    ...critical,
    family: "communication",
    channels: ["whatsapp", "in_app", "push"],
    preference: "staffReplies",
    actions: ["reply"],
    memberVisible: false,
  }),
  staff_reply: future({
    ...critical,
    family: "communication",
    channels: ["in_app", "push"],
    preference: "staffReplies",
    actions: ["reply"],
  }),
  human_handoff_resolved: future({
    ...transactional,
    family: "communication",
    tier: "inbox_only",
    channels: ["in_app"],
    preference: "staffReplies",
    immediate: true,
    interruptionLevel: "passive",
    sound: "none",
    actions: [],
    memberVisible: true,
  }),
  urgent_studio_announcement: future({
    ...critical,
    family: "communication",
    channels: ["in_app", "push", "whatsapp", "email"],
    preference: "classOperations",
    actions: ["contact_studio"],
  }),
  trial_followup: future({
    ...promotional,
    family: "engagement",
    preference: "marketing",
    actions: ["view_schedule", "contact_studio"],
  }),
  retention_reminder: future({
    ...promotional,
    family: "engagement",
    preference: "marketing",
    actions: ["view_schedule"],
  }),
} satisfies Record<MessageEventType, NotificationEventDefinition>;

export function notificationDefinition(eventType: MessageEventType) {
  return NOTIFICATION_EVENT_CATALOG[eventType];
}

export function notificationCategory(
  eventType: MessageEventType,
  actionOverride?: readonly NotificationActionId[],
) {
  const actions = (actionOverride ?? NOTIFICATION_EVENT_CATALOG[eventType].actions).join(",");
  const categories: Record<string, string> = {
    "view_class,cancel_booking": "CC_BOOKING_ACTIONS",
    view_schedule: "CC_SCHEDULE",
    view_class: "CC_VIEW_CLASS",
    "view_schedule,contact_studio": "CC_SCHEDULE_CONTACT",
    "view_class,contact_studio": "CC_CLASS_UPDATE",
    "book_now,view_schedule,choose_package": "CC_OPEN_CLASS",
    "view_schedule,choose_package": "CC_OPEN_CLASS_NO_CREDITS",
    "book_now,view_class,choose_package": "CC_CLASS_RECOMMENDATION",
    "view_class,choose_package": "CC_CLASS_RECOMMENDATION_NO_CREDITS",
    "claim_spot,view_class": "CC_WAITLIST_OFFER",
    fix_payment: "CC_FIX_PAYMENT",
    "fix_payment,contact_studio": "CC_ACCOUNT_ACTION",
    view_membership: "CC_VIEW_MEMBERSHIP",
    "view_membership,view_schedule": "CC_MEMBERSHIP_ACTIVE",
    choose_package: "CC_CHOOSE_PACKAGE",
    "view_membership,choose_package": "CC_MEMBERSHIP_ACTION",
    view_receipt: "CC_RECEIPT",
    reply: "CC_STAFF_REPLY",
    contact_studio: "CC_CONTACT_STUDIO",
  };
  return categories[actions] ?? "CC_NOTIFICATION";
}

export function validateNotificationEventCatalog() {
  const errors: string[] = [];
  for (const [eventType, definition] of Object.entries(NOTIFICATION_EVENT_CATALOG)) {
    if (!definition.channels.length) errors.push(`missing_channels:${eventType}`);
    if (new Set(definition.channels).size !== definition.channels.length) {
      errors.push(`duplicate_channels:${eventType}`);
    }
    if (definition.tier === "critical") {
      if (!definition.immediate) errors.push(`critical_not_immediate:${eventType}`);
      if (definition.interruptionLevel !== "time-sensitive") {
        errors.push(`critical_not_time_sensitive:${eventType}`);
      }
      if (!definition.fallbackChannels.includes("whatsapp")) {
        errors.push(`critical_missing_whatsapp_fallback:${eventType}`);
      }
      if (!definition.fallbackChannels.includes("email")) {
        errors.push(`critical_missing_email_fallback:${eventType}`);
      }
    }
    if (definition.tier === "promotional") {
      if (definition.frequencyPolicy !== "promotional") {
        errors.push(`promotion_missing_frequency_policy:${eventType}`);
      }
      if (!definition.preference) errors.push(`promotion_missing_preference:${eventType}`);
    }
    if (definition.defaultEnabled && definition.copyStatus !== "approved") {
      errors.push(`enabled_without_approved_copy:${eventType}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
