import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  evaluateConciergeDispatch,
  type ApprovedDispatchTemplate,
  type DispatchAction,
  type DispatchEvaluation,
} from "@/lib/conciergeDispatch";
import type {
  ConciergeChannel,
  ConciergePurpose,
  ContactRecord,
  RecipientPolicyState,
} from "@/lib/conciergePolicy";
import { selectEligibleConciergeTemplates } from "@/lib/conciergeDeliverySelection";

type IntentRow = {
  id: string;
  journey_type: string;
  purpose: ConciergePurpose;
  priority: number;
  eligible_at: string;
  expires_at: string | null;
  status: string;
  suppression_reason: string | null;
  journey_instance: { correlation_id: string } | Array<{ correlation_id: string }> | null;
};

type OutboxEvidence = {
  correlation_id: string;
  event_type: string;
  aggregate_id: string;
  participant_id: string | null;
  payload: Record<string, unknown>;
};

type PaymentEvidence = {
  id: string;
  member_id: string;
  amount?: number | string | null;
  currency?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
};

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function localizedEventDate(value: string, locale: "ar" | "he" | "en") {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : locale === "ar" ? "ar" : "en-GB", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

function localizedEventTime(value: string, locale: "ar" | "he" | "en") {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : locale === "ar" ? "ar" : "en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(parsed);
}

export function buildConciergeEventVariables(input: {
  memberName: string;
  locale: "ar" | "he" | "en";
  event: { payload?: Record<string, unknown> };
  studioClass?: { title?: string | null; starts_at?: string | null } | null;
  payment?: {
    amount?: number | string | null;
    currency?: string | null;
    paid_at?: string | null;
    created_at?: string | null;
  } | null;
}) {
  const variables: Record<string, unknown> = { member_name: input.memberName };
  if (input.studioClass?.title?.trim()) variables.class_name = input.studioClass.title.trim();
  if (input.studioClass?.starts_at) {
    const date = localizedEventDate(input.studioClass.starts_at, input.locale);
    const time = localizedEventTime(input.studioClass.starts_at, input.locale);
    if (date) variables.class_date = date;
    if (time) variables.class_time = time;
  }
  const amount = Number(input.payment?.amount);
  if (input.payment?.amount != null && Number.isFinite(amount)) {
    variables.amount = new Intl.NumberFormat(
      input.locale === "he" ? "he-IL" : input.locale === "ar" ? "ar" : "en-IL",
      {
        style: "currency",
        currency: input.payment?.currency?.trim() || "ILS",
      },
    ).format(amount);
  }
  const paymentDateValue = input.payment?.paid_at ?? input.payment?.created_at;
  if (paymentDateValue) {
    const paymentDate = localizedEventDate(paymentDateValue, input.locale);
    if (paymentDate) variables.payment_date = paymentDate;
  }
  const payload = input.event.payload ?? {};
  if (typeof payload.offer_expires_at === "string") {
    const expiresAt = localizedEventTime(payload.offer_expires_at, input.locale);
    if (expiresAt) variables.offer_expires_at = expiresAt;
  }
  for (const key of ["recommendation_summary", "week_of"] as const) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) variables[key] = value.trim();
  }
  return variables;
}

export function paymentEvidenceForRecipient(input: {
  event: Pick<OutboxEvidence, "participant_id" | "payload">;
  recipientMemberId: string | null;
  payments: readonly PaymentEvidence[];
}) {
  const paymentId =
    typeof input.event.payload.payment_id === "string" ? input.event.payload.payment_id : null;
  if (
    !paymentId ||
    !input.recipientMemberId ||
    !input.event.participant_id ||
    input.event.participant_id !== input.recipientMemberId
  ) {
    return null;
  }
  return (
    input.payments.find(
      (payment) =>
        payment.id === paymentId &&
        payment.member_id === input.event.participant_id &&
        payment.member_id === input.recipientMemberId,
    ) ?? null
  );
}

function activeConsentSet(
  rows: Array<{ channel: string; purpose: ConciergePurpose }>,
  channel: ConciergeChannel,
) {
  return new Set(rows.filter((row) => row.channel === channel).map((row) => row.purpose));
}

