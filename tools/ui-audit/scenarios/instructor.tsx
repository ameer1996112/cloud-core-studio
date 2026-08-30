import type { AuditScenario } from "../types";
import { defineRow } from "./public";

const blockedStates = ["default", "loading", "empty", "error", "disabled", "success"] as const;

export const instructorScenarios: readonly AuditScenario[] = [
  ...defineRow({
    section: "instructor",
    route: "/instructor",
    role: "instructor",
    blocked: blockedStates,
    redirected: ["permission-denied"],
  }),
  ...defineRow({
    section: "instructor",
    route: "Participant/attendance states",
    role: "instructor",
    blocked: blockedStates,
    redirected: ["permission-denied"],
  }),
];
