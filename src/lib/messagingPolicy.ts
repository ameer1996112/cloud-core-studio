import type {
  DeliveryFailureClass,
  DeliveryStatus,
  ExternalChannelAvailability,
  MessageChannel,
  MessageEventType,
  MessagingDeliveryPreferences,
} from "@/lib/messaging.types";
import { notificationDefinition } from "@/lib/premiumNotificationCatalog";

const STATUS_RANK: Partial<Record<DeliveryStatus, number>> = {
  queued: 0,
  sending: 1,
  accepted: 2,
  sent: 3,
  delivered: 4,
  read: 5,
};

const TERMINAL_STATUSES = new Set<DeliveryStatus>([
  "dead_letter",
  "suppressed",
  "expired",
  "cancelled",
  "delivery_unknown",
]);

const RETRY_DELAYS_MINUTES: Record<MessageChannel, readonly number[]> = {
  whatsapp: [1, 5, 30],
  email: [1, 5, 30, 120],
  push: [1, 5],
  in_app: [],
};

export type MessagingRuntime = {
  mode: "disabled" | "allowlist" | "live";
  recipientAllowlist: ReadonlySet<string>;
  channels: ExternalChannelAvailability;
};

export function channelsForEvent(eventType: MessageEventType): MessageChannel[] {
  return [...notificationDefinition(eventType).channels];
}

export function isEssentialMessageEvent(eventType: MessageEventType) {
  return ["class_cancelled_by_admin", "class_time_changed", "payment_failed"].includes(eventType);
}

export function requiresPromotionalFrequencyReservation(
  eventType: MessageEventType,
  staffTest: boolean,
) {
  return !staffTest && notificationDefinition(eventType).frequencyPolicy === "promotional";
}

export function isUnopenedSuccessfulPushMessage(input: {
  message_deliveries?: readonly { channel?: string | null; status?: string | null }[] | null;
  message_engagement_events?: readonly { event_type?: string | null }[] | null;
}) {
  const hasSuccessfulPush = (input.message_deliveries ?? []).some(
    (delivery) =>
      delivery.channel === "push" &&
      ["accepted", "sent", "delivered", "read"].includes(delivery.status ?? ""),
  );
  if (!hasSuccessfulPush) return false;
  return !(input.message_engagement_events ?? []).some((event) =>
    ["opened", "actioned", "converted"].includes(event.event_type ?? ""),
  );
}

export function shouldCancelReminderForDomainState(
  eventType: MessageEventType,
  bookingStatus: string | null | undefined,
  classStatus: string | null | undefined,
  expectedClassStartsAt?: string | null,
  currentClassStartsAt?: string | null,
) {
  if (eventType !== "class_reminder_planning" && eventType !== "class_reminder_final") {
    return false;
  }
  if (bookingStatus !== "booked" || classStatus !== "scheduled") return true;
  if (!expectedClassStartsAt) return false;
  if (!currentClassStartsAt) return true;
  const expected = new Date(expectedClassStartsAt).getTime();
  const current = new Date(currentClassStartsAt).getTime();
  return !Number.isFinite(expected) || !Number.isFinite(current) || expected !== current;
}

export function shouldCancelPaymentReminderForDomainState(
  eventType: MessageEventType,
  paymentStatus: string | null | undefined,
) {
  return eventType === "payment_pending_reminder" && paymentStatus !== "pending";
}

export function deliveryAllowedByConsent(
  eventType: MessageEventType,
  channel: MessageChannel,
  preferences: MessagingDeliveryPreferences,
) {
  const definition = notificationDefinition(eventType);
  // The inbox is the durable transactional record. Granular preferences govern
  // interruption/external delivery, never whether that record exists.
  if (channel === "in_app") return true;
  // This is an operational alert to studio-owned destinations, so member channel
  // preferences do not apply.
  if (eventType === "booking_registered_admin") return definition.channels.includes(channel);
  if (channel === "push" && preferences.pushEnabled === false) return false;
  if (channel === "whatsapp" && preferences.whatsappEnabled !== true) return false;
  if (channel === "email" && preferences.emailEnabled !== true) return false;
  if (isEssentialMessageEvent(eventType)) return true;
  if (definition.preference && !preferenceEnabled(definition.preference, preferences)) return false;
  return true;
}

function preferenceEnabled(
  preference: NonNullable<ReturnType<typeof notificationDefinition>["preference"]>,
  preferences: MessagingDeliveryPreferences,
) {
  switch (preference) {
    case "classOperations":
      return preferences.classOperations !== false;
    case "classReminders":
      return preferences.classReminders !== false;
    case "scheduleOpenings":
      return (preferences.scheduleOpenings ?? preferences.scheduleUpdates) === true;
    case "waitlist":
      return preferences.waitlist !== false;
    case "payments":
      return preferences.payments !== false;
    case "membership":
      return preferences.membership !== false;
    case "staffReplies":
      return preferences.staffReplies !== false;
    case "recommendations":
      return preferences.recommendations === true;
    case "marketing":
      return preferences.marketing === true;
  }
}

export function isQuietHours(at: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const minutes = hour * 60 + minute;
  return minutes < 8 * 60 || minutes >= 20 * 60 + 30;
}

