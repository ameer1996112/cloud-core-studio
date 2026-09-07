import type { PremiumClassCardClass, ClassState } from "./PremiumClassCard";
export function deriveGuestClassState(cls: PremiumClassCardClass): ClassState {
  if (cls.status === "cancelled") return { kind: "cancelled" };
  if (cls.status !== "scheduled") return { kind: "closed" };
  const spots = (cls.capacity ?? 0) - (cls.booked_count ?? 0);
  if (spots <= 0) return { kind: "full" };
  if (spots <= 2) return { kind: "almost", spotsLeft: spots };
  return { kind: "available", spotsLeft: spots };
}
