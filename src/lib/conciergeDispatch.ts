import {
  chooseNextRecipientAction,
  decideBookingChannels,
  decidePaymentOutcome,
  type ConciergeChannel,
  type ContactRecord,
  type PendingRecipientAction,
  type RecipientPolicyState,
} from "@/lib/conciergePolicy";

export type DispatchAction = PendingRecipientAction & {
  metadata: {
    firstBooking?: boolean;
    paymentOutcome?:
      | "one_time_payment_succeeded"
      | "subscription_renewal_succeeded"
      | "payment_requires_action"
      | "payment_retry_scheduled"
      | "payment_terminally_failed"
      | "payment_recovered";
    retentionStage?: "initial" | "personal_whatsapp" | "admin_attention";
    waitlistExpiresSoon?: boolean;
  };
  deliveryVariables?: Record<string, unknown>;
};

export type ApprovedDispatchTemplate = {
  id: string;
  templateKey: string;
  channel: ConciergeChannel;
  locale: "ar" | "he" | "en";
  version: number;
  requiredVariables: string[];
  subjectTemplate: string | null;
  bodyTemplate: string;
  presentationVersion?: number;
  presentationKey?: string;
  presentationHash?: string;
  presentationContract?: Record<string, unknown>;
  emailShellVersion?: number | null;
  emailShellHash?: string | null;
  sourceContentHash?: string;
  providerTemplateName?: string | null;
  providerContentHash?: string | null;
  selectionId?: string | null;
};

type RenderedChannel = {
  channel: ConciergeChannel;
  templateId: string;
  templateVersion: number;
  subject: string | null;
  body: string;
  templateVariables: string[];
  presentationVersion: number;
  presentationKey: string | null;
  presentationHash: string | null;
  presentationContract: Record<string, unknown> | null;
  emailShellVersion: number | null;
  emailShellHash: string | null;
  sourceContentHash: string | null;
  providerTemplateName: string | null;
  providerContentHash: string | null;
  selectionId: string | null;
};

export type DispatchEvaluation = {
  evaluatedActionIds: string[];
  selectedActionId: string | null;
  selectedTemplateKey: string | null;
  channels: ConciergeChannel[];
  rendered: RenderedChannel[];
  suppressionReason:
    | "no_eligible_action"
    | "quiet_hours"
    | "six_hour_contact_cap"
    | "daily_total_contact_cap"
    | "daily_promotional_cap"
    | "weekly_promotional_cap"
    | "missing_consent"
    | "missing_approved_locale_template"
    | "missing_template_variables"
    | null;
  postponed: boolean;
  reasonCodes: string[];
  attentionReasons: string[];
  variables: Record<string, unknown>;
};

function desiredChannels(
  action: DispatchAction,
  recipient: RecipientPolicyState,
  deliveryMode: "shadow" | "test_only" | "live",
): ConciergeChannel[] {
  if (action.kind === "booking_confirmed") {
    return decideBookingChannels({
      firstBooking: action.metadata.firstBooking === true,
      recipient,
    });
  }
  if (action.kind === "class_cancelled" || action.kind === "class_time_changed") {
    const channels: ConciergeChannel[] = ["in_app"];
    if (recipient.hasPush && recipient.consents.push.has("operational")) channels.push("push");
    if (recipient.consents.whatsapp.has("operational")) channels.push("whatsapp");
    if (recipient.consents.email.has("operational")) channels.push("email");
    return channels;
  }
  if (action.kind === "weekly_schedule") {
    return recipient.hasPush && recipient.consents.push.has("schedule")
      ? (["in_app", "push"] as ConciergeChannel[])
      : (["in_app"] as ConciergeChannel[]);
  }
  if (action.kind === "lead_to_trial") {
    const channels: ConciergeChannel[] = ["in_app"];
    if (recipient.hasPush && recipient.consents.push.has("transactional")) channels.push("push");
    if (recipient.consents.email.has("transactional")) channels.push("email");
    return channels;
  }
  if (action.kind === "recommendation") {
    const channels: ConciergeChannel[] =
      recipient.hasPush && recipient.consents.push.has("promotional")
        ? ["in_app", "push"]
        : ["in_app"];
    if (deliveryMode === "test_only" && recipient.consents.whatsapp.has("promotional")) {
      channels.push("whatsapp");
    }
    return channels;
  }
  if (action.kind === "daily_briefing") {
    return recipient.hasPush && recipient.consents.push.has("operational")
      ? (["in_app", "push"] as ConciergeChannel[])
      : (["in_app"] as ConciergeChannel[]);
  }
  if (action.kind === "payment_outcome" && action.metadata.paymentOutcome) {
    const channels = decidePaymentOutcome(action.metadata.paymentOutcome).memberChannels.filter(
      (channel): channel is ConciergeChannel => {
        if (channel === "in_app") return true;
        if (channel === "push") {
          return recipient.hasPush && recipient.consents.push.has(action.purpose);
        }
        return recipient.consents[channel].has(action.purpose);
      },
    );
    if (
      deliveryMode === "test_only" &&
      recipient.consents.whatsapp.has(action.purpose) &&
      [
        "one_time_payment_succeeded",
        "subscription_renewal_succeeded",
        "payment_requires_action",
        "payment_terminally_failed",
      ].includes(action.metadata.paymentOutcome)
    ) {
      channels.push("whatsapp");
    }
    return channels;
  }
  if (action.kind === "retention") {
    if (
      action.metadata.retentionStage === "personal_whatsapp" &&
      recipient.consents.whatsapp.has("promotional")
    ) {
      return ["in_app", "whatsapp"] as ConciergeChannel[];
    }
    return recipient.hasPush && recipient.consents.push.has("promotional")
      ? (["in_app", "push"] as ConciergeChannel[])
      : (["in_app"] as ConciergeChannel[]);
  }
  if (action.kind === "waitlist_offer") {
    const channels: ConciergeChannel[] = ["in_app"];
    if (recipient.hasPush && recipient.consents.push.has("transactional")) channels.push("push");
    if (action.metadata.waitlistExpiresSoon && recipient.consents.whatsapp.has("transactional")) {
      channels.push("whatsapp");
    }
    return channels;
  }
  return ["in_app"];
}

