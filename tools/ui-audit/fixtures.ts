import { adminScenarios } from "./scenarios/admin";
import { instructorScenarios } from "./scenarios/instructor";
import { memberScenarios } from "./scenarios/member";
import { publicScenarios } from "./scenarios/public";
import type { AuditScenario } from "./types";

export const auditScenarios: readonly AuditScenario[] = [
  ...publicScenarios,
  ...memberScenarios,
  ...instructorScenarios,
  ...adminScenarios,
];
