import type React from "react";

export type AuditLanguage = "he" | "ar" | "en";
export type AuditRole = "guest" | "member" | "instructor" | "admin";
export type AuditViewport =
  | "360x800"
  | "390x844"
  | "430x932"
  | "768x1024"
  | "1024x768"
  | "1440x900";

export type AuditEvidenceKind = "visual" | "static" | "redirected" | "blocked";
export type AuditRiskTier = "A" | "B" | "C";

export type AuditRenderContext = { language: AuditLanguage };
export type ProductSource = { module: string; export: string };
export type ComponentEvidence = {
  type: "component";
  source: ProductSource;
  marker: `[data-product-view="${string}"]`;
};
export type SourceEvidence = { type: "source"; source: ProductSource };
export type RedirectEvidence = {
  type: "redirect";
  source: ProductSource;
  expectation: string;
};
export type BlockedEvidence = {
  type: "blocked";
  source: ProductSource;
  reason: "authenticated-fixture-required";
};

export interface ScenarioEvidence {
  scenarioId: string;
  kind: AuditEvidenceKind;
  languages: readonly AuditLanguage[];
  viewports: readonly AuditViewport[];
  expectedLandmarks: { main: 1 };
}

interface AuditScenarioBase extends ScenarioEvidence {
  id: string;
  matrixKey: string;
  riskTier: AuditRiskTier;
  role: AuditRole;
  route: string;
  state: string;
  languages: readonly AuditLanguage[];
  viewports: readonly AuditViewport[];
}

export interface VisualAuditScenario extends AuditScenarioBase {
  kind: "visual";
  evidence: ComponentEvidence;
  render: (context: AuditRenderContext) => React.ReactNode;
}

export interface StaticAuditScenario extends AuditScenarioBase {
  kind: "static";
  evidence: SourceEvidence;
  render?: never;
}

export interface RedirectAuditScenario extends AuditScenarioBase {
  kind: "redirected";
  evidence: RedirectEvidence;
  render?: never;
}

export interface BlockedAuditScenario extends AuditScenarioBase {
  kind: "blocked";
  evidence: BlockedEvidence;
  render?: never;
}

export type AuditScenario =
  | VisualAuditScenario
  | StaticAuditScenario
  | RedirectAuditScenario
  | BlockedAuditScenario;
