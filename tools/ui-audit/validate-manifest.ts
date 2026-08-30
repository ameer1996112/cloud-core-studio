import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { auditScenarios } from "./fixtures";
import type { AuditEvidenceKind, AuditLanguage, AuditScenario, AuditViewport } from "./types";

const allLanguages = ["he", "ar", "en"] as const;
const allViewports = ["360x800", "390x844", "430x932", "768x1024", "1024x768", "1440x900"] as const;
const stateColumns = [
  "Default",
  "Loading",
  "Empty",
  "Error",
  "Disabled",
  "Success",
  "Permission denied",
] as const;

export type MatrixState = {
  matrixKey: string;
  section: "public" | "shared" | "member" | "instructor" | "admin";
  route: string;
  state: string;
  kind: AuditEvidenceKind;
  languages: readonly AuditLanguage[];
  viewports: readonly AuditViewport[];
};

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim().replaceAll("`", ""));
}

function sectionForHeading(heading: string): MatrixState["section"] | undefined {
  if (heading === "Guest and public routes") return "public";
  if (heading === "Authenticated shared and legacy routes") return "shared";
  if (heading === "Member routes") return "member";
  if (heading === "Instructor routes") return "instructor";
  if (heading === "Admin routes") return "admin";
  return undefined;
}

function documentedLanguages(value: string | undefined): readonly AuditLanguage[] {
  if (!value || /inherited/i.test(value)) return allLanguages;
  const result: AuditLanguage[] = [];
  if (/\bHE\b/i.test(value)) result.push("he");
  if (/\bAR\b/i.test(value)) result.push("ar");
  if (/\bEN\b/i.test(value)) result.push("en");
  return result.length > 0 ? result : allLanguages;
}

function documentedViewports(value: string | undefined): readonly AuditViewport[] {
  if (!value || /all six|responsive/i.test(value)) return allViewports;
  const viewportByWidth = new Map<string, AuditViewport>([
    ["360", "360x800"],
    ["390", "390x844"],
    ["430", "430x932"],
    ["768", "768x1024"],
    ["1024", "1024x768"],
    ["1440", "1440x900"],
  ]);
  const result = [...viewportByWidth].flatMap(([width, viewport]) =>
    new RegExp(`\\b${width}\\b`).test(value) ? [viewport] : [],
  );
  return result.length > 0 ? result : allViewports;
}

function evidenceKind(cell: string, screenshotStatus: string): AuditEvidenceKind | undefined {
  if (/^V(?:\b|:)/.test(cell)) return "visual";
  if (/^R(?:\b|:)/.test(cell)) return "redirected";
  if (/^S(?:\b|\/)/.test(cell)) return /blocked/i.test(screenshotStatus) ? "blocked" : "static";
  return undefined;
}

function stateName(column: string): string {
  return column.toLowerCase().replace(/\s+/g, "-");
}

export function parseRouteStateMatrix(markdown: string): MatrixState[] {
  const lines = markdown.split(/\r?\n/);
  const result: MatrixState[] = [];
  let section: MatrixState["section"] | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const heading = lines[index].match(/^##\s+(.+)$/)?.[1];
    if (heading) section = sectionForHeading(heading);
    if (!section || !/^\|\s*Route\s*\|/.test(lines[index])) continue;

    const headers = cells(lines[index]);
    const positions = new Map(headers.map((header, position) => [header, position]));
    const routeIndex = positions.get("Route");
    if (routeIndex === undefined) continue;
    const languageIndex = positions.get("Language");
    const viewportIndex = positions.get("Viewport");
    const statusIndex = positions.get("Screenshot status");

    index += 2;
    while (index < lines.length && lines[index].trim().startsWith("|")) {
      const row = cells(lines[index]);
      const route = row[routeIndex];
      const status = statusIndex === undefined ? "" : (row[statusIndex] ?? "");
      for (const stateColumn of stateColumns) {
        const stateIndex = positions.get(stateColumn);
        if (stateIndex === undefined) continue;
        const kind = evidenceKind(row[stateIndex] ?? "", status);
        if (!kind) continue;
        const state = stateName(stateColumn);
        const tierA = kind === "visual";
        result.push({
          matrixKey: `${section}|${route}|${state}`,
          section,
          route,
          state,
          kind,
          languages: tierA
            ? allLanguages
            : documentedLanguages(languageIndex === undefined ? undefined : row[languageIndex]),
          viewports: tierA
            ? allViewports
            : documentedViewports(viewportIndex === undefined ? undefined : row[viewportIndex]),
        });
      }
      index += 1;
    }
    index -= 1;
  }

  return result;
}

function sameMembers(left: readonly string[], right: readonly string[]): boolean {
  return [...left].sort().join("|") === [...right].sort().join("|");
}

