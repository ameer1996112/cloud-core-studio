import type {
  DeliveryFailureClass,
  DeliveryStatus,
  ExternalChannelAvailability,
  MessageChannel,
  MessageEventType,
  MessageLanguage,
} from "@/lib/messaging.types";
import { getMetaTemplateVariant, renderMessageContent } from "@/lib/messageTemplateCatalog";
import { channelsForEvent, deliveryAllowedByConsent, isQuietHours } from "@/lib/messagingPolicy";
import { studioDateTimeInputToIso } from "@/lib/studio-time";

const IMMEDIATE_EVENTS = new Set<MessageEventType>([
  "booking_confirmed",
  "booking_cancelled",
  "class_cancelled_by_admin",
  "class_time_changed",
  "payment_failed",
  "human_handoff",
]);

export type MaterializedDeliveryPlan = {
  channel: MessageChannel;
  provider: "internal" | "apns" | "resend" | "official_whatsapp";
  recipientAddress: string | null;
  status: DeliveryStatus;
  idempotencyKey: string;
  scheduledFor: string;
  expiresAt: string | null;
  failureClass: DeliveryFailureClass | null;
  errorCode: string | null;
  templateName: string | null;
  templateLanguage: string | null;
  templateParameters: string[];
};

export type MaterializedMessagePlan = {
  message: {
    outboxId: string;
    memberId: string;
    eventType: MessageEventType;
    language: MessageLanguage;
    templateKey: string;
    templateVersion: "v2";
    subject: string;
    body: string;
    memberVisible: boolean;
    audience: "member" | "admin";
    idempotencyKey: string;
  };
  deliveries: MaterializedDeliveryPlan[];
};

function nextRoutineWindow(now: Date) {
  if (!isQuietHours(now)) return now;
  const jerusalem = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => Number(jerusalem.find((value) => value.type === type)?.value);
  const hour = part("hour");
  const calendar = new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
  if (hour >= 20) calendar.setUTCDate(calendar.getUTCDate() + 1);
  const localInput = `${calendar.getUTCFullYear()}-${String(calendar.getUTCMonth() + 1).padStart(2, "0")}-${String(calendar.getUTCDate()).padStart(2, "0")}T08:00`;
  return new Date(studioDateTimeInputToIso(localInput));
}

function recipientFor(
  channel: MessageChannel,
  memberId: string,
  recipients: { whatsapp?: string | null; email?: string | null },
) {
  if (channel === "whatsapp") return recipients.whatsapp?.trim() || null;
  if (channel === "email") return recipients.email?.trim() || null;
  return memberId;
}

export function materializeMessagePlan(input: {
  outboxId: string;
  deduplicationKey: string;
  eventType: MessageEventType;
  memberId: string;
  language: MessageLanguage;
  variables: Record<string, unknown>;
  recipients: { whatsapp?: string | null; email?: string | null };
  preferences: {
    whatsappEnabled?: boolean | null;
    emailEnabled?: boolean | null;
    scheduleUpdates?: boolean | null;
  };
  externalChannels: ExternalChannelAvailability;
  approvedWhatsappVariants: ReadonlySet<string>;
  now: Date;
  expiresAt?: Date | null;
}): MaterializedMessagePlan {
  const rendered = renderMessageContent(input.eventType, input.language, input.variables);
  const messageIdempotencyKey = `message:${input.deduplicationKey}`;
  const metaVariant = getMetaTemplateVariant(input.eventType, input.language);
  const routineScheduledFor = IMMEDIATE_EVENTS.has(input.eventType)
    ? input.now
    : nextRoutineWindow(input.now);

  const deliveries = channelsForEvent(input.eventType).map((channel) => {
    const recipientAddress = recipientFor(channel, input.memberId, input.recipients);
    let status: DeliveryStatus = "queued";
    let failureClass: DeliveryFailureClass | null = null;
    let errorCode: string | null = null;

    if (channel !== "in_app" && !input.externalChannels[channel]) {
      status = "suppressed";
      errorCode = `${channel}_channel_disabled`;
    } else if (!deliveryAllowedByConsent(input.eventType, channel, input.preferences)) {
      status = "suppressed";
      errorCode = `${channel}_opted_out`;
    } else if ((channel === "whatsapp" || channel === "email") && !recipientAddress) {
      status = "suppressed";
      failureClass = "configuration";
      errorCode = `missing_${channel}_recipient`;
    } else if (channel === "whatsapp") {
      const approvedKey = metaVariant ? `${metaVariant.name}:${metaVariant.metaLanguage}` : null;
      if (!metaVariant || !approvedKey || !input.approvedWhatsappVariants.has(approvedKey)) {
        status = "suppressed";
        failureClass = "configuration";
        errorCode = "whatsapp_template_locale_unapproved";
      }
    }

    return {
      channel,
      provider:
        channel === "whatsapp"
          ? "official_whatsapp"
          : channel === "email"
            ? "resend"
            : channel === "push"
              ? "apns"
              : "internal",
      recipientAddress,
      status,
      idempotencyKey: `${messageIdempotencyKey}:${channel}`,
      scheduledFor:
        channel === "in_app" ? input.now.toISOString() : routineScheduledFor.toISOString(),
      expiresAt: input.expiresAt?.toISOString() ?? null,
      failureClass,
      errorCode,
      templateName: channel === "whatsapp" ? (metaVariant?.name ?? null) : null,
      templateLanguage: channel === "whatsapp" ? (metaVariant?.metaLanguage ?? null) : null,
      templateParameters:
        channel === "whatsapp" && metaVariant
          ? metaVariant.parameters.map((name) => String(input.variables[name] ?? ""))
          : [],
    } satisfies MaterializedDeliveryPlan;
  });

  return {
    message: {
      outboxId: input.outboxId,
      memberId: input.memberId,
      eventType: input.eventType,
      language: input.language,
      templateKey: rendered.metaTemplate ?? `${input.eventType}_v2`,
      templateVersion: "v2",
      subject: rendered.subject,
      body: rendered.body,
      memberVisible: input.eventType !== "human_handoff",
      audience: input.eventType === "human_handoff" ? "admin" : "member",
      idempotencyKey: messageIdempotencyKey,
    },
    deliveries,
  };
}
