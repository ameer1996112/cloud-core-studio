import type { ConciergeChannel } from "@/lib/conciergePolicy";
import { CONCIERGE_WHATSAPP_HEADER_URL } from "@/lib/conciergeTemplateCatalog";
import type { WhatsappTemplateComponent } from "@/lib/messagingProviders.server";

type RenderedConciergeChannel = {
  channel: ConciergeChannel;
  templateId: string;
  templateVersion: number;
  subject: string | null;
  body: string;
  templateVariables?: string[];
  presentationVersion?: number;
  presentationKey?: string | null;
  presentationHash?: string | null;
  presentationContract?: Record<string, unknown> | null;
  emailShellVersion?: number | null;
  emailShellHash?: string | null;
  sourceContentHash?: string | null;
  providerTemplateName?: string | null;
  providerContentHash?: string | null;
  selectionId?: string | null;
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

export function renderConciergePresentationFacts(
  contract: Record<string, unknown>,
  variables: Record<string, unknown>,
) {
  if (!Array.isArray(contract.facts)) {
    throw new Error("invalid_selected_presentation_fact_contract");
  }
  return contract.facts.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new Error("invalid_selected_presentation_fact_contract");
    }
    const fact = candidate as Record<string, unknown>;
    if (
      typeof fact.key !== "string" ||
      typeof fact.label !== "string" ||
      typeof fact.ltr !== "boolean"
    ) {
      throw new Error("invalid_selected_presentation_fact_contract");
    }
    const value = variables[fact.key];
    if (value === null || value === undefined || String(value).trim() === "") return [];
    return [{ key: fact.key, label: fact.label, value: String(value), ltr: fact.ltr }];
  });
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
    const presentationVersion = rendered.presentationVersion ?? 1;
    if (
      rendered.presentationKey !== presentationKey ||
      !rendered.presentationHash ||
      !rendered.presentationContract ||
      !rendered.sourceContentHash ||
      (rendered.channel === "email" && (!rendered.emailShellVersion || !rendered.emailShellHash))
    ) {
      throw new Error(`missing_selected_presentation_evidence:${rendered.channel}`);
    }
    const facts = renderConciergePresentationFacts(rendered.presentationContract, input.variables);
    const bodyComponent: WhatsappTemplateComponent = {
      type: "body",
      parameters: orderedVariables.map((text) => ({ type: "text", text })),
    };
    const whatsappComponents: WhatsappTemplateComponent[] = [
      ...(presentationVersion === 2
        ? [
            {
              type: "header" as const,
              parameters: [
                {
                  type: "image" as const,
                  image: { link: CONCIERGE_WHATSAPP_HEADER_URL },
                },
              ] as [{ type: "image"; image: { link: string } }],
            },
          ]
        : []),
      bodyComponent,
    ];
    if (
      rendered.channel === "whatsapp" &&
      (!rendered.providerTemplateName || !rendered.providerContentHash || !rendered.selectionId)
    ) {
      throw new Error("missing_whatsapp_deployment_selection");
    }
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
        presentationHash: rendered.presentationHash,
        presentationContract: rendered.presentationContract,
        renderedFacts: facts,
        emailShellVersion: rendered.emailShellVersion ?? null,
        emailShellHash: rendered.emailShellHash ?? null,
        sourceContentHash: rendered.sourceContentHash,
        journeyType: input.journeyType,
        actionUrl: input.actionByChannel[rendered.channel] ?? null,
        selectionId: rendered.selectionId ?? null,
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
                template_name: rendered.providerTemplateName,
                template_language: metaLanguage(input.locale),
                presentation_key: presentationKey,
                expected_content_hash: rendered.providerContentHash,
                selection_id: rendered.selectionId,
                components: whatsappComponents,
              }
            : {},
      },
    };
  });
}
