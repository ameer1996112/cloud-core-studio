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
  const rendered = renderTransactionalEmail({
    eventType: "human_handoff",
    language: input.locale,
    subject: presentation.subject,
    body: presentation.body,
    variables: input.variables,
    publicBaseUrl: input.publicBaseUrl,
    replyTo: input.replyTo,
    messageKey: input.messageKey,
    presentation: {
      key: presentation.key,
      categoryLabel: presentation.categoryLabel,
      action: presentation.action,
      facts: presentation.facts,
    },
  });

  return { ...rendered, presentationKey: presentation.key };
}
