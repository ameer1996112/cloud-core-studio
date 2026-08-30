import type { AuditScenario } from "../types";
import { defineRow } from "./public";

const blockedStates = ["default", "loading", "empty", "error", "disabled", "success"] as const;

export const memberScenarios: readonly AuditScenario[] = [
  ...defineRow({
    section: "member",
    route: "/member",
    role: "member",
    blocked: blockedStates,
    redirected: ["permission-denied"],
  }),
  ...defineRow({
    section: "member",
    route: "/member/schedule authenticated branch",
    role: "member",
    blocked: blockedStates,
    redirected: ["permission-denied"],
  }),
  ...defineRow({
    section: "member",
    route: "Class detail sheet",
    role: "member",
    static: blockedStates,
    redirected: ["permission-denied"],
  }),
  ...defineRow({
    section: "member",
    route: "Booking confirmation",
    role: "member",
    blocked: ["default", "loading", "error", "disabled", "success"],
    redirected: ["permission-denied"],
  }),
  ...defineRow({
    section: "member",
    route: "Booking failure/stale seat",
    role: "member",
    blocked: ["loading", "error", "disabled"],
    redirected: ["permission-denied"],
  }),
  ...defineRow({
    section: "member",
    route: "Waitlist/full states",
    role: "member",
    blocked: blockedStates,
    redirected: ["permission-denied"],
  }),
  ...defineRow({
    section: "member",
    route: "/member/bookings",
    role: "member",
    blocked: blockedStates,
    redirected: ["permission-denied"],
  }),
  ...defineRow({
    section: "member",
    route: "/member/packages",
    role: "member",
    blocked: blockedStates,
    redirected: ["permission-denied"],
  }),
  ...defineRow({
    section: "member",
    route: "/member/account",
    role: "member",
    blocked: blockedStates,
    redirected: ["permission-denied"],
  }),
  ...defineRow({
    section: "member",
    route: "/receipts/$id",
    role: "member",
    blocked: [...blockedStates, "permission-denied"],
  }),
];
