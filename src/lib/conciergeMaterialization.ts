import type { ConciergeChannel } from "@/lib/conciergePolicy";
import {
  conciergeWhatsappTemplateName,
  CONCIERGE_WHATSAPP_HEADER_URL,
} from "@/lib/conciergeTemplateCatalog";
import type { WhatsappTemplateComponent } from "@/lib/messagingProviders.server";

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

type ChannelPresentation = Partial<Record<ConciergeChannel, string>>;
type ChannelAction = Partial<Record<ConciergeChannel, string | null>>;

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
  journeyType: string;
  presentationByChannel: ChannelPresentation;
  actionByChannel: ChannelAction;
  locale: "ar" | "he" | "en";
  rendered: RenderedConciergeChannel[];
  variables: Record<string, unknown>;
  recipient: DeliveryTarget;
  scheduledFor: string;
  expiresAt: string | null;
}) {
  return input.rendered.map((rendered) => {
    const presentationKey = input.presentationByChannel[rendered.channel];
    if (!presentationKey) {
      throw new Error(`missing_concierge_presentation:${rendered.channel}`);
    }
    const address = recipientAddress(rendered.channel, input.recipient);
    const missingDestination = address === null ? `missing_${rendered.channel}_recipient` : null;
    const orderedVariables = (rendered.templateVariables ?? Object.keys(input.variables)).map(
      (name) => String(input.variables[name]),
    );
    const whatsappComponents: WhatsappTemplateComponent[] = [
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
        parameters: orderedVariables.map((text) => ({ type: "text", text })),
      },
    ];
    return {
      snapshot: {
        templateId: rendered.templateId,
        templateVersion: rendered.templateVersion,
        locale: input.locale,
        channel: rendered.channel,
        renderedVariables: input.variables,
        finalSubject: rendered.subject,
        finalBody: rendered.body,
        presentationKey,
        journeyType: input.journeyType,
        actionUrl: input.actionByChannel[rendered.channel] ?? null,
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
                template_name: conciergeWhatsappTemplateName(input.templateKey),
                template_language: metaLanguage(input.locale),
                presentation_key: `${input.templateKey}:whatsapp:v2`,
                components: whatsappComponents,
              }
            : {},
      },
    };
  });
}
