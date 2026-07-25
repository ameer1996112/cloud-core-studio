import type { ConciergeChannel } from "@/lib/conciergePolicy";

type RenderedConciergeChannel = {
  channel: ConciergeChannel;
  templateId: string;
  templateVersion: number;
  subject: string | null;
  body: string;
  templateVariables?: string[];
};

type DeliveryTarget = {
  memberId: string | null;
  email: string | null;
  phoneE164: string | null;
};

function recipientAddress(channel: ConciergeChannel, recipient: DeliveryTarget) {
  if (channel === "email") return recipient.email?.trim() || null;
  if (channel === "whatsapp") return recipient.phoneE164?.trim() || null;
  return recipient.memberId;
}

function provider(channel: ConciergeChannel) {
  if (channel === "push") return "apns";
  if (channel === "email") return "resend";
  if (channel === "whatsapp") return "official_whatsapp";
  return "internal";
}

function metaLanguage(locale: "ar" | "he" | "en") {
  return locale === "en" ? "en_US" : locale;
}

export function buildConciergeMaterializationPlan(input: {
  decisionKey: string;
  templateKey: string;
  locale: "ar" | "he" | "en";
  rendered: RenderedConciergeChannel[];
  variables: Record<string, unknown>;
  recipient: DeliveryTarget;
  scheduledFor: string;
  expiresAt: string | null;
}) {
  return input.rendered.map((rendered) => {
    const address = recipientAddress(rendered.channel, input.recipient);
    const missingDestination = address === null ? `missing_${rendered.channel}_recipient` : null;
    return {
      snapshot: {
        templateId: rendered.templateId,
        templateVersion: rendered.templateVersion,
        locale: input.locale,
        channel: rendered.channel,
        renderedVariables: input.variables,
        finalSubject: rendered.subject,
        finalBody: rendered.body,
      },
      delivery: {
        channel: rendered.channel,
        provider: provider(rendered.channel),
        recipientAddress: address,
        status: missingDestination ? "suppressed" : "queued",
        errorCode: missingDestination,
        idempotencyKey: `${input.decisionKey}:${rendered.channel}`,
        scheduledFor: input.scheduledFor,
        expiresAt: input.expiresAt,
        providerPayload:
          rendered.channel === "whatsapp"
            ? {
                template_name: input.templateKey,
                template_language: metaLanguage(input.locale),
                parameters: (rendered.templateVariables ?? Object.keys(input.variables)).map(
                  (name) => String(input.variables[name]),
                ),
              }
            : {},
      },
    };
  });
}