function templateKey(action: DispatchAction) {
  if (action.kind === "booking_confirmed") {
    return action.metadata.firstBooking ? "booking_confirmed_first" : "booking_confirmed_repeat";
  }
  if (action.kind === "payment_outcome" && action.metadata.paymentOutcome) {
    const paymentTemplates = {
      one_time_payment_succeeded: "payment_one_time_succeeded",
      subscription_renewal_succeeded: "payment_subscription_renewal_succeeded",
      payment_requires_action: "payment_requires_action",
      payment_terminally_failed: "payment_terminally_failed",
      payment_recovered: "payment_recovered",
    } as const;
    if (action.metadata.paymentOutcome === "payment_retry_scheduled") {
      return "payment_requires_action";
    }
    return paymentTemplates[action.metadata.paymentOutcome];
  }
  return action.kind;
}

function renderValue(template: string, variables: Record<string, unknown>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) =>
    String(variables[key]),
  );
}

function referencedVariables(template: string | null) {
  if (!template) return [];
  return [...template.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((match) => match[1]);
}

export function evaluateConciergeDispatch(input: {
  now: Date;
  recipient: RecipientPolicyState;
  pendingActions: DispatchAction[];
  recentContacts: ContactRecord[];
  channelControls: Record<ConciergeChannel, boolean>;
  approvedTemplates: ApprovedDispatchTemplate[];
  variables: Record<string, unknown>;
  deliveryMode?: "shadow" | "test_only" | "live";
}): DispatchEvaluation {
  const arbitration = chooseNextRecipientAction({
    recipient: input.recipient,
    actions: input.pendingActions,
    recentContacts: input.recentContacts,
    now: input.now,
  });
  if (!arbitration.selected) {
    return {
      evaluatedActionIds: input.pendingActions.map((action) => action.id),
      selectedActionId: null,
      selectedTemplateKey: null,
      channels: [],
      rendered: [],
      suppressionReason: arbitration.suppressionReason,
      postponed: arbitration.postponed,
      reasonCodes: arbitration.suppressionReason ? [arbitration.suppressionReason] : [],
      attentionReasons: [],
      variables: input.variables,
    };
  }

  const action = input.pendingActions.find((item) => item.id === arbitration.selected?.id)!;
  const selectedVariables = { ...input.variables, ...(action.deliveryVariables ?? {}) };
  const selectedTemplateKey = templateKey(action);
  const reasonCodes = [`selected_priority:${action.priority}`];
  const attentionReasons: string[] = [];
  const enabledChannels = desiredChannels(
    action,
    input.recipient,
    input.deliveryMode ?? "live",
  ).filter((channel) => {
    if (input.channelControls[channel]) return true;
    reasonCodes.push(`channel_disabled:${channel}`);
    return false;
  });
  const rendered: RenderedChannel[] = [];
  let missingVariables = false;

  for (const channel of enabledChannels) {
    const approved = input.approvedTemplates.find(
      (candidate) =>
        candidate.templateKey === selectedTemplateKey &&
        candidate.channel === channel &&
        candidate.locale === input.recipient.locale,
    );
    if (!approved) {
      attentionReasons.push(
        `missing_template:${selectedTemplateKey}:${channel}:${input.recipient.locale}`,
      );
      continue;
    }
    const required = [
      ...new Set([
        ...approved.requiredVariables,
        ...referencedVariables(approved.subjectTemplate),
        ...referencedVariables(approved.bodyTemplate),
      ]),
    ];
    const missing = required.filter(
      (name) => selectedVariables[name] === undefined || selectedVariables[name] === null,
    );
    if (missing.length > 0) {
      missingVariables = true;
      reasonCodes.push(`missing_variables:${channel}:${missing.join(",")}`);
      continue;
    }
    rendered.push({
      channel,
      templateId: approved.id,
      templateVersion: approved.version,
      subject: approved.subjectTemplate
        ? renderValue(approved.subjectTemplate, selectedVariables)
        : null,
      body: renderValue(approved.bodyTemplate, selectedVariables),
      templateVariables: approved.requiredVariables,
      presentationVersion: approved.presentationVersion ?? 1,
      presentationKey: approved.presentationKey ?? null,
      presentationHash: approved.presentationHash ?? null,
      presentationContract: approved.presentationContract ?? null,
      emailShellVersion: approved.emailShellVersion ?? null,
      emailShellHash: approved.emailShellHash ?? null,
      sourceContentHash: approved.sourceContentHash ?? null,
      providerTemplateName: approved.providerTemplateName ?? null,
      providerContentHash: approved.providerContentHash ?? null,
      selectionId: approved.selectionId ?? null,
    });
  }

  const suppressionReason =
    rendered.length > 0
      ? null
      : missingVariables
        ? "missing_template_variables"
        : "missing_approved_locale_template";
  return {
    evaluatedActionIds: input.pendingActions.map((item) => item.id),
    selectedActionId: action.id,
    selectedTemplateKey,
    channels: rendered.map((item) => item.channel),
    rendered,
    suppressionReason,
    postponed: false,
    reasonCodes,
    attentionReasons,
    variables: selectedVariables,
  };
}