export function validateScenarioManifest(
  matrixStates: readonly MatrixState[],
  scenarios: readonly AuditScenario[],
): string[] {
  const errors: string[] = [];
  const expected = new Map<string, MatrixState>();
  for (const state of matrixStates) {
    if (expected.has(state.matrixKey)) errors.push(`duplicate matrix key: ${state.matrixKey}`);
    expected.set(state.matrixKey, state);
  }

  const actual = new Map<string, AuditScenario>();
  const scenarioIds = new Set<string>();
  for (const scenario of scenarios) {
    if (!scenario.state) errors.push(`absent state label: ${scenario.scenarioId}`);
    if (scenario.kind === "visual") {
      if (scenario.evidence.type !== "component" || typeof scenario.render !== "function")
        errors.push(`invalid component evidence: ${scenario.scenarioId}`);
    } else {
      if ("render" in scenario && scenario.render !== undefined)
        errors.push(`non-visual scenario is renderable: ${scenario.scenarioId}`);
      if (scenario.kind === "static" && scenario.evidence.type !== "source")
        errors.push(`invalid source evidence: ${scenario.scenarioId}`);
      if (scenario.kind === "redirected" && scenario.evidence.type !== "redirect")
        errors.push(`invalid redirect evidence: ${scenario.scenarioId}`);
      if (scenario.kind === "blocked" && scenario.evidence.type !== "blocked")
        errors.push(`invalid blocked evidence: ${scenario.scenarioId}`);
    }
    if (scenarioIds.has(scenario.scenarioId))
      errors.push(`duplicate scenario id: ${scenario.scenarioId}`);
    scenarioIds.add(scenario.scenarioId);
    if (actual.has(scenario.matrixKey))
      errors.push(`duplicate matrix coverage: ${scenario.matrixKey}`);
    actual.set(scenario.matrixKey, scenario);
  }

  for (const [key, state] of expected) {
    const scenario = actual.get(key);
    if (!scenario) {
      errors.push(`missing matrix state: ${key}`);
      continue;
    }
    if (scenario.kind !== state.kind)
      errors.push(`wrong evidence kind: ${key} (${scenario.kind}, expected ${state.kind})`);
    if (!sameMembers(scenario.languages, state.languages)) errors.push(`omitted language: ${key}`);
    if (!sameMembers(scenario.viewports, state.viewports)) errors.push(`omitted viewport: ${key}`);
    if (scenario.expectedLandmarks.main !== 1) errors.push(`missing main landmark: ${key}`);
  }
  for (const key of actual.keys()) {
    if (!expected.has(key)) errors.push(`undocumented matrix state: ${key}`);
  }
  return errors.sort();
}

const forbiddenImportPatterns = [
  { pattern: /\.functions(?:[./"'])/i, label: ".functions" },
  { pattern: /\.server(?:[./"'])/i, label: ".server" },
  { pattern: /supabase/i, label: "Supabase" },
  { pattern: /\buse(?:Mutation|[A-Z]\w*Mutation)\b/, label: "mutation hook" },
] as const;

export function validateFixtureSource(file: string, source: string): string[] {
  const staticImports = [
    ...source.matchAll(/\b(?:import|export)\b[\s\S]*?\bfrom\s*["'][^"']+["']/g),
  ]
    .map((match) => match[0])
    .join("\n");
  const directImports = [...source.matchAll(/\bimport\s*(?:\(|)["'][^"']+["']\)?/g)]
    .map((match) => match[0])
    .join("\n");
  const importText = `${staticImports}\n${directImports}`;
  return forbiddenImportPatterns.flatMap(({ pattern, label }) =>
    pattern.test(importText) ? [`${file}: forbidden ${label} import`] : [],
  );
}

export function validateFixtureImports(projectRoot: string): string[] {
  const directory = join(projectRoot, "tools/ui-audit/scenarios");
  if (!existsSync(directory)) return [`missing scenario directory: ${directory}`];
  return readdirSync(directory)
    .filter((file) => /\.tsx?$/.test(file))
    .sort()
    .flatMap((file) => validateFixtureSource(file, readFileSync(join(directory, file), "utf8")));
}

export function validateCurrentManifest(projectRoot = resolve(import.meta.dir, "../..")): string[] {
  const markdown = readFileSync(join(projectRoot, "docs/design/route-state-matrix.md"), "utf8");
  return [
    ...validateScenarioManifest(parseRouteStateMatrix(markdown), auditScenarios),
    ...validateEvidenceSources(projectRoot, auditScenarios),
    ...validateFixtureImports(projectRoot),
  ];
}

export function validateEvidenceSources(
  projectRoot: string,
  scenarios: readonly AuditScenario[],
): string[] {
  const errors: string[] = [];
  for (const scenario of scenarios) {
    const source = scenario.evidence.source;
    if (!source?.module || !source.export) {
      errors.push(`${scenario.scenarioId}: missing product source evidence`);
      continue;
    }
    const absolutePath = join(projectRoot, source.module);
    if (!existsSync(absolutePath)) {
      errors.push(`${scenario.scenarioId}: missing product source module ${source.module}`);
      continue;
    }
    const escapedExport = source.export.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const productSource = readFileSync(absolutePath, "utf8");
    if (
      !new RegExp(`export\\s+(?:function|const|class)\\s+${escapedExport}\\b`).test(productSource)
    )
      errors.push(
        `${scenario.scenarioId}: missing product export ${source.export} in ${source.module}`,
      );
  }
  return [...new Set(errors)].sort();
}

if (import.meta.main) {
  const errors = validateCurrentManifest();
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`UI audit manifest valid: ${auditScenarios.length} route-state scenarios`);
  }
}
