import {
  CONCIERGE_WHATSAPP_HEADER_URL,
  conciergeWhatsappTemplateDefinition,
  conciergeWhatsappTemplateName,
} from "@/lib/conciergeTemplateCatalog";
import type { MessageEventType, MessageLanguage } from "@/lib/messaging.types";
import type { WhatsappTemplateComponent } from "@/lib/messagingProviders.server";
import {
  buildConciergeWhatsappPresentation,
  conciergePremiumWhatsappTemplateDefinition,
} from "@/lib/conciergePresentation";

const META_LANGUAGE = { he: "he", ar: "ar", en: "en_US" } as const;

const CONCIERGE_TEMPLATE_BY_EVENT: Partial<Record<MessageEventType, string>> = {
  booking_cancelled: "booking_cancelled",
  class_cancelled_by_admin: "class_cancelled",
  class_time_changed: "class_time_changed",
  class_reminder_planning: "class_reminder_planning",
  class_reminder_final: "class_reminder_final",
  class_recommendation: "recommendation",
  waitlist_spot_available: "waitlist_offer",
  payment_pending_reminder: "payment_pending",
  human_handoff: "human_handoff",
  retention_reminder: "retention",
};

export function isConciergeMigratedEventType(eventType: MessageEventType) {
  return (
    eventType === "booking_confirmed" ||
    eventType === "payment_confirmed" ||
    eventType === "subscription_renewal_succeeded" ||
    eventType === "payment_failed" ||
    eventType === "subscription_renewal_failed" ||
    Boolean(CONCIERGE_TEMPLATE_BY_EVENT[eventType])
  );
}

function conciergeTemplateKey(eventType: MessageEventType, variables: Record<string, unknown>) {
  if (eventType === "booking_confirmed") {
    return variables.first_booking === true
      ? "booking_confirmed_first"
      : "booking_confirmed_repeat";
  }
  if (eventType === "payment_confirmed") {
    return variables.subscription_renewal === true
      ? "payment_subscription_renewal_succeeded"
      : "payment_one_time_succeeded";
  }
  if (eventType === "subscription_renewal_succeeded") {
    return "payment_subscription_renewal_succeeded";
  }
  if (eventType === "payment_failed" || eventType === "subscription_renewal_failed") {
    return variables.payment_terminal === true
      ? "payment_terminally_failed"
      : "payment_requires_action";
  }
  return CONCIERGE_TEMPLATE_BY_EVENT[eventType] ?? null;
}

export type ConsolidatedWhatsappTemplate = {
  name: string;
  metaLanguage: "he" | "ar" | "en_US";
  components: WhatsappTemplateComponent[];
};

export function resolveConsolidatedWhatsappTemplate(input: {
  eventType: MessageEventType;
  language: MessageLanguage;
  variables: Record<string, unknown>;
  approvedWhatsappVariants?: ReadonlySet<string>;
}): ConsolidatedWhatsappTemplate | null {
  const templateKey = conciergeTemplateKey(input.eventType, input.variables);
  if (!templateKey) return null;
  const brandedDefinition = conciergeWhatsappTemplateDefinition(templateKey, input.language);
  const premiumDefinition = conciergePremiumWhatsappTemplateDefinition(templateKey, input.language);
  if (!brandedDefinition && !premiumDefinition) return null;

  const premiumProviderName = premiumDefinition?.providerTemplateName;
  if (
    premiumProviderName &&
    input.approvedWhatsappVariants?.has(`${premiumProviderName}:${META_LANGUAGE[input.language]}`)
  ) {
    const premium = buildConciergeWhatsappPresentation({
      templateKey,
      locale: input.language,
      variables: input.variables,
    });
    return {
      name: premium.providerTemplateName,
      metaLanguage: META_LANGUAGE[input.language],
      components: [
        {
          type: "header",
          parameters: [
            {
              type: "image",
              image: { link: CONCIERGE_WHATSAPP_HEADER_URL },
            },
          ],
        },
        {
          type: "body",
          parameters: premium.parameters.map((text) => ({ type: "text" as const, text })),
        },
      ],
    };
  }

  if (!brandedDefinition) return null;
  const brandedProviderName = conciergeWhatsappTemplateName(templateKey);
  if (
    input.approvedWhatsappVariants &&
    !input.approvedWhatsappVariants.has(`${brandedProviderName}:${META_LANGUAGE[input.language]}`)
  ) {
    return null;
  }

  return {
    name: brandedProviderName,
    metaLanguage: META_LANGUAGE[input.language],
    components: [
      {
        type: "header",
        parameters: [
          {
            type: "image",
            image: { link: CONCIERGE_WHATSAPP_HEADER_URL },
          },
        ],
      },
      {
        type: "body",
        parameters: [
          {
            type: "text",
            text: String(input.variables.member_name ?? ""),
          },
        ],
      },
    ],
  };
}

export type LegacyTemplateRetirementDecision =
  | { eligible: true; reason: "never_used" | "unused_for_seven_days" }
  | { eligible: false; reason: "legacy_only_flow" | "recent_usage" };

export function classifyLegacyTemplateRetirement(input: {
  now: Date;
  lastUsedAt: Date | null;
  stillRequired: boolean;
}): LegacyTemplateRetirementDecision {
  if (input.stillRequired) return { eligible: false, reason: "legacy_only_flow" };
  if (!input.lastUsedAt) return { eligible: true, reason: "never_used" };

  const sevenDaysAgo = input.now.getTime() - 7 * 24 * 60 * 60_000;
  return input.lastUsedAt.getTime() <= sevenDaysAgo
    ? { eligible: true, reason: "unused_for_seven_days" }
    : { eligible: false, reason: "recent_usage" };
}
