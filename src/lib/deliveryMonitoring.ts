import type { DeliveryFailureClass, DeliveryStatus, MessageChannel } from "@/lib/messaging.types";
import type { Lang } from "@/lib/i18n";

const EVENT_LABELS: Partial<Record<string, Record<Lang, string>>> = {
  class_reminder_planning: {
    en: "Class reminder",
    he: "תזכורת לשיעור",
    ar: "تذكير بالحصة",
  },
  class_reminder_final: {
    en: "Final class reminder",
    he: "תזכורת אחרונה לשיעור",
    ar: "التذكير الأخير بالحصة",
  },
};

const POLICY_REASON_LABELS: Partial<Record<string, Record<Lang, string>>> = {
  push_preferred_for_fallback_channel: {
    en: "WhatsApp fallback not needed · Push active",
    he: "WhatsApp גיבוי לא נדרש · Push פעיל",
    ar: "لا حاجة إلى WhatsApp الاحتياطي · Push فعّال",
  },
  no_active_push_device: {
    en: "No active device",
    he: "אין מכשיר פעיל",
    ar: "لا يوجد جهاز فعّال",
  },
  whatsapp_opted_out: {
    en: "WhatsApp disabled by member",
    he: "WhatsApp כבוי ללקוחה",
    ar: "WhatsApp معطّل من قِبل المشتركة",
  },
};

export function deliveryEventLabel(eventType: string | null, lang: Lang) {
  if (!eventType) return "—";
  return (
    EVENT_LABELS[eventType]?.[lang] ??
    eventType
      .split("_")
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" ")
  );
}

export function deliveryPolicyReason(errorCode: string | null, lang: Lang) {
  if (!errorCode) return null;
  return POLICY_REASON_LABELS[errorCode]?.[lang] ?? null;
}

export type DeliveryMonitorMember = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  preferred_language: string | null;
  status: string | null;
};

export type DeliveryMonitorMessage = {
  id: string;
  event_type: string | null;
  subject: string | null;
  member_id: string | null;
  language: string | null;
  template_key: string | null;
  template_version: string | null;
  created_at: string;
  member: DeliveryMonitorMember | null;
};

export type DeliveryMonitorAttempt = {
  id: string;
  attempt_number: number;
  provider: string | null;
  started_at: string;
  finished_at: string | null;
  outcome: string | null;
  provider_http_status: number | null;
  provider_error_code: string | null;
  failure_class: DeliveryFailureClass | null;
  retry_after_seconds: number | null;
  next_attempt_at: string | null;
};

export type DeliveryMonitorTarget = {
  id: string;
  status: string;
  attempt_count: number;
  failure_class: DeliveryFailureClass | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
};

export type DeliveryTrafficKind = "live" | "test" | "system" | "historical";

export type DeliveryMonitorRow = {
  id: string;
  message_id: string;
  channel: MessageChannel;
  provider: string | null;
  status: DeliveryStatus;
  provider_status: string | null;
  attempt_count: number;
  failure_class: DeliveryFailureClass | null;
  error_code: string | null;
  error_message: string | null;
  scheduled_for: string;
  next_attempt_at: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
  traffic_kind: DeliveryTrafficKind;
  message: DeliveryMonitorMessage | null;
  attempts: DeliveryMonitorAttempt[];
  targets: DeliveryMonitorTarget[];
};

export type DeliveryMonitorSummary = {
  total: number;
  successfulHandoffs: number;
  providerConfirmed: number;
  needsAttention: number;
  inFlight: number;
  policySkipped: number;
  membersReached: number;
};

export type DeliveryMonitorResponse = {
  deliveries: DeliveryMonitorRow[];
  summary: DeliveryMonitorSummary;
  summaries: Record<DeliveryTrafficKind | "all", DeliveryMonitorSummary>;
  generatedAt: string;
  windowHours: number;
};

export type DeliveryMonitorFilters = {
  query: string;
  traffic: DeliveryTrafficKind | "all";
  channel: "all" | MessageChannel;
  status: "all" | DeliveryStatus | "attention" | "successful" | "not_sent";
  memberId: string | null;
};

const SUCCESSFUL_HANDOFF_STATUSES = new Set<DeliveryStatus>([
  "accepted",
  "sent",
  "delivered",
  "read",
]);
const PROVIDER_CONFIRMED_STATUSES = new Set<DeliveryStatus>(["delivered", "read"]);
const ATTENTION_STATUSES = new Set<DeliveryStatus>(["failed", "dead_letter", "delivery_unknown"]);
const IN_FLIGHT_STATUSES = new Set<DeliveryStatus>(["queued", "sending"]);
const NOT_SENT_STATUSES = new Set<DeliveryStatus>(["suppressed", "expired", "cancelled"]);