function eventKind(eventType: string) {
  const map: Record<string, string> = {
    "booking.confirmed": "booking_confirmed",
    "booking.cancelled": "booking_cancelled",
    "class.cancelled": "class_cancelled",
    "class.time_changed": "class_time_changed",
    "payment.succeeded": "payment_outcome",
    "payment.failed": "payment_outcome",
    "payment.requires_action": "payment_outcome",
    "payment.recovered": "payment_outcome",
    "waitlist.offer_created": "waitlist_offer",
    "schedule.published": "weekly_schedule",
    "attendance.recorded": "retention",
    "lead.received": "lead_to_trial",
    "recommendation.created": "recommendation",
    "daily_briefing.ready": "daily_briefing",
  };
  return map[eventType] ?? eventType.replaceAll(".", "_");
}

function paymentOutcome(event: OutboxEvidence) {
  if (event.event_type === "payment.succeeded") {
    return typeof event.payload.subscription_id === "string"
      ? ("subscription_renewal_succeeded" as const)
      : ("one_time_payment_succeeded" as const);
  }
  if (event.event_type === "payment.requires_action") return "payment_requires_action" as const;
  if (event.event_type === "payment.recovered") return "payment_recovered" as const;
  if (event.payload.retryable === true) return "payment_retry_scheduled" as const;
  return "payment_terminally_failed" as const;
}

async function markObsolete(
  event: OutboxEvidence,
  db: any,
  recipientMemberId: string | null,
): Promise<boolean> {
  const bookingId = typeof event.payload.booking_id === "string" ? event.payload.booking_id : null;
  if (bookingId && event.event_type === "booking.confirmed") {
    const booking = await db
      .from("bookings")
      .select("status,class:classes(status)")
      .eq("id", bookingId)
      .maybeSingle();
    if (booking.error) throw booking.error;
    const studioClass = relation(booking.data?.class ?? null) as { status?: string } | null;
    return booking.data?.status !== "booked" || studioClass?.status === "cancelled";
  }
  const paymentId = typeof event.payload.payment_id === "string" ? event.payload.payment_id : null;
  if (paymentId && ["payment.failed", "payment.requires_action"].includes(event.event_type)) {
    if (!recipientMemberId || event.participant_id !== recipientMemberId) return true;
    const payment = await db
      .from("payments")
      .select("status")
      .eq("id", paymentId)
      .eq("member_id", event.participant_id)
      .maybeSingle();
    if (payment.error) throw payment.error;
    return payment.data?.status === "paid";
  }
  return false;
}

async function isFirstBooking(event: OutboxEvidence, db: any) {
  if (event.event_type !== "booking.confirmed" || !event.participant_id) return false;
  const bookings = await db
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("member_id", event.participant_id);
  if (bookings.error) throw bookings.error;
  return (bookings.count ?? 0) <= 1;
}

export type MemberEngagementState = {
  recipient: RecipientPolicyState;
  actions: DispatchAction[];
  recentContacts: ContactRecord[];
  channelControls: Record<ConciergeChannel, boolean>;
  approvedTemplates: ApprovedDispatchTemplate[];
  variables: Record<string, unknown>;
  deliveryTarget: {
    memberId: string | null;
    email: string | null;
    phoneE164: string | null;
  };
  correlationByActionId: Record<string, string>;
};

