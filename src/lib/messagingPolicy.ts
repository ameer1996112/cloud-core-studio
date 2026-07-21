import type {
  DeliveryFailureClass,
  DeliveryStatus,
  ExternalChannelAvailability,
  MessageChannel,
  MessageEventType,
} from "@/lib/messaging.types";

const CHANNEL_MATRIX: Record<MessageEventType, readonly MessageChannel[]> = {
  booking_confirmed: ["in_app", "push", "whatsapp", "email"],
  booking_cancelled: ["in_app", "push", "whatsapp", "email"],
  class_cancelled_by_admin: ["in_app", "push", "whatsapp", "email"],
  class_time_changed: ["in_app", "push", "whatsapp", "email"],
  class_reminder_planning: ["in_app", "push", "whatsapp"],
  class_reminder_final: ["in_app", "push", "whatsapp"],
  waitlist_joined: ["in_app", "push"],
  waitlist_spot_available: ["in_app", "push", "whatsapp"],
  payment_request_received: ["in_app", "push", "email"],
  payment_pending_reminder: ["in_app", "push", "whatsapp"],
  payment_confirmed: ["in_app", "push", "whatsapp", "email"],
  payment_failed: ["in_app", "push", "whatsapp", "email"],
  receipt_issued: ["in_app", "email"],
  human_handoff: ["whatsapp", "in_app", "push"],
};

const ESSENTIAL_EVENTS = new Set<MessageEventType>([
  "class_cancelled_by_admin",
  "class_time_changed",
  "payment_failed",
]);

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
  return [...CHANNEL_MATRIX[eventType]];
}

export function isEssentialMessageEvent(eventType: MessageEventType) {
  return ESSENTIAL_EVENTS.has(eventType);
}

export function shouldCancelReminderForDomainState(
  eventType: MessageEventType,
  bookingStatus: string | null | undefined,
  classStatus: string | null | undefined,
) {
  if (eventType !== "class_reminder_planning" && eventType !== "class_reminder_final") {
    return false;
  }
  return bookingStatus !== "booked" || classStatus !== "scheduled";
}

export function deliveryAllowedByConsent(
  eventType: MessageEventType,
  channel: MessageChannel,
  preferences: { whatsappEnabled?: boolean | null; emailEnabled?: boolean | null },
) {
  if (channel === "in_app" || channel === "push") return true;
  if (isEssentialMessageEvent(eventType)) return true;
  if (channel === "whatsapp") return preferences.whatsappEnabled === true;
  return preferences.emailEnabled === true;
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

export function resolveMessagingRuntime(env: Record<string, string | undefined>): MessagingRuntime {
  const requestedMode = env.MESSAGING_DELIVERY_MODE?.trim() || "disabled";
  if (!(["disabled", "allowlist", "live"] as const).includes(requestedMode as never)) {
    throw new Error("invalid_messaging_delivery_mode");
  }
  const mode = requestedMode as MessagingRuntime["mode"];
  const allowlist = new Set(
    (env.MESSAGING_RECIPIENT_ALLOWLIST ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
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
  return Boolean(recipient && runtime.recipientAllowlist.has(recipient.trim().toLowerCase()));
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
