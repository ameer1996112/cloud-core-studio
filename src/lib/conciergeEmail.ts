import { buildConciergePresentation } from "@/lib/conciergePresentation";
import {
  renderTransactionalEmail,
  type RenderedTransactionalEmail,
} from "@/lib/transactionalEmail";

type ConciergeEmailInput = {
  journeyType: string;
  templateKey: string;
  locale: "he" | "ar" | "en";
  subject: string;
  body: string;
  variables: Record<string, unknown>;
  publicBaseUrl: string;
  replyTo?: string | null;
  messageKey: string;
  contentMode?: "template" | "final";
  presentationKey?: string;
  actionUrl?: string | null;
};

export function renderConciergeEmail(
  input: ConciergeEmailInput,
): RenderedTransactionalEmail & { presentationKey: string } {
  const presentation = buildConciergePresentation({
    journeyType: input.journeyType,
    templateKey: input.templateKey,
    locale: input.locale,
    subject: input.subject,
    body: input.body,
    variables: input.variables,
    publicBaseUrl: input.publicBaseUrl,
    contentMode: input.contentMode,
  });
  const expectedActionUrl = presentation.action?.url ?? null;
  if (
    (input.presentationKey !== undefined && input.presentationKey !== presentation.key) ||
    (input.actionUrl !== undefined && input.actionUrl !== expectedActionUrl)
  ) {
    throw new Error("concierge_presentation_evidence_mismatch");
  }
  const immutablePresentation = {
    ...presentation,
    key: input.presentationKey ?? presentation.key,
    action:
      input.actionUrl === undefined
        ? presentation.action
        : input.actionUrl === null
          ? null
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

export function renderSelectedConciergeEmail(
  input: ConciergeEmailInput & { presentationKey: string },
): RenderedTransactionalEmail & { presentationKey: string } {
  const v1Key = `${input.templateKey}:email:v1`;
  if (input.presentationKey === v1Key) {
    if (input.actionUrl !== null) {
      throw new Error("concierge_presentation_evidence_mismatch");
    }
    const rendered = renderTransactionalEmail({
      eventType: "human_handoff",
      language: input.locale,
      subject: input.subject,
      body: input.body,
      variables: input.variables,
      actionUrl: null,
      publicBaseUrl: input.publicBaseUrl,
      replyTo: input.replyTo,
      messageKey: input.messageKey,
    });
    return { ...rendered, presentationKey: input.presentationKey };
  }
  if (input.presentationKey !== `${input.templateKey}:email:v2`) {
    throw new Error("concierge_presentation_evidence_mismatch");
  }
  return renderConciergeEmail({ ...input, contentMode: "final" });
}
