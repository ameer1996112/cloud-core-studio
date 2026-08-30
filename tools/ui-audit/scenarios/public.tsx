import type {
  AuditEvidenceKind,
  AuditLanguage,
  AuditRole,
  AuditScenario,
  AuditViewport,
} from "../types";
import { productSourceFor, redirectExpectation } from "./source-evidence";
import { visualAdapters } from "./visual-adapters";

const allLanguages = ["he", "ar", "en"] as const;
const allViewports = ["360x800", "390x844", "430x932", "768x1024", "1024x768", "1440x900"] as const;

export type ScenarioRow = {
  section: "public" | "shared" | "member" | "instructor" | "admin";
  route: string;
  role?: AuditRole;
  languages?: readonly AuditLanguage[];
  viewports?: readonly AuditViewport[];
  visual?: readonly string[];
  static?: readonly string[];
  redirected?: readonly string[];
  blocked?: readonly string[];
};

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/\$/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "root"
  );
}

export function defineRow(row: ScenarioRow): AuditScenario[] {
  const entries: Array<[AuditEvidenceKind, readonly string[]]> = [
    ["visual", row.visual ?? []],
    ["static", row.static ?? []],
    ["redirected", row.redirected ?? []],
    ["blocked", row.blocked ?? []],
  ];

  return entries.flatMap(([kind, states]) =>
    states.map((state) => {
      const role = row.role ?? "guest";
      const scenarioId = `${role}-${slug(row.route)}-${state}`;
      const isTierA = kind === "visual";
      const matrixKey = `${row.section}|${row.route}|${state}`;
      const base = {
        id: scenarioId,
        scenarioId,
        matrixKey,
        riskTier: isTierA ? "A" : kind === "static" ? "B" : "C",
        role,
        route: row.route,
        state,
        languages: isTierA ? allLanguages : (row.languages ?? allLanguages),
        viewports: isTierA ? allViewports : (row.viewports ?? allViewports),
        expectedLandmarks: { main: 1 },
      } as const;
      const source = productSourceFor(row.section, row.route);
      if (kind === "visual") {
        const adapter = visualAdapters[matrixKey];
        if (!adapter) throw new Error(`missing product visual adapter: ${matrixKey}`);
        return { ...base, kind, ...adapter } satisfies AuditScenario;
      }
      if (kind === "static")
        return { ...base, kind, evidence: { type: "source", source } } satisfies AuditScenario;
      if (kind === "redirected")
        return {
          ...base,
          kind,
          evidence: { type: "redirect", source, expectation: redirectExpectation(matrixKey) },
        } satisfies AuditScenario;
      return {
        ...base,
        kind,
        evidence: { type: "blocked", source, reason: "authenticated-fixture-required" },
      } satisfies AuditScenario;
    }),
  );
}

const mobile = ["390x844"] as const;

export const publicScenarios: readonly AuditScenario[] = [
  ...defineRow({
    section: "public",
    route: "/",
    languages: ["he"],
    viewports: mobile,
    redirected: ["default"],
    static: ["error"],
  }),
  ...defineRow({
    section: "public",
    route: "/auth",
    visual: ["default"],
    static: ["loading", "error", "disabled", "success"],
  }),
  ...defineRow({
    section: "public",
    route: "/auth?mode=signup",
    viewports: mobile,
    visual: ["default", "disabled"],
    static: ["loading", "error", "success"],
  }),
  ...defineRow({
    section: "public",
    route: "/auth?mode=forgot",
    viewports: mobile,
    visual: ["default"],
    static: ["loading", "error", "disabled", "success"],
  }),
  ...defineRow({
    section: "public",
    route: "/auth_/reset",
    static: ["default", "loading", "error", "success"],
  }),
  ...defineRow({
    section: "public",
    route: "/reset-password",
    viewports: mobile,
    visual: ["error"],
    static: ["default", "loading", "disabled", "success"],
  }),
  ...defineRow({
    section: "public",
    route: "/member/schedule",
    viewports: ["390x844", "1440x900"],
    visual: ["default", "empty"],
    static: ["loading", "error", "disabled", "success"],
  }),
  ...defineRow({
    section: "public",
    route: "/privacy",
    viewports: mobile,
    visual: ["default"],
    static: ["error"],
  }),
  ...defineRow({
    section: "public",
    route: "/terms",
    viewports: mobile,
    visual: ["default"],
    static: ["error"],
  }),
  ...defineRow({
    section: "public",
    route: "/support",
    viewports: mobile,
    visual: ["default"],
    static: ["error"],
  }),
  ...defineRow({
    section: "public",
    route: "/checkout",
    static: ["default", "loading", "empty", "error", "disabled", "success"],
    redirected: ["permission-denied"],
  }),
  ...defineRow({
    section: "public",
    route: "/payment-result?status=success",
    viewports: mobile,
    visual: ["success"],
  }),
  ...defineRow({
    section: "public",
    route: "/payment-result?status=failed",
    viewports: mobile,
    visual: ["error"],
  }),
  ...defineRow({
    section: "public",
    route: "/payment-result?status=pending",
    static: ["loading", "disabled", "success"],
  }),
  ...defineRow({
    section: "public",
    route: "/payment-result?status=cancelled",
    static: ["error"],
  }),
  ...defineRow({
    section: "public",
    route: "/app",
    viewports: ["390x844", "430x932", "1440x900"],
    visual: ["default"],
    static: ["loading", "error"],
  }),
  ...defineRow({
    section: "public",
    route: "/download",
    languages: ["he"],
    viewports: mobile,
    visual: ["default"],
    static: ["loading", "error", "disabled", "success"],
  }),
  ...defineRow({
    section: "public",
    route: "/downalod",
    redirected: ["default"],
    static: ["error"],
  }),
  ...defineRow({
    section: "public",
    route: "/instagram",
    languages: ["he"],
    viewports: mobile,
    visual: ["default"],
    static: ["loading", "error"],
  }),
  ...defineRow({
    section: "public",
    route: "/promo/yoga-lina",
    viewports: mobile,
    visual: ["default"],
    static: ["loading", "empty", "error", "disabled", "success"],
  }),
  ...defineRow({
    section: "shared",
    route: "/_authenticated layout",
    role: "member",
    static: ["default", "loading", "error"],
    redirected: ["permission-denied"],
  }),
  ...defineRow({
    section: "shared",
    route: "/studio",
    role: "member",
    redirected: ["default", "permission-denied"],
    static: ["error"],
  }),
  ...defineRow({
    section: "shared",
    route: "/schedule",
    role: "member",
    redirected: ["default", "permission-denied"],
    static: ["error"],
  }),
  ...defineRow({
    section: "shared",
    route: "/bookings",
    role: "member",
    redirected: ["default", "permission-denied"],
    static: ["error"],
  }),
  ...defineRow({
    section: "shared",
    route: "/bookings/$id",
    role: "member",
    redirected: ["default", "permission-denied"],
    static: ["error"],
  }),
  ...defineRow({
    section: "shared",
    route: "/plans",
    role: "member",
    redirected: ["default", "permission-denied"],
    static: ["error"],
  }),
];