export function advanceDeliveryStatus(current: DeliveryStatus, incoming: DeliveryStatus) {
  if (TERMINAL_STATUSES.has(current)) return current;
  if (incoming === "failed")
    return current === "read" || current === "delivered" ? current : incoming;
  const currentRank = STATUS_RANK[current];
  const incomingRank = STATUS_RANK[incoming];
  if (currentRank != null && incomingRank != null && incomingRank < currentRank) return current;
  return incoming;
}

export function computeDeliveryRetry(
  channel: MessageChannel,
  completedAttemptCount: number,
  failedAt: Date,
  retryAfterSeconds?: number | null,
) {
  const delay = RETRY_DELAYS_MINUTES[channel][Math.max(0, completedAttemptCount - 1)];
  if (delay == null) return null;
  const delayMs = Math.max(delay * 60_000, Math.max(0, retryAfterSeconds ?? 0) * 1_000);
  return new Date(failedAt.getTime() + delayMs);
}

export function classifyProviderFailure(
  channel: MessageChannel,
  input: { status?: number | null; timeout?: boolean; requestTransmitted?: boolean },
): DeliveryFailureClass {
  if (channel === "whatsapp" && input.timeout && input.requestTransmitted) return "ambiguous";
  if (input.status === 401 || input.status === 403) return "configuration";
  if (channel === "push" && (input.status === 404 || input.status === 410)) return "permanent";
  if (input.timeout || input.status === 408 || input.status === 409 || input.status === 429) {
    return "transient";
  }
  if (input.status != null && input.status >= 500) return "transient";
  return "permanent";
}

export function isWhatsappOptOut(body: string) {
  const normalized = body.trim().toLocaleLowerCase();
  return (
    /^(stop|unsubscribe|remove)(\b|$)/i.test(normalized) ||
    /(^|\s)(הסרה|הסר|בטל)(\s|$)/u.test(normalized) ||
    /(^|\s)(إلغاء|الغاء|توقف)(\s|$)/u.test(normalized)
  );
}

function flag(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function canonicalRecipientKey(value: string) {
  const normalized = value.trim().toLowerCase();
  const compactPhone = normalized.replace(/[\s().-]/g, "");
  if (!/^\+?\d+$/.test(compactPhone)) return normalized;

  const digits = compactPhone.replace(/\D/g, "");
  // Member records historically store Israeli mobile numbers in local 05xxxxxxxx form,
  // while the production allowlist and Meta use E.164. Canonicalize only that
  // unambiguous studio-local form; do not guess a country for arbitrary numbers.
  if (/^05\d{8}$/.test(digits)) return `+972${digits.slice(1)}`;
  if (/^9725\d{8}$/.test(digits)) return `+${digits}`;
  if (compactPhone.startsWith("+") && /^[1-9]\d{7,14}$/.test(digits)) return `+${digits}`;
  return normalized;
}

export function resolveMessagingRuntime(env: Record<string, string | undefined>): MessagingRuntime {
  const requestedMode = env.MESSAGING_DELIVERY_MODE?.trim() || "disabled";
  if (!(["disabled", "allowlist", "live"] as const).includes(requestedMode as never)) {
    throw new Error("invalid_messaging_delivery_mode");
  }
  const mode = requestedMode as MessagingRuntime["mode"];
  const allowlist = new Set(
    (env.MESSAGING_RECIPIENT_ALLOWLIST ?? "").split(",").map(canonicalRecipientKey).filter(Boolean),
  );
  if (mode === "allowlist" && allowlist.size === 0) throw new Error("messaging_allowlist_required");
  if (mode === "live" && env.MESSAGING_LIVE_WABA_CONFIRMATION !== "1009561255148806") {
    throw new Error("messaging_live_waba_confirmation_mismatch");
  }
  return {
    mode,
    recipientAllowlist: allowlist,
    channels: {
      whatsapp: flag(env.MESSAGING_WHATSAPP_ENABLED),
      email: flag(env.MESSAGING_EMAIL_ENABLED),
      push: flag(env.MESSAGING_PUSH_ENABLED),
    },
  };
}

export function runtimeAllowsRecipient(
  runtime: MessagingRuntime,
  channel: MessageChannel,
  recipient: string | null | undefined,
) {
  if (channel === "in_app") return true;
  if (runtime.mode === "disabled") return false;
  if (!runtime.channels[channel]) return false;
  if (runtime.mode === "live") return true;
  return Boolean(recipient && runtime.recipientAllowlist.has(canonicalRecipientKey(recipient)));
}

export function runtimeAllowsRolloutRecipient(
  runtime: MessagingRuntime,
  recipients: readonly (string | null | undefined)[],
) {
  if (runtime.mode === "disabled") return false;
  if (runtime.mode === "live") return true;
  return recipients.some((recipient) =>
    recipient ? runtime.recipientAllowlist.has(canonicalRecipientKey(recipient)) : false,
  );
}

export function conversationReplyMode(
  serviceWindowExpiresAt: string | null | undefined,
  now: Date,
  useHandoffTemplate: boolean,
): "freeform" | "template" | "rejected" {
  const windowOpen = Boolean(
    serviceWindowExpiresAt && new Date(serviceWindowExpiresAt).getTime() > now.getTime(),
  );
  if (windowOpen && !useHandoffTemplate) return "freeform";
  if (useHandoffTemplate) return "template";
  return "rejected";
}
