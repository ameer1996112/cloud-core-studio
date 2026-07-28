export type ProductionJourneyType =
  | "booking"
  | "booking_cancellation"
  | "class_change"
  | "daily_briefing"
  | "lead_to_trial"
  | "payment_outcome"
  | "recommendation"
  | "retention"
  | "waitlist"
  | "weekly_schedule";

export type ProductionJourneyStatus = "inactive" | "partial" | "live";

export type NotificationRolloutRow = {
  event_type: string;
  enabled: boolean;
  allowlist_only: boolean;
  copy_reviewed: boolean;
  enabled_channels: string[];
};

export type ProductionJourney = {
  journeyType: ProductionJourneyType;
  status: ProductionJourneyStatus;
  liveEvents: number;
  totalEvents: number;
  channels: string[];
};

export type ProductionChannel = {
  channel: "in_app" | "push" | "email" | "whatsapp";
  status: ProductionJourneyStatus;
};

const JOURNEY_EVENTS: Record<ProductionJourneyType, readonly string[]> = {
  booking: [
    "booking_confirmed",
    "booking_changed",
    "booking_checked_in",
    "booking_no_show_followup",
    "class_reminder_planning",
    "class_reminder_final",
  ],
  booking_cancellation: ["booking_cancelled"],
  class_change: [
    "class_cancelled_by_admin",
    "class_time_changed",
    "class_location_changed",
    "class_instructor_changed",
  ],
  daily_briefing: ["daily_briefing"],
  lead_to_trial: ["trial_followup"],
  payment_outcome: [
    "payment_request_received",
    "payment_pending_reminder",
    "payment_confirmed",
    "payment_failed",
    "payment_refunded",
    "receipt_issued",
  ],
  recommendation: ["class_recommendation"],
  retention: ["retention_reminder"],
  waitlist: [
    "waitlist_joined",
    "waitlist_position_changed",
    "waitlist_spot_available",
    "waitlist_accepted",
    "waitlist_offer_expired",
    "waitlist_removed",
  ],
  weekly_schedule: ["weekly_schedule"],
};

function isLive(row: NotificationRolloutRow | undefined) {
  return Boolean(row?.enabled && row.copy_reviewed && !row.allowlist_only);
}

export function deriveProductionJourneyStatus(
  rollouts: readonly NotificationRolloutRow[],
): ProductionJourney[] {
  const byEvent = new Map(rollouts.map((row) => [row.event_type, row]));

  return (Object.entries(JOURNEY_EVENTS) as Array<[ProductionJourneyType, readonly string[]]>).map(
    ([journeyType, events]) => {
      const configuredRows = events
        .map((eventType) => byEvent.get(eventType))
        .filter((row): row is NotificationRolloutRow => Boolean(row));
      const activeRows = configuredRows.filter((row) => row.enabled && row.copy_reviewed);
      const liveRows = configuredRows.filter(isLive);
      const liveEvents = events.filter((eventType) => isLive(byEvent.get(eventType))).length;
      const channels = [...new Set(liveRows.flatMap((row) => row.enabled_channels))].sort();
      const status: ProductionJourneyStatus =
        events.length === 0 || activeRows.length === 0
          ? "inactive"
          : liveEvents === events.length
            ? "live"
            : "partial";

      return { journeyType, status, liveEvents, totalEvents: events.length, channels };
    },
  );
}

export function deriveProductionChannelStatus(
  rollouts: readonly NotificationRolloutRow[],
): ProductionChannel[] {
  return (["in_app", "push", "email", "whatsapp"] as const).map((channel) => {
    const configured = rollouts.filter(
      (rollout) =>
        rollout.enabled && rollout.copy_reviewed && rollout.enabled_channels.includes(channel),
    );
    const status: ProductionJourneyStatus = configured.some(isLive)
      ? "live"
      : configured.length > 0
        ? "partial"
        : "inactive";
    return { channel, status };
  });
}
