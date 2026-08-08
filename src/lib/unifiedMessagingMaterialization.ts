import type {
  DeliveryFailureClass,
  DeliveryStatus,
  ExternalChannelAvailability,
  MessageChannel,
  MessageEventType,
  MessageLanguage,
  MessagingDeliveryPreferences,
} from "@/lib/messaging.types";
import { getMetaTemplateVariant, renderMessageContent } from "@/lib/messageTemplateCatalog";
import { channelsForEvent, deliveryAllowedByConsent, isQuietHours } from "@/lib/messagingPolicy";
import { notificationDefinition } from "@/lib/premiumNotificationCatalog";
import { studioDateTimeInputToIso } from "@/lib/studio-time";
import type { WhatsappTemplateComponent } from "@/lib/messagingProviders.server";
import { resolveConsolidatedWhatsappTemplate } from "@/lib/whatsappTemplateConsolidation";

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
  templateComponents: WhatsappTemplateComponent[];
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
    notificationFamily: ReturnType<typeof notificationDefinition>["family"];
    notificationTier: ReturnType<typeof notificationDefinition>["tier"];
    preferenceKey: ReturnType<typeof notificationDefinition>["preference"];
    interruptionLevel: ReturnType<typeof notificationDefinition>["interruptionLevel"];
    soundKey: ReturnType<typeof notificationDefinition>["sound"];
    actions: ReturnType<typeof notificationDefinition>["actions"];
  };
  deliveries: MaterializedDeliveryPlan[];
};

export function scheduledJourneyVariables(
  payload: Record<string, unknown>,
): Partial<Record<"class_count" | "item_count", number>> {
  const variables: Partial<Record<"class_count" | "item_count", number>> = {};
  for (const key of ["class_count", "item_count"] as const) {
    const value = Number(payload[key]);
    if (Number.isFinite(value) && value >= 0) variables[key] = Math.trunc(value);
  }
  return variables;
}

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
  memberVisible: boolean,
) {
  if (channel === "whatsapp") return recipients.whatsapp?.trim() || null;
  if (channel === "email") return recipients.email?.trim() || null;
  return memberVisible ? memberId : "admin_group";
}

