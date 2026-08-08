import type { DeliveryFailureClass, DeliveryStatus, MessageChannel } from "@/lib/messaging.types";
import type { Lang } from "@/lib/i18n";
import type { OutboxHealth } from "@/lib/messageOutboxMaintenance";
import { formatStudioDateTimeInput, studioDateTimeInputToIso } from "@/lib/studio-time";

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
  recipient_name: string | null;
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
  recipient_contact: string | null;
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
  from: string;
  to: string;
  totalMoments: number;
  nextCursor: string | null;
  pageSize: number;
  queueHealth: OutboxHealth;
};

export type DeliveryMonitorFilters = {
  query: string;
  traffic: DeliveryTrafficKind | "all";
  channel: "all" | MessageChannel;
  status: "all" | DeliveryStatus | "attention" | "successful" | "not_sent";
  memberId: string | null;
};

export type DeliveryDatePreset = "24h" | "7d" | "30d" | "custom";

export type DeliveryMoment = {
  messageId: string;
  deliveries: DeliveryMonitorRow[];
  primary: DeliveryMonitorRow;
  eventAt: string;
  latestAt: string;
  needsAttention: boolean;
};

export type DeliveryMomentCursor = string;

function compareDeliveryMoments(left: DeliveryMoment, right: DeliveryMoment) {
  return (
    new Date(right.eventAt).getTime() - new Date(left.eventAt).getTime() ||
    right.messageId.localeCompare(left.messageId)
  );
}

function deliveryMomentCursor(moment: Pick<DeliveryMoment, "eventAt" | "messageId">) {
  return `${moment.eventAt}|${encodeURIComponent(moment.messageId)}`;
}

function parseDeliveryMomentCursor(cursor: string) {
  const separator = cursor.indexOf("|");
  if (separator <= 0) return null;
  const eventAt = cursor.slice(0, separator);
  let messageId: string;
  try {
    messageId = decodeURIComponent(cursor.slice(separator + 1));
  } catch {
    return null;
  }
  if (Number.isNaN(new Date(eventAt).getTime()) || !messageId) return null;
  return { eventAt, messageId };
}

export function deliveryRangeForPreset(
  input: { preset: DeliveryDatePreset; customFrom?: string; customTo?: string },
  now = new Date(),
) {
  if (Number.isNaN(now.getTime())) throw new RangeError("Invalid delivery range clock");
  if (input.preset === "24h") {
    return {
      from: new Date(now.getTime() - 24 * 60 * 60_000).toISOString(),
      to: now.toISOString(),
    };
  }

  const studioDate = formatStudioDateTimeInput(now).slice(0, 10);
  const addCalendarDays = (value: string, days: number) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError("Invalid delivery range date");
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year!, month! - 1, day! + days));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  };

  if (input.preset === "custom") {
    const customFrom = input.customFrom ?? "";
    const customTo = input.customTo ?? "";
    if (!customFrom || !customTo || customFrom > customTo) {
      throw new RangeError("Invalid custom delivery range");
    }
    return {
      from: studioDateTimeInputToIso(`${customFrom}T00:00`),
      to: studioDateTimeInputToIso(`${addCalendarDays(customTo, 1)}T00:00`),
    };
  }

  const calendarDays = input.preset === "7d" ? 7 : 30;
  return {
    from: studioDateTimeInputToIso(`${addCalendarDays(studioDate, -(calendarDays - 1))}T00:00`),
    to: now.toISOString(),
  };
}

