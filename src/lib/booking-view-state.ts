import { tForLang, type Lang } from "@/lib/i18n";

export type BookingAvailability =
  | "available"
  | "full"
  | "waitlist-open"
  | "ineligible"
  | "pending"
  | "booked";

export type BookingClassStateKind =
  | "available"
  | "almost"
  | "full"
  | "waitlist_available"
  | "booked"
  | "waiting"
  | "package_required"
  | "low_credits"
  | "closed"
  | "cancelled";

export type BookingCost =
  | { kind: "credits"; count: number }
  | { kind: "price"; formatted: string }
  | { kind: "included"; label: string };

export type BookingRecovery = {
  reason: string;
  label: string;
  href: string;
};

export type BookingOutcomeRecovery =
  | { kind: "retry"; label: string }
  | { kind: "link"; label: string; href: string };

export type BookingOutcomeInput = {
  kind: "success" | "failure";
  message: string;
  context: string;
  details?: string[];
  recovery?: BookingOutcomeRecovery;
};

export type CancellationOutcomePresentationInput = BookingOutcomeInput & {
  refundedCredits?: string;
  cancellationDeadline?: string;
};

export function cancellationOutcomePresentation({
  refundedCredits,
  cancellationDeadline,
  ...outcome
}: CancellationOutcomePresentationInput): BookingOutcomeInput {
  const details = [refundedCredits, cancellationDeadline].filter((detail): detail is string =>
    Boolean(detail),
  );
  return {
    ...outcome,
    ...(details.length > 0 ? { details } : {}),
  };
}

export type BookingAction =
  | { kind: "book"; label: string; consequence: string }
  | { kind: "join-waitlist"; label: string; explanation: string }
  | { kind: "unavailable"; reason: string }
  | { kind: "recover"; reason: string; label: string; href: string }
  | { kind: "pending"; label: string }
  | { kind: "manage"; label: string; cancellationDeadline?: string };

export type BookingViewStateInput = {
  availability: BookingAvailability;
  lang: Lang;
  seats?: { remaining: number; capacity?: number | null };
  cost?: BookingCost | null;
  recovery?: BookingRecovery;
  unavailableReason?: string;
  waitlistExplanation?: string;
  pendingLabel?: string;
  manageLabel?: string;
  cancellationDeadline?: string;
  outcome?: BookingOutcomeInput | null;
};

export function bookingAvailabilityForClassState(kind: BookingClassStateKind): BookingAvailability {
  if (kind === "available" || kind === "almost") return "available";
  if (kind === "waitlist_available") return "waitlist-open";
  if (kind === "package_required" || kind === "low_credits") return "ineligible";
  if (kind === "booked" || kind === "waiting") return "booked";
  return "full";
}

export type BookingViewState = {
  action: BookingAction;
  actionLocked: boolean;
  seatCopy?: string;
  consequence?: string;
  outcome?: BookingOutcomeInput & { persistent: true };
};

function formatSeatCopy(input: BookingViewStateInput): string | undefined {
  if (!input.seats) return undefined;
  const remaining = input.seats.remaining;
  if (typeof input.seats.capacity === "number") {
    return tForLang(input.lang, "booking.view.seatsOfCapacity", {
      remaining,
      capacity: input.seats.capacity,
    });
  }
  return tForLang(input.lang, "booking.view.seatsRemaining", { count: remaining });
}

function formatConsequence(input: BookingViewStateInput): string | undefined {
  if (!input.cost) return undefined;
  if (input.cost.kind === "credits") {
    return input.cost.count === 1
      ? tForLang(input.lang, "booking.view.oneCreditConsequence")
      : tForLang(input.lang, "booking.view.creditConsequence", { count: input.cost.count });
  }
  if (input.cost.kind === "price") {
    return tForLang(input.lang, "booking.view.priceConsequence", {
      price: input.cost.formatted,
    });
  }
  return input.cost.label;
}

export function deriveBookingViewState(input: BookingViewStateInput): BookingViewState {
  const seatCopy = formatSeatCopy(input);
  const consequence = formatConsequence(input);
  const common = {
    actionLocked: input.availability === "pending",
    ...(seatCopy ? { seatCopy } : {}),
    ...(consequence ? { consequence } : {}),
    ...(input.outcome
      ? {
          outcome: {
            kind: input.outcome.kind,
            message: input.outcome.message,
            context: input.outcome.context,
            ...(input.outcome.details ? { details: input.outcome.details } : {}),
            ...(input.outcome.recovery ? { recovery: input.outcome.recovery } : {}),
            persistent: true as const,
          },
        }
      : {}),
  };

  switch (input.availability) {
    case "available":
      return {
        ...common,
        action: {
          kind: "book",
          label:
            input.cost?.kind === "credits"
              ? input.cost.count === 1
                ? tForLang(input.lang, "booking.bookCredit")
                : tForLang(input.lang, "booking.bookCredits", { count: input.cost.count })
              : tForLang(input.lang, "class.cta.bookClass"),
          consequence: consequence ?? "",
        },
      };
    case "waitlist-open":
      return {
        ...common,
        action: {
          kind: "join-waitlist",
          label: tForLang(input.lang, "booking.joinWaitlist"),
          explanation:
            input.waitlistExplanation ?? tForLang(input.lang, "booking.view.waitlistExplanation"),
        },
      };
    case "ineligible": {
      if (!input.recovery) {
        throw new Error(
          "Ineligible booking presentation requires an authoritative recovery action.",
        );
      }
      return { ...common, action: { kind: "recover", ...input.recovery } };
    }
    case "pending":
      return {
        ...common,
        action: {
          kind: "pending",
          label: input.pendingLabel ?? tForLang(input.lang, "booking.saving"),
        },
      };
    case "booked":
      return {
        ...common,
        action: {
          kind: "manage",
          label: input.manageLabel ?? tForLang(input.lang, "class.cta.manageBooking"),
          ...(input.cancellationDeadline
            ? { cancellationDeadline: input.cancellationDeadline }
            : {}),
        },
      };
    case "full":
    default:
      return {
        ...common,
        action: {
          kind: "unavailable",
          reason: input.unavailableReason ?? tForLang(input.lang, "booking.view.unavailable"),
        },
      };
  }
}
