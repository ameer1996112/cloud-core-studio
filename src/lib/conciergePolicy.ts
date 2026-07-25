export const CONCIERGE_POLICY_VERSION = "concierge-2026-07-v1";
export const STUDIO_TIME_ZONE = "Asia/Jerusalem";

export type ConciergeChannel = "in_app" | "push" | "email" | "whatsapp";
export type ConciergePurpose =
  | "transactional"
  | "operational"
  | "schedule"
  | "promotional"
  | "receipt";

export type RecipientPolicyState = {
  id: string;
  locale: "ar" | "he" | "en";
  isAdult: boolean;
  hasPush: boolean;
  consents: Record<ConciergeChannel, Set<ConciergePurpose>>;
};

type Relationship = {
  participantId: string;
  recipientId: string;
  relationshipType: "self" | "parent" | "guardian" | "payer" | "other_authorized";
  recipientIsAdult: boolean;
  authorized: boolean;
};

export function resolveCommunicationRecipient(input: {
  participantId: string;
  participantIsMinor: boolean;
  relationships: Relationship[];
}) {
  const match = input.relationships.find(
    (relationship) =>
      relationship.participantId === input.participantId &&
      relationship.authorized &&
      (!input.participantIsMinor ||
        (relationship.recipientIsAdult &&
          relationship.recipientId !== input.participantId &&
          ["parent", "guardian", "other_authorized"].includes(relationship.relationshipType))),
  );
  if (!match) {
    throw new Error(
      input.participantIsMinor
        ? "authorized_adult_recipient_required"
        : "communication_recipient_required",
    );
  }
  return match.recipientId;
}

function permitted(
  recipient: RecipientPolicyState,
  channel: ConciergeChannel,
  purpose: ConciergePurpose,
) {
  return recipient.consents[channel]?.has(purpose) === true;
}

export function decideBookingChannels(input: {
  firstBooking: boolean;
  recipient: RecipientPolicyState;
}) {
  const channels: ConciergeChannel[] = ["in_app"];
  if (input.firstBooking) {
    if (permitted(input.recipient, "whatsapp", "transactional")) channels.push("whatsapp");
    else if (input.recipient.hasPush && permitted(input.recipient, "push", "transactional")) {
      channels.push("push");
    }
  } else if (input.recipient.hasPush && permitted(input.recipient, "push", "transactional")) {
    channels.push("push");
  } else if (permitted(input.recipient, "whatsapp", "transactional")) {
    channels.push("whatsapp");
  }
  return channels;
}

function jerusalemParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STUDIO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function isQuietHours(now: Date) {
  const parts = jerusalemParts(now);
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return minutes >= 20 * 60 + 30 || minutes < 8 * 60;
}