export function groupDeliveryMoments(rows: DeliveryMonitorRow[]): DeliveryMoment[] {
  const groups = new Map<string, DeliveryMonitorRow[]>();
  for (const row of rows) {
    const key = row.message_id || row.id;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return [...groups.entries()]
    .map(([messageId, deliveries]) => {
      const sorted = [...deliveries].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
      const primary = sorted[0]!;
      return {
        messageId,
        deliveries: sorted,
        primary,
        eventAt: primary.message?.created_at ?? primary.created_at,
        latestAt: primary.updated_at,
        needsAttention: sorted.some((delivery) =>
          isDeliveryAttention(delivery.status, delivery.failure_class),
        ),
      };
    })
    .sort(compareDeliveryMoments);
}

export function paginateDeliveryMoments(
  moments: DeliveryMoment[],
  cursor: DeliveryMomentCursor | null,
  pageSize: number,
) {
  const normalizedPageSize = Math.max(1, Math.min(100, Math.trunc(pageSize)));
  const parsedCursor = cursor ? parseDeliveryMomentCursor(cursor) : null;
  const cursorIndex = parsedCursor
    ? moments.findIndex(
        (moment) =>
          moment.messageId === parsedCursor.messageId && moment.eventAt === parsedCursor.eventAt,
      )
    : -1;
  const keysetStart = parsedCursor
    ? moments.findIndex(
        (moment) =>
          new Date(moment.eventAt).getTime() < new Date(parsedCursor.eventAt).getTime() ||
          (moment.eventAt === parsedCursor.eventAt && moment.messageId < parsedCursor.messageId),
      )
    : -1;
  const start = cursorIndex >= 0 ? cursorIndex + 1 : keysetStart >= 0 ? keysetStart : 0;
  const items = moments.slice(start, start + normalizedPageSize);
  const hasMore = start + items.length < moments.length;
  return {
    items,
    nextCursor: hasMore && items.length ? deliveryMomentCursor(items.at(-1)!) : null,
  };
}

export function buildDeliveryMonitorPage(input: {
  deliveries: DeliveryMonitorRow[];
  filters: DeliveryMonitorFilters;
  cursor: string | null;
  pageSize: number;
}) {
  const summaries = summarizeDeliveriesByTraffic(input.deliveries);
  const filtered = filterDeliveryRows(input.deliveries, input.filters);
  const moments = groupDeliveryMoments(filtered);
  const page = paginateDeliveryMoments(moments, input.cursor, input.pageSize);
  return {
    deliveries: page.items.flatMap((moment) => moment.deliveries),
    summaries,
    totalMoments: moments.length,
    nextCursor: page.nextCursor,
  };
}

export function deliveryOutcomeKind(
  delivery: Pick<DeliveryMonitorRow, "status" | "failure_class">,
): "successful" | "in_flight" | "expected_skip" | "failure" {
  if (isDeliveryAttention(delivery.status, delivery.failure_class)) return "failure";
  if (NOT_SENT_STATUSES.has(delivery.status)) return "expected_skip";
  if (IN_FLIGHT_STATUSES.has(delivery.status)) return "in_flight";
  return "successful";
}

export function deliveryFailureReason(
  delivery: Pick<
    DeliveryMonitorRow,
    "channel" | "status" | "failure_class" | "error_code" | "error_message"
  >,
) {
  if (
    delivery.channel === "whatsapp" &&
    /(?:#|code[=: ]*)132018\b/i.test(delivery.error_message ?? "")
  ) {
    return "whatsapp_template_parameter_mismatch";
  }
  if (
    delivery.channel === "email" &&
    /(?:resend_)?bounce(?:d)?/i.test(`${delivery.error_code ?? ""} ${delivery.error_message ?? ""}`)
  ) {
    return "email_bounced";
  }
  return delivery.error_code;
}

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

export function isDeliveryAttention(
  status: DeliveryStatus,
  failureClass: DeliveryFailureClass | null = null,
) {
  return ATTENTION_STATUSES.has(status) || (status === "expired" && failureClass !== null);
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
  deliveries: Array<Pick<DeliveryMonitorRow, "status" | "failure_class" | "message">>,
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
    if (isDeliveryAttention(delivery.status, delivery.failure_class)) needsAttention += 1;
    if (IN_FLIGHT_STATUSES.has(delivery.status)) inFlight += 1;
    if (
      NOT_SENT_STATUSES.has(delivery.status) &&
      !isDeliveryAttention(delivery.status, delivery.failure_class)
    ) {
      policySkipped += 1;
    }
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
  deliveries: Array<
    Pick<DeliveryMonitorRow, "status" | "failure_class" | "message" | "traffic_kind">
  >,
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
    if (filters.memberId && delivery.message?.member_id !== filters.memberId) return false;
    if (filters.channel !== "all" && delivery.channel !== filters.channel) return false;
    if (filters.status !== "all") {
      if (
        filters.status === "attention" &&
        !isDeliveryAttention(delivery.status, delivery.failure_class)
      ) {
        return false;
      }
      if (filters.status === "successful" && !SUCCESSFUL_HANDOFF_STATUSES.has(delivery.status)) {
        return false;
      }
      if (
        filters.status === "not_sent" &&
        (!NOT_SENT_STATUSES.has(delivery.status) ||
          isDeliveryAttention(delivery.status, delivery.failure_class))
      ) {
        return false;
      }
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
      delivery.message?.recipient_name,
      delivery.recipient_contact,
      delivery.message?.subject,
      delivery.message?.event_type,
      delivery.provider,
      delivery.error_code,
    ].some((value) => value?.toLocaleLowerCase().includes(query));
  });
}
