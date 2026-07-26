import { buildConciergePresentation } from "@/lib/conciergePresentation";
import {
  buildLegacyTransactionalPresentation,
  renderTransactionalEmail,
  TRANSACTIONAL_EMAIL_SHELL_HASH,
  TRANSACTIONAL_EMAIL_SHELL_VERSION,
  type RenderedTransactionalEmail,
} from "@/lib/transactionalEmail";
import type { MessageEventType } from "@/lib/messaging.types";
import { renderConciergePresentationFacts } from "@/lib/conciergeMaterialization";

const LEGACY_EVENT_BY_TEMPLATE_KEY: Record<string, MessageEventType> = {
  booking_confirmed_first: "booking_confirmed",
  booking_confirmed_repeat: "booking_confirmed",
  booking_cancelled: "booking_cancelled",
  class_cancelled: "class_cancelled_by_admin",
  class_time_changed: "class_time_changed",
  payment_one_time_succeeded: "payment_confirmed",
  payment_subscription_renewal_succeeded: "subscription_renewal_succeeded",
  payment_requires_action: "payment_failed",
  payment_terminally_failed: "payment_failed",
  payment_recovered: "payment_confirmed",
  waitlist_offer: "waitlist_spot_available",
  lead_to_trial: "trial_followup",
  recommendation: "class_recommendation",
  retention: "retention_reminder",
};

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
  input: ConciergeEmailInput & {
    presentationKey: string;
    presentationHash: string;
    presentationContract: Record<string, unknown>;
    renderedFacts: Array<{ key: string; label: string; value: string; ltr: boolean }>;
    emailShellVersion: number;
    emailShellHash: string;
    sourceContentHash: string;
  },
): RenderedTransactionalEmail & { presentationKey: string } {
  if (
    input.emailShellVersion !== TRANSACTIONAL_EMAIL_SHELL_VERSION ||
    input.emailShellHash !== TRANSACTIONAL_EMAIL_SHELL_HASH ||
    !/^[a-f0-9]{64}$/.test(input.presentationHash) ||
    !/^[a-f0-9]{64}$/.test(input.sourceContentHash) ||
    input.presentationContract.presentationKey !== input.presentationKey ||
    input.presentationContract.sourceContentHash !== input.sourceContentHash ||
    (input.presentationContract.actionUrl ?? null) !== (input.actionUrl ?? null)
  ) {
    throw new Error("concierge_presentation_evidence_mismatch");
  }
  let expectedFacts;
  try {
    expectedFacts = renderConciergePresentationFacts(input.presentationContract, input.variables);
  } catch {
    throw new Error("concierge_presentation_evidence_mismatch");
  }
  if (JSON.stringify(expectedFacts) !== JSON.stringify(input.renderedFacts)) {
    throw new Error("concierge_presentation_evidence_mismatch");
  }
  const v1Key = `${input.templateKey}:email:v1`;
  if (input.presentationKey === v1Key) {
    const eventType = input.presentationContract.eventType;
    if (
      input.presentationContract.schema !== "concierge_presentation_v1" ||
      typeof eventType !== "string" ||
      eventType !== (LEGACY_EVENT_BY_TEMPLATE_KEY[input.templateKey] ?? "human_handoff")
    ) {
      throw new Error("concierge_presentation_evidence_mismatch");
    }
    const presentation = buildLegacyTransactionalPresentation({
      key: input.presentationKey,
      eventType: eventType as MessageEventType,
      language: input.locale,
      actionUrl: input.actionUrl ?? null,
      publicBaseUrl: input.publicBaseUrl,
      facts: input.renderedFacts,
    });
    const rendered = renderTransactionalEmail({
      eventType: eventType as MessageEventType,
      language: input.locale,
      subject: input.subject,
      body: input.body,
      variables: input.variables,
      publicBaseUrl: input.publicBaseUrl,
      replyTo: input.replyTo,
      messageKey: input.messageKey,
      presentation,
    });
    return { ...rendered, presentationKey: input.presentationKey };
  }
  if (input.presentationKey !== `${input.templateKey}:email:v2`) {
    throw new Error("concierge_presentation_evidence_mismatch");
  }
  const categoryLabel = input.presentationContract.categoryLabel;
  const actionLabel = input.presentationContract.actionLabel;
  if (
    input.presentationContract.schema !== "concierge_presentation_v2" ||
    input.presentationContract.eventType !==
      (LEGACY_EVENT_BY_TEMPLATE_KEY[input.templateKey] ?? "human_handoff") ||
    typeof categoryLabel !== "string" ||
    !categoryLabel.trim() ||
    (input.actionUrl == null
      ? actionLabel !== null && actionLabel !== undefined
      : typeof actionLabel !== "string" || !actionLabel.trim())
  ) {
    throw new Error("concierge_presentation_evidence_mismatch");
  }
  const rendered = renderTransactionalEmail({
    eventType: "human_handoff",
    language: input.locale,
    subject: input.subject,
    body: input.body,
    variables: input.variables,
    publicBaseUrl: input.publicBaseUrl,
    replyTo: input.replyTo,
    messageKey: input.messageKey,
    presentation: {
      key: input.presentationKey,
      categoryLabel,
      action:
        input.actionUrl == null ? null : { label: actionLabel as string, url: input.actionUrl },
      facts: input.renderedFacts,
    },
  });
  return { ...rendered, presentationKey: input.presentationKey };
}
