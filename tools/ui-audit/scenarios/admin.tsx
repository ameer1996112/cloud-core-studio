import type { AuditScenario } from "../types";
import { defineRow } from "./public";

const blockedStates = ["default", "loading", "empty", "error", "disabled", "success"] as const;

const blockedRoutes = [
  "/admin/pulse",
  "/admin/calendar",
  "/admin/classes",
  "/admin/classes/$id",
  "/admin/attendance",
  "/admin/rooms",
  "/admin/members",
  "/admin/members/$id",
  "/admin/kids",
  "/admin/instructors",
  "/admin/programs",
  "/admin/plans",
  "/admin/payments",
  "/admin/reports",
  "/admin/messages",
  "/admin/automations",
  "/admin/settings",
] as const;

const aliasRoutes = [
  "/admin/bookings",
  "/admin/schedule",
  "/admin/planner",
  "/admin/templates",
  "/admin/credits",
  "/admin/audit",
] as const;

export const adminScenarios: readonly AuditScenario[] = [
  ...defineRow({
    section: "admin",
    route: "/admin",
    role: "admin",
    static: blockedStates,
    redirected: ["permission-denied"],
  }),
  ...blockedRoutes.flatMap((route) =>
    defineRow({
      section: "admin",
      route,
      role: "admin",
      blocked: blockedStates,
      redirected: ["permission-denied"],
    }),
  ),
  ...defineRow({
    section: "admin",
    route: "/admin/classes/new",
    role: "admin",
    blocked: ["default", "loading", "error", "disabled", "success"],
    redirected: ["permission-denied"],
  }),
  ...aliasRoutes.flatMap((route) =>
    defineRow({
      section: "admin",
      route,
      role: "admin",
      redirected: ["default", "permission-denied"],
      static: ["error"],
    }),
  ),
];