function localDay(now: Date) {
  const p = jerusalemParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

export type PendingRecipientAction = {
  id: string;
  kind: string;
  purpose: ConciergePurpose;
  priority: number;
  eligibleAt: Date;
  expiresAt?: Date;
  urgent?: boolean;
  obsolete?: boolean;
};

export type ContactRecord = { sentAt: Date; promotional: boolean };

export type ArbitrationResult = {
  selected: PendingRecipientAction | null;
  suppressionReason:
    | "no_eligible_action"
    | "quiet_hours"
    | "six_hour_contact_cap"
    | "daily_total_contact_cap"
    | "daily_promotional_cap"
    | "weekly_promotional_cap"
    | "missing_consent"
    | null;
  postponed: boolean;
};

export function chooseNextRecipientAction(input: {
  recipient: RecipientPolicyState;
  actions: PendingRecipientAction[];
  recentContacts: ContactRecord[];
  now: Date;
}): ArbitrationResult {
  const eligible = input.actions
    .filter(
      (action) =>
        !action.obsolete &&
        action.eligibleAt <= input.now &&
        (!action.expiresAt || action.expiresAt > input.now),
    )
    .sort((a, b) => a.priority - b.priority || a.eligibleAt.getTime() - b.eligibleAt.getTime());
  const selected = eligible[0];
  if (!selected)
    return { selected: null, suppressionReason: "no_eligible_action", postponed: false };
  const hasExternalConsent = (["push", "email", "whatsapp"] as const).some((channel) =>
    permitted(input.recipient, channel, selected.purpose),
  );
  if (!hasExternalConsent) {
    return { selected: null, suppressionReason: "missing_consent", postponed: false };
  }
  if (selected.urgent) return { selected, suppressionReason: null, postponed: false };
  if (isQuietHours(input.now)) {
    return { selected: null, suppressionReason: "quiet_hours", postponed: true };
  }

  const sixHoursAgo = input.now.getTime() - 6 * 3_600_000;
  const dayAgo = input.now.getTime() - 24 * 3_600_000;
  const weekAgo = input.now.getTime() - 7 * 24 * 3_600_000;
  if (input.recentContacts.some((contact) => contact.sentAt.getTime() > sixHoursAgo)) {
    return { selected: null, suppressionReason: "six_hour_contact_cap", postponed: true };
  }
  if (input.recentContacts.filter((contact) => contact.sentAt.getTime() > dayAgo).length >= 2) {
    return { selected: null, suppressionReason: "daily_total_contact_cap", postponed: true };
  }
  if (selected.purpose === "promotional") {
    const promotional = input.recentContacts.filter((contact) => contact.promotional);
    if (promotional.some((contact) => localDay(contact.sentAt) === localDay(input.now))) {
      return { selected: null, suppressionReason: "daily_promotional_cap", postponed: true };
    }
    if (promotional.filter((contact) => contact.sentAt.getTime() > weekAgo).length >= 3) {
      return { selected: null, suppressionReason: "weekly_promotional_cap", postponed: true };
    }
  }
  return { selected, suppressionReason: null, postponed: false };
}

export type PaymentOutcome =
  | "one_time_payment_succeeded"
  | "subscription_renewal_succeeded"
  | "payment_requires_action"
  | "payment_retry_scheduled"
  | "payment_terminally_failed"
  | "payment_recovered";

export function decidePaymentOutcome(outcome: PaymentOutcome) {
  switch (outcome) {
    case "one_time_payment_succeeded":
      return {
        memberChannels: ["in_app", "push", "email"] as ConciergeChannel[],
        adminNotification: "payment_success",
        cancelPendingFailureActions: true,
      };
    case "subscription_renewal_succeeded":
      return {
        memberChannels: ["in_app", "push", "email"] as ConciergeChannel[],
        adminNotification: "combined_renewal_payment_success",
        cancelPendingFailureActions: true,
      };
    case "payment_retry_scheduled":
      return {
        memberChannels: [] as ConciergeChannel[],
        adminNotification: "payment_retry_scheduled",
        cancelPendingFailureActions: false,
      };
    case "payment_requires_action":
    case "payment_terminally_failed":
      return {
        memberChannels: ["in_app", "push", "email"] as ConciergeChannel[],
        adminNotification: "payment_action_required",
        cancelPendingFailureActions: false,
      };
    case "payment_recovered":
      return {
        memberChannels: ["in_app"] as ConciergeChannel[],
        adminNotification: "payment_recovered",
        cancelPendingFailureActions: true,
      };
  }
}

export function weeklyScheduleKey(studioId: string, weekKey: string, revision?: number) {
  if (revision === undefined) return `weekly_schedule:${studioId}:${weekKey}:initial`;
  if (!Number.isInteger(revision) || revision < 1) throw new Error("positive_revision_required");
  return `weekly_schedule:${studioId}:${weekKey}:update:${revision}`;
}

type SuitableClass = {
  id: string;
  published: boolean;
  bookable: boolean;
  cancelled: boolean;
  eligible: boolean;
  capacityAvailable: boolean;
  planCovered: boolean;
  overlaps: boolean;
  startsAt: Date;
  fitScore: number;
  fillScore: number;
};

export function filterSuitableClasses(classes: SuitableClass[], now: Date, minimumLeadHours = 2) {
  const minimumStart = now.getTime() + minimumLeadHours * 3_600_000;
  return classes
    .filter(
      (item) =>
        item.published &&
        item.bookable &&
        !item.cancelled &&
        item.eligible &&
        item.capacityAvailable &&
        item.planCovered &&
        !item.overlaps &&
        item.startsAt.getTime() >= minimumStart,
    )
    .sort((a, b) => b.fitScore - a.fitScore || b.fillScore - a.fillScore);
}

export function closeInactivityEpisode(
  episode: { status: "open" | "closed"; whatsappSentAt: Date | null },
  reason: "booking" | "attendance" | "staff_closed",
) {
  if (episode.status === "closed") {
    return { status: "closed" as const, closedReason: reason, cancelPendingRetention: false };
  }
  return { status: "closed" as const, closedReason: reason, cancelPendingRetention: true };
}
