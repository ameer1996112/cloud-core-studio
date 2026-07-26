import { buildConciergePresentation } from "@/lib/conciergePresentation";
import {
  renderTransactionalEmail,
  type RenderedTransactionalEmail,
} from "@/lib/transactionalEmail";

export function renderConciergeEmail(input: {
  journeyType: string;
  templateKey: string;
  locale: "he" | "ar" | "en";
  subject: string;
  body: string;
  variables: Record<string, unknown>;
  publicBaseUrl: string;
  replyTo?: string | null;
  messageKey: string;
  presentationKey?: string;
  actionUrl?: string | null;
}): RenderedTransactionalEmail & { presentationKey: string } {
  const presentation = buildConciergePresentation({
    journeyType: input.journeyType,
    templateKey: input.templateKey,
    locale: input.locale,
    subject: input.subject,
    body: input.body,
    variables: input.variables,
    publicBaseUrl: input.publicBaseUrl,
  });
  if (
    (input.presentationKey !== undefined && input.presentationKey !== presentation.key) ||
    (input.actionUrl !== undefined && input.actionUrl !== presentation.action?.url)
  ) {
    throw new Error("concierge_presentation_evidence_mismatch");
  }
  const immutablePresentation = {
    ...presentation,
    key: input.presentationKey ?? presentation.key,
    action:
      input.actionUrl === undefined
        ? presentation.action
        : presentation.action
          ? { ...presentation.action, url: input.actionUrl }
          : null,
  };
  const rendered = renderTransactionalEmail({
    eventType: "human_handoff",
    language: input.locale,
    subject: immutablePresentation.subject,
    body: immutablePresentation.body,
    variables: input.variables,
    publicBaseUrl: input.publicBaseUrl,
    replyTo: input.replyTo,
    messageKey: input.messageKey,
    presentation: {
      key: immutablePresentation.key,
      categoryLabel: immutablePresentation.categoryLabel,
      action: immutablePresentation.action,
      facts: immutablePresentation.facts,
    },
  });

  return { ...rendered, presentationKey: immutablePresentation.key };
}