export function materializeMessagePlan(input: {
  outboxId: string;
  deduplicationKey: string;
  eventType: MessageEventType;
  memberId: string;
  language: MessageLanguage;
  variables: Record<string, unknown>;
  recipients: { whatsapp?: string | null; email?: string | null };
  preferences: MessagingDeliveryPreferences;
  externalChannels: ExternalChannelAvailability;
  approvedWhatsappVariants: ReadonlySet<string>;
  enabledChannels?: ReadonlySet<MessageChannel>;
  now: Date;
  expiresAt?: Date | null;
}): MaterializedMessagePlan {
  const rendered = renderMessageContent(input.eventType, input.language, input.variables);
  const definition = notificationDefinition(input.eventType);
  const actions = (() => {
    if (input.eventType === "member_welcome") {
      if (input.variables.has_upcoming_booking === true) return ["view_class"] as const;
      if (
        input.variables.has_active_membership === false &&
        Number(input.variables.credits_remaining ?? 0) <= 0
      ) {
        return ["choose_package"] as const;
      }
      return ["view_schedule"] as const;
    }
    if (
      (input.eventType === "class_open_spots" || input.eventType === "class_recommendation") &&
      Number(input.variables.credits_remaining ?? 0) <= 0
    ) {
      return definition.actions.filter((action) => action !== "book_now");
    }
    return definition.actions;
  })();
  const messageIdempotencyKey = `message:${input.deduplicationKey}`;
  const legacyMetaVariant = getMetaTemplateVariant(input.eventType, input.language);
  const conciergeMetaVariant = resolveConsolidatedWhatsappTemplate({
    eventType: input.eventType,
    language: input.language,
    variables: input.variables,
    approvedWhatsappVariants: input.approvedWhatsappVariants,
  });
  const metaVariant = conciergeMetaVariant ?? legacyMetaVariant;
  const routineScheduledFor = definition.immediate ? input.now : nextRoutineWindow(input.now);

  const deliveries = channelsForEvent(input.eventType).map((channel) => {
    const recipientAddress = recipientFor(
      channel,
      input.memberId,
      input.recipients,
      definition.memberVisible,
    );
    let status: DeliveryStatus = "queued";
    let failureClass: DeliveryFailureClass | null = null;
    let errorCode: string | null = null;

    if (input.enabledChannels && !input.enabledChannels.has(channel)) {
      status = "suppressed";
      errorCode = "event_channel_not_enabled";
    } else if (channel !== "in_app" && !input.externalChannels[channel]) {
      status = "suppressed";
      errorCode = `${channel}_channel_disabled`;
    } else if (channel === "push" && input.variables.has_active_push_device === false) {
      status = "suppressed";
      errorCode = "no_active_push_device";
    } else if (!deliveryAllowedByConsent(input.eventType, channel, input.preferences)) {
      status = "suppressed";
      errorCode = `${channel}_opted_out`;
    } else if ((channel === "whatsapp" || channel === "email") && !recipientAddress) {
      status = "suppressed";
      failureClass = "configuration";
      errorCode = `missing_${channel}_recipient`;
    } else if (
      definition.tier === "reminder" &&
      definition.fallbackChannels.includes(channel as "whatsapp" | "email" | "push") &&
      channel !== "push" &&
      input.variables.has_active_push_device === true
    ) {
      status = "suppressed";
      errorCode = "push_preferred_for_fallback_channel";
    } else if (
      input.eventType === "payment_confirmed" &&
      channel === "whatsapp" &&
      input.variables.payment_was_failing !== true
    ) {
      status = "suppressed";
      errorCode = "payment_success_whatsapp_not_needed";
    } else if (
      input.eventType === "class_recommendation" &&
      channel === "whatsapp" &&
      input.variables.whatsapp_growth_escalation !== true
    ) {
      status = "suppressed";
      errorCode = "push_first_recommendation";
    } else if (
      input.eventType === "retention_reminder" &&
      channel === "whatsapp" &&
      input.variables.retention_stage !== "personal_whatsapp"
    ) {
      status = "suppressed";
      errorCode = "retention_whatsapp_not_due";
    } else if (
      input.eventType === "retention_reminder" &&
      channel === "push" &&
      input.variables.retention_stage === "personal_whatsapp"
    ) {
      status = "suppressed";
      errorCode = "retention_personal_whatsapp_only";
    } else if (channel === "whatsapp") {
      const approvedKey = metaVariant ? `${metaVariant.name}:${metaVariant.metaLanguage}` : null;
      if (!metaVariant || !approvedKey || !input.approvedWhatsappVariants.has(approvedKey)) {
        status = "suppressed";
        failureClass = "configuration";
        errorCode = "whatsapp_template_locale_unapproved";
      }
    }

    const scheduledFor =
      input.eventType === "payment_pending_reminder" && channel === "whatsapp"
        ? nextRoutineWindow(new Date(input.now.getTime() + 48 * 60 * 60_000))
        : routineScheduledFor;

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
      scheduledFor: channel === "in_app" ? input.now.toISOString() : scheduledFor.toISOString(),
      expiresAt: input.expiresAt?.toISOString() ?? null,
      failureClass,
      errorCode,
      templateName: channel === "whatsapp" ? (metaVariant?.name ?? null) : null,
      templateLanguage: channel === "whatsapp" ? (metaVariant?.metaLanguage ?? null) : null,
      templateComponents:
        channel === "whatsapp" && conciergeMetaVariant
          ? conciergeMetaVariant.components
          : channel === "whatsapp" && legacyMetaVariant && input.eventType === "weekly_schedule"
            ? [
                {
                  type: "header",
                  parameters: [
                    {
                      type: "image",
                      image: {
                        link: "https://cloudandcorestudio.com/brand/cloud-core-logo-full.png",
                      },
                    },
                  ],
                },
                {
                  type: "body",
                  parameters: legacyMetaVariant.parameters.map((name) => ({
                    type: "text",
                    text: String(input.variables[name] ?? ""),
                  })),
                },
              ]
            : channel === "whatsapp" && legacyMetaVariant
              ? [
                  {
                    type: "body",
                    parameters: legacyMetaVariant.parameters.map((name) => ({
                      type: "text",
                      text: String(input.variables[name] ?? ""),
                    })),
                  },
                ]
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
      memberVisible: definition.memberVisible,
      audience: definition.memberVisible ? "member" : "admin",
      idempotencyKey: messageIdempotencyKey,
      notificationFamily: definition.family,
      notificationTier: definition.tier,
      preferenceKey: definition.preference,
      interruptionLevel:
        definition.interruptionLevel === "time-sensitive" &&
        input.preferences.timeSensitive === false
          ? "active"
          : definition.interruptionLevel,
      soundKey: input.preferences.sound === false ? "none" : definition.sound,
      actions,
    },
    deliveries,
  };
}