export async function loadMemberEngagementState(input: {
  studioId: string;
  communicationRecipientId: string;
  now: Date;
  journeyTypes?: string[];
  deliveryMode: "shadow" | "test_only" | "live";
}): Promise<MemberEngagementState> {
  const db = supabaseAdmin as any;
  const recipientResult = await db
    .from("communication_recipients")
    .select("id,member_id,display_name,email,phone_e164,preferred_locale,is_adult,status")
    .eq("studio_id", input.studioId)
    .eq("id", input.communicationRecipientId)
    .single();
  if (recipientResult.error) throw recipientResult.error;
  if (recipientResult.data.status !== "active") throw new Error("recipient_inactive");
  const trustedProvider = await db
    .from("concierge_trusted_provider_settings")
    .select("whatsapp_waba_id")
    .eq("studio_id", input.studioId)
    .maybeSingle();
  if (trustedProvider.error) throw trustedProvider.error;
  const trustedWhatsappWabaId = trustedProvider.data?.whatsapp_waba_id ?? "";

  let intentsQuery = db
    .from("journey_intents")
    .select(
      "id,journey_type,purpose,priority,eligible_at,expires_at,status,suppression_reason,journey_instance:journey_instances(correlation_id)",
    )
    .eq("studio_id", input.studioId)
    .eq("communication_recipient_id", input.communicationRecipientId)
    .in("status", ["pending", "postponed", "suppressed"])
    .lte("eligible_at", input.now.toISOString())
    .order("priority", { ascending: true })
    .limit(100);
  if (input.journeyTypes?.length) {
    intentsQuery = intentsQuery.in("journey_type", input.journeyTypes);
  }

  const [
    consents,
    controls,
    intents,
    templates,
    deliveryVersions,
    deliverySelections,
    reservations,
    devices,
    whatsappDeployments,
  ] = await Promise.all([
    db
      .from("consent_records")
      .select("channel,purpose")
      .eq("studio_id", input.studioId)
      .eq("communication_recipient_id", input.communicationRecipientId)
      .eq("locale", recipientResult.data.preferred_locale)
      .not("granted_at", "is", null)
      .is("revoked_at", null),
    db.from("concierge_channel_controls").select("channel,enabled").eq("studio_id", input.studioId),
    intentsQuery,
    db
      .from("concierge_template_versions")
      .select(
        "id,template_key,channel,locale,version,lifecycle_status,approved_by,approved_at,content_hash,required_variables,subject_template,body_template",
      )
      .eq("studio_id", input.studioId)
      .eq("locale", recipientResult.data.preferred_locale)
      .is("retired_at", null),
    db
      .from("concierge_delivery_versions")
      .select(
        "id,template_key,channel,locale,source_template_id,source_template_version,source_content_hash,source_approved_by,source_approved_at,presentation_version,presentation_key,presentation_hash,presentation_contract,email_shell_version,email_shell_hash,presentation_approved_by,presentation_approved_at,provider_template_name,provider_content_hash",
      )
      .eq("studio_id", input.studioId)
      .eq("locale", recipientResult.data.preferred_locale),
    db
      .from("concierge_delivery_selections")
      .select("id,delivery_mode,delivery_version_id")
      .eq("studio_id", input.studioId)
      .is("retired_at", null)
      .eq("delivery_mode", input.deliveryMode === "test_only" ? "test_only" : "live"),
    db
      .from("frequency_reservations")
      .select("reserved_at,purpose")
      .eq("studio_id", input.studioId)
      .eq("communication_recipient_id", input.communicationRecipientId)
      .is("released_at", null)
      .gte("reserved_at", new Date(input.now.getTime() - 7 * 24 * 3_600_000).toISOString()),
    recipientResult.data.member_id
      ? db
          .from("member_push_tokens")
          .select("id")
          .eq("member_id", recipientResult.data.member_id)
          .eq("active", true)
          .eq("permission_status", "granted")
          .limit(1)
      : Promise.resolve({ data: [], error: null }),
    db
      .from("whatsapp_template_deployments")
      .select("waba_id,template_name,language,approval_status,content_hash")
      .eq("waba_id", trustedWhatsappWabaId),
  ]);
  for (const result of [
    consents,
    controls,
    intents,
    templates,
    deliveryVersions,
    deliverySelections,
    reservations,
    devices,
    whatsappDeployments,
  ]) {
    if (result.error) throw result.error;
  }

  const intentRows = (intents.data ?? []) as IntentRow[];
  const correlations = intentRows
    .map((intent) => relation(intent.journey_instance)?.correlation_id)
    .filter((value): value is string => Boolean(value));
  const evidenceResult =
    correlations.length > 0
      ? await db
          .from("domain_outbox")
          .select("correlation_id,event_type,aggregate_id,participant_id,payload")
          .eq("studio_id", input.studioId)
          .in("correlation_id", correlations)
      : { data: [], error: null };
  if (evidenceResult.error) throw evidenceResult.error;
  const evidence = (evidenceResult.data ?? []) as OutboxEvidence[];
  const classIds = [
    ...new Set(
      evidence
        .map((event) =>
          typeof event.payload.class_id === "string" ? event.payload.class_id : null,
        )
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const paymentIds = [
    ...new Set(
      evidence
        .map((event) =>
          typeof event.payload.payment_id === "string" ? event.payload.payment_id : null,
        )
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const [classesResult, paymentsResult] = await Promise.all([
    classIds.length
      ? db.from("classes").select("id,title,starts_at").in("id", classIds)
      : Promise.resolve({ data: [], error: null }),
    paymentIds.length
      ? db
          .from("payments")
          .select("id,member_id,amount,currency,paid_at,created_at")
          .in("id", paymentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (classesResult.error) throw classesResult.error;
  if (paymentsResult.error) throw paymentsResult.error;
  const classById = new Map((classesResult.data ?? []).map((row: { id: string }) => [row.id, row]));
  const paymentRows = (paymentsResult.data ?? []) as PaymentEvidence[];
  const consentRows = (consents.data ?? []) as Array<{
    channel: string;
    purpose: ConciergePurpose;
  }>;
  const actions: DispatchAction[] = [];
  const correlationByActionId: Record<string, string> = {};
  for (const intent of intentRows) {
    const correlationId = relation(intent.journey_instance)?.correlation_id;
    const event = evidence.find((row) => row.correlation_id === correlationId);
    if (!event) continue;
    correlationByActionId[intent.id] = event.correlation_id;
    const isPayment = eventKind(event.event_type) === "payment_outcome";
    const payment = isPayment
      ? paymentEvidenceForRecipient({
          event,
          recipientMemberId: recipientResult.data.member_id,
          payments: paymentRows,
        })
      : null;
    if (isPayment && !payment) continue;
    const obsolete = await markObsolete(event, db, recipientResult.data.member_id);
    const firstBooking = await isFirstBooking(event, db);
    actions.push({
      id: intent.id,
      kind: eventKind(event.event_type),
      purpose: intent.purpose,
      priority: intent.priority,
      eligibleAt: new Date(intent.eligible_at),
      expiresAt: intent.expires_at ? new Date(intent.expires_at) : undefined,
      urgent: intent.priority === 1,
      obsolete,
      metadata: {
        firstBooking,
        paymentOutcome: isPayment ? paymentOutcome(event) : undefined,
        waitlistExpiresSoon:
          event.event_type === "waitlist.offer_created" &&
          intent.expires_at !== null &&
          new Date(intent.expires_at).getTime() - input.now.getTime() <= 30 * 60_000,
      },
      deliveryVariables: buildConciergeEventVariables({
        memberName: recipientResult.data.display_name,
        locale: recipientResult.data.preferred_locale,
        event,
        studioClass:
          typeof event.payload.class_id === "string"
            ? (classById.get(event.payload.class_id) ?? null)
            : null,
        payment,
      }),
    });
  }

  return {
    recipient: {
      id: recipientResult.data.id,
      locale: recipientResult.data.preferred_locale,
      isAdult: recipientResult.data.is_adult,
      hasPush: (devices.data ?? []).length > 0,
      consents: {
        in_app: new Set(["transactional", "operational", "schedule", "promotional", "receipt"]),
        push: activeConsentSet(consentRows, "push"),
        email: activeConsentSet(consentRows, "email"),
        whatsapp: activeConsentSet(consentRows, "whatsapp"),
      },
    },
    actions,
    recentContacts: (reservations.data ?? []).map(
      (row: { reserved_at: string; purpose: string }) => ({
        sentAt: new Date(row.reserved_at),
        promotional: row.purpose === "promotional",
      }),
    ),
    channelControls: Object.fromEntries(
      (controls.data ?? []).map((row: { channel: string; enabled: boolean }) => [
        row.channel,
        row.enabled,
      ]),
    ) as Record<ConciergeChannel, boolean>,
    approvedTemplates: selectEligibleConciergeTemplates({
      templates: templates.data ?? [],
      versions: deliveryVersions.data ?? [],
      selections: deliverySelections.data ?? [],
      deployments: whatsappDeployments.data ?? [],
      deliveryMode: input.deliveryMode,
      wabaId: trustedWhatsappWabaId,
    }),
    variables: { member_name: recipientResult.data.display_name },
    deliveryTarget: {
      memberId: recipientResult.data.member_id,
      email: recipientResult.data.email,
      phoneE164: recipientResult.data.phone_e164,
    },
    trustedWhatsappWabaId,
    correlationByActionId,
  };
}

export async function evaluateRecipientShadowDispatch(input: {
  studioId: string;
  communicationRecipientId: string;
  now: Date;
  journeyTypes?: string[];
  deliveryMode?: "shadow" | "test_only" | "live";
}): Promise<DispatchEvaluation> {
  const deliveryMode = input.deliveryMode ?? "shadow";
  const state = await loadMemberEngagementState({ ...input, deliveryMode });
  return evaluateConciergeDispatch({
    ...state,
    pendingActions: state.actions,
    now: input.now,
    deliveryMode,
  });
}
