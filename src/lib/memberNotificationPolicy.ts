export type MemberNotificationCategory =
  | "activation"
  | "lesson_reminder"
  | "marketing"
  | "package"
  | "payment_confirmed"
  | "payment_failed"
  | "retention"
  | "schedule"
  | "urgent_class_change"
  | "waitlist";

export type MemberNotificationPreferences = {
  lessonReminders: boolean;
  scheduleUpdates: boolean;
  packageReminders: boolean;
  marketing: boolean;
  sound: boolean;
};

export type MemberNotificationDeliveryInput = {
  category: MemberNotificationCategory;
  preferences: MemberNotificationPreferences;
  hasActivePushDevice: boolean;
  isQuietHours: boolean;
  marketingPushesLast7Days: number;
  marketingPushesToday: number;
  duplicateWithin7Days: boolean;
};

export type MemberNotificationDeliveryDecision = {
  createInboxItem: boolean;
  sendPush: boolean;
  pushSound: boolean;
  sendWhatsapp: boolean;
  deferredByQuietHours: boolean;
  suppressedReason:
    | "channel_policy"
    | "duplicate"
    | "no_active_push_device"
    | "preference_disabled"
    | "quiet_hours"
    | "daily_frequency_limit"
    | "weekly_frequency_limit"
    | null;
};

const MARKETING_CATEGORIES = new Set<MemberNotificationCategory>([
  "activation",
  "marketing",
  "retention",
  "schedule",
]);

const SOUND_CATEGORIES = new Set<MemberNotificationCategory>([
  "lesson_reminder",
  "payment_failed",
  "urgent_class_change",
  "waitlist",
]);

function isPreferenceEnabled(
  category: MemberNotificationCategory,
  preferences: MemberNotificationPreferences,
) {
  if (category === "lesson_reminder" || category === "waitlist") {
    return preferences.lessonReminders;
  }
  if (category === "schedule") return preferences.scheduleUpdates;
  if (category === "package") return preferences.packageReminders;
  if (MARKETING_CATEGORIES.has(category)) return preferences.marketing;
  return true;
}

function whatsappFor(category: MemberNotificationCategory) {
  return (
    category === "payment_confirmed" ||
    category === "payment_failed" ||
    category === "urgent_class_change"
  );
}

export function decideMemberNotificationDelivery(
  input: MemberNotificationDeliveryInput,
): MemberNotificationDeliveryDecision {
  const sendWhatsapp = whatsappFor(input.category);

  if (input.category === "payment_confirmed") {
    return {
      createInboxItem: true,
      sendPush: false,
      pushSound: false,
      sendWhatsapp,
      deferredByQuietHours: false,
      suppressedReason: "channel_policy",
    };
  }

  const bypassQuietHours =
    input.category === "urgent_class_change" ||
    input.category === "payment_failed" ||
    input.category === "waitlist";
  if (!isPreferenceEnabled(input.category, input.preferences)) {
    return suppressed("preference_disabled", sendWhatsapp, false);
  }
  if (MARKETING_CATEGORIES.has(input.category)) {
    if (input.duplicateWithin7Days) return suppressed("duplicate", sendWhatsapp);
    if (input.marketingPushesToday >= 1) {
      return suppressed("daily_frequency_limit", sendWhatsapp);
    }
    if (input.marketingPushesLast7Days >= 3) {
      return suppressed("weekly_frequency_limit", sendWhatsapp);
    }
  }
  if (input.isQuietHours && !bypassQuietHours) {
    return {
      ...suppressed("quiet_hours", sendWhatsapp),
      deferredByQuietHours: true,
    };
  }
  if (!input.hasActivePushDevice) {
    return suppressed("no_active_push_device", sendWhatsapp);
  }

  return {
    createInboxItem: true,
    sendPush: true,
    pushSound: input.preferences.sound && SOUND_CATEGORIES.has(input.category),
    sendWhatsapp,
    deferredByQuietHours: false,
    suppressedReason: null,
  };
}

function suppressed(
  reason: Exclude<MemberNotificationDeliveryDecision["suppressedReason"], null>,
  sendWhatsapp: boolean,
  createInboxItem = true,
): MemberNotificationDeliveryDecision {
  return {
    createInboxItem,
    sendPush: false,
    pushSound: false,
    sendWhatsapp,
    deferredByQuietHours: false,
    suppressedReason: reason,
  };
}

export function decideLifecycleWhatsappFallback(input: {
  hasActivePushDevice: boolean;
  isThirtyDayEscalation: boolean;
  marketingConsent: boolean;
  requiresMarketingConsent: boolean;
}) {
  if (input.isThirtyDayEscalation || input.requiresMarketingConsent) {
    return input.marketingConsent;
  }
  return !input.hasActivePushDevice;
}

export function decidePaymentReminderActions(input: {
  status: "pending" | "failed" | "paid";
  ageHours: number;
}) {
  if (input.status === "paid") {
    return { createInbox: true, sendPush: false, sendWhatsapp: false };
  }
  if (input.status === "failed") {
    return { createInbox: true, sendPush: true, sendWhatsapp: true };
  }
  if (input.ageHours < 24) {
    return { createInbox: false, sendPush: false, sendWhatsapp: false };
  }
  return {
    createInbox: true,
    sendPush: true,
    sendWhatsapp: input.ageHours >= 72,
  };
}

export function activationCadenceStage(accountAgeDays: number) {
  if (!Number.isFinite(accountAgeDays) || accountAgeDays < 1) return null;
  if (accountAgeDays < 3) return "day1";
  if (accountAgeDays < 7) return "day3";
  if (accountAgeDays < 14) return "day7";
  return `week${Math.floor(accountAgeDays / 7)}`;
}
