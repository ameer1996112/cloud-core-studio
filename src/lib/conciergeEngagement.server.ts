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

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
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

async function markObsolete(event: OutboxEvidence, db: any): Promise<boolean> {
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
    const payment = await db.from("payments").select("status").eq("id", paymentId).maybeSingle();
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

  const [consents, controls, intents, templates, reservations, devices, whatsappDeployments] =
    await Promise.all([
      db
        .from("consent_records")
        .select("channel,purpose")
        .eq("studio_id", input.studioId)
        .eq("communication_recipient_id", input.communicationRecipientId)
        .eq("locale", recipientResult.data.preferred_locale)
        .not("granted_at", "is", null)
        .is("revoked_at", null),
      db
        .from("concierge_channel_controls")
        .select("channel,enabled")
        .eq("studio_id", input.studioId),
      intentsQuery,
      db
        .from("concierge_template_versions")
        .select(
          "id,template_key,channel,locale,version,required_variables,subject_template,body_template",
        )
        .eq("studio_id", input.studioId)
        .eq("locale", recipientResult.data.preferred_locale)
        .eq("lifecycle_status", "approved"),
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
        .select("template_name,language")
        .eq("waba_id", process.env.META_WABA_ID?.trim() ?? "")
        .eq("approval_status", "APPROVED"),
    ]);
  for (const result of [
    consents,
    controls,
    intents,
    templates,
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
    const obsolete = await markObsolete(event, db);
    const firstBooking = await isFirstBooking(event, db);
    const isPayment = eventKind(event.event_type) === "payment_outcome";
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
    approvedTemplates: (templates.data ?? [])
      .filter((row: any) => {
        if (row.channel !== "whatsapp") return true;
        const providerLanguage = row.locale === "en" ? "en_US" : row.locale;
        return (whatsappDeployments.data ?? []).some(
          (deployment: { template_name: string; language: string }) =>
            deployment.template_name === row.template_key &&
            deployment.language === providerLanguage,
        );
      })
      .map((row: any) => ({
        id: row.id,
        templateKey: row.template_key,
        channel: row.channel,
        locale: row.locale,
        version: row.version,
        requiredVariables: row.required_variables,
        subjectTemplate: row.subject_template,
        bodyTemplate: row.body_template,
      })),
    variables: { member_name: recipientResult.data.display_name },
    deliveryTarget: {
      memberId: recipientResult.data.member_id,
      email: recipientResult.data.email,
      phoneE164: recipientResult.data.phone_e164,
    },
    correlationByActionId,
  };
}

export async function evaluateRecipientShadowDispatch(input: {
  studioId: string;
  communicationRecipientId: string;
  now: Date;
  journeyTypes?: string[];
}): Promise<DispatchEvaluation> {
  const state = await loadMemberEngagementState(input);
  return evaluateConciergeDispatch({ ...state, now: input.now });
}