export function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export function classifyDeliveryTraffic(input: {
  eventType?: string | null;
  audience?: string | null;
  staffTest?: unknown;
  aggregateType?: string | null;
  templateVersion?: string | null;
  legacySourceTable?: string | null;
}): DeliveryTrafficKind {
  if (input.staffTest === true || input.aggregateType === "notification_staff_test") return "test";
  if (input.templateVersion === "legacy" || input.legacySourceTable) return "historical";
  if (input.audience === "admin" || input.eventType === "delivery_failure") return "system";
  return "live";
}

export function isDeliveryAttention(status: DeliveryStatus) {
  return ATTENTION_STATUSES.has(status);
}

export function isDeliveryRetryCandidate(
  delivery: Pick<DeliveryMonitorRow, "status" | "failure_class" | "expires_at">,
  now = new Date(),
) {
  if (!(["failed", "dead_letter"] as DeliveryStatus[]).includes(delivery.status)) return false;
  if (delivery.failure_class && delivery.failure_class !== "transient") return false;
  return !delivery.expires_at || new Date(delivery.expires_at) > now;
}

export function summarizeDeliveries(
  deliveries: Array<Pick<DeliveryMonitorRow, "status" | "message">>,
): DeliveryMonitorSummary {
  const reachedMembers = new Set<string>();
  let successfulHandoffs = 0;
  let providerConfirmed = 0;
  let needsAttention = 0;
  let inFlight = 0;
  let policySkipped = 0;

  for (const delivery of deliveries) {
    if (SUCCESSFUL_HANDOFF_STATUSES.has(delivery.status)) {
      successfulHandoffs += 1;
      if (delivery.message?.member_id) reachedMembers.add(delivery.message.member_id);
    }
    if (PROVIDER_CONFIRMED_STATUSES.has(delivery.status)) providerConfirmed += 1;
    if (ATTENTION_STATUSES.has(delivery.status)) needsAttention += 1;
    if (IN_FLIGHT_STATUSES.has(delivery.status)) inFlight += 1;
    if (NOT_SENT_STATUSES.has(delivery.status)) policySkipped += 1;
  }

  return {
    total: deliveries.length,
    successfulHandoffs,
    providerConfirmed,
    needsAttention,
    inFlight,
    policySkipped,
    membersReached: reachedMembers.size,
  };
}

export function summarizeDeliveriesByTraffic(
  deliveries: Array<Pick<DeliveryMonitorRow, "status" | "message" | "traffic_kind">>,
): Record<DeliveryTrafficKind | "all", DeliveryMonitorSummary> {
  return {
    live: summarizeDeliveries(deliveries.filter((delivery) => delivery.traffic_kind === "live")),
    test: summarizeDeliveries(deliveries.filter((delivery) => delivery.traffic_kind === "test")),
    system: summarizeDeliveries(
      deliveries.filter((delivery) => delivery.traffic_kind === "system"),
    ),
    historical: summarizeDeliveries(
      deliveries.filter((delivery) => delivery.traffic_kind === "historical"),
    ),
    all: summarizeDeliveries(deliveries),
  };
}

export function filterDeliveryRows(
  deliveries: DeliveryMonitorRow[],
  filters: DeliveryMonitorFilters,
) {
  const query = filters.query.trim().toLocaleLowerCase();
  return deliveries.filter((delivery) => {
    const member = delivery.message?.member;
    if (filters.traffic !== "all" && delivery.traffic_kind !== filters.traffic) return false;
    if (filters.memberId && member?.id !== filters.memberId) return false;
    if (filters.channel !== "all" && delivery.channel !== filters.channel) return false;
    if (filters.status !== "all") {
      if (filters.status === "attention" && !ATTENTION_STATUSES.has(delivery.status)) return false;
      if (filters.status === "successful" && !SUCCESSFUL_HANDOFF_STATUSES.has(delivery.status)) {
        return false;
      }
      if (filters.status === "not_sent" && !NOT_SENT_STATUSES.has(delivery.status)) return false;
      if (
        !["attention", "successful", "not_sent"].includes(filters.status) &&
        delivery.status !== filters.status
      ) {
        return false;
      }
    }
    if (!query) return true;
    return [
      member?.name,
      member?.email,
      member?.phone,
      delivery.message?.subject,
      delivery.message?.event_type,
      delivery.provider,
      delivery.error_code,
    ].some((value) => value?.toLocaleLowerCase().includes(query));
  });
}
