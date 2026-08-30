import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { AuditScenario } from "./types";
import {
  interactionArtifactSha256,
  interactionSourceSha256,
  validateInteractionEvidence,
  type InteractionEvidence,
} from "./interaction-checks";
import {
  VOICEOVER_JOURNEYS,
  expectedVoiceOverManualObservations,
  voiceOverJourneyQuery,
  type VoiceOverJourney,
} from "./voiceover-journeys";

export const REQUIRED_MANUAL_JOURNEYS = [
  "auth",
  "booking",
  "cancellation",
  "payment-result",
  "instructor-attendance",
  "admin-destructive-confirmation",
  "global-navigation",
] as const;

const languages = ["he", "ar", "en"] as const;
const voiceOverTranscript = "docs/design/evidence/task-15-voiceover-transcript.md";
const automatedChecks = [
  "keyboard",
  "activation",
  "escape",
  "focus",
  "reflow-200",
  "reflow-400",
  "reduced-motion",
  "forced-colors",
  "latency",
] as const;

type EvidenceInput = {
  accessibilityDocument: string;
  visualDocument: string;
  interactionDocument: string;
  voiceOverTranscriptDocument?: string;
  voiceOverTranscriptPath?: string;
  scenarios: readonly AuditScenario[];
};

const trackedVoiceOverTranscriptPath = resolve(
  import.meta.dir,
  "../../docs/design/evidence/task-15-voiceover-transcript.md",
);

type ParsedRow = string[];

function tableRows(document: string): ParsedRow[] {
  return document
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .map((line) =>
      line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim()),
    )
    .filter((cells) => !cells.every((cell) => /^:?-+:?$/.test(cell)));
}

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

function isRecordedStatus(value: string): boolean {
  return value === "pass" || value === "not-applicable" || value === "fail";
}

function metadataValue(document: string, label: string): string | undefined {
  const prefix = `**${label}:**`;
  return document
    .split("\n")
    .find((line) => line.startsWith(prefix))
    ?.slice(prefix.length)
    .trim()
    .replace(/^`|`$/g, "");
}

function readerVisibleMarkdown(document: string): string {
  return document
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(
      /<([a-z][\w-]*)\b[^>]*(?:\shidden(?:\s*=\s*(?:["'][^"']*["']|[^\s>]+))?|\saria-hidden\s*=\s*["']true["'])[^>]*>[\s\S]*?<\/\1>/gi,
      "",
    );
}

type VoiceOverTranscriptRow = {
  key: string;
  status: string;
  target: string;
  observations: string[];
};

function parseVoiceOverTranscript(document: string): VoiceOverTranscriptRow[] {
  const rows: VoiceOverTranscriptRow[] = [];
  let row: VoiceOverTranscriptRow | null = null;
  const finish = () => {
    if (row) rows.push(row);
    row = null;
  };
  for (const line of document.split("\n")) {
    const heading = line.match(/^## ([a-z-]+-(?:he|ar|en))$/);
    if (heading) {
      finish();
      row = { key: heading[1], status: "", target: "", observations: [] };
      continue;
    }
    if (!row) continue;
    const status = line.match(/^- Status: (\S+)$/);
    if (status) row.status = status[1];
    const target = line.match(/^- Target: `([^`]+)`$/);
    if (target) row.target = target[1];
    const observation = line.match(/^ {2}- `([^`]+)`$/);
    if (observation) row.observations.push(observation[1]);
  }
  finish();
  return rows;
}

export function validateAccessibilityEvidence(input: EvidenceInput): {
  errors: string[];
  automatedRows: number;
  voiceOverRows: number;
  voiceOverPassed: number;
  voiceOverPending: number;
  visualFiles: string[];
  visualPassed: number;
  visualFailed: number;
} {
  const errors: string[] = [];
  const resultProse = readerVisibleMarkdown(input.accessibilityDocument)
    .split("\n")
    .filter(
      (line) =>
        !/^\*\*(?:Forced-colors targets|Forced-colors focus deltas|Representative latency \(ms\)):\*\*/.test(
          line,
        ),
    )
    .join("\n");
  if (
    /\b\d+\s*\/\s*\d+\b[^\n.]{0,120}\b(?:governed forced-colors targets|captured pre-focus\/focused deltas)\b/i.test(
      resultProse,
    )
  )
    errors.push("Accessibility result prose duplicates mechanically checked forced-color counts");
  if (/Representative latency\s*:[^\n]*\b\d+(?:\.\d+)?\s*ms\b/i.test(resultProse))
    errors.push(
      "Accessibility result prose duplicates mechanically checked representative latency",
    );
  const transcriptPath = input.voiceOverTranscriptPath ?? trackedVoiceOverTranscriptPath;
  const transcriptExists = existsSync(transcriptPath);
  const transcriptDocument = transcriptExists
    ? (input.voiceOverTranscriptDocument ?? readFileSync(transcriptPath, "utf8"))
    : undefined;
  if (!transcriptExists || !transcriptDocument?.trim()) {
    errors.push("VoiceOver transcript artifact is missing");
  } else {
    const visibleTranscriptDocument = readerVisibleMarkdown(transcriptDocument);
    const documentedTranscriptHash = metadataValue(
      input.accessibilityDocument,
      "VoiceOver transcript SHA-256",
    );
    if (documentedTranscriptHash !== interactionArtifactSha256(transcriptDocument))
      errors.push("VoiceOver transcript SHA-256 is stale");
    if (
      !/\*\*Operator attribution:\*\*.*parent operator/i.test(transcriptDocument) ||
      !/implementer.*did not independently operate VoiceOver/i.test(transcriptDocument)
    )
      errors.push("VoiceOver transcript lacks explicit parent-operator attribution");
    if (!/\*\*Environment:\*\*.*macOS.*VoiceOver enabled/i.test(transcriptDocument))
      errors.push("VoiceOver transcript lacks the recorded macOS VoiceOver environment");
    if (
      !/structured transcription of the parent operator[’']s reported observation[\s\S]*not cryptographic proof of human operation/i.test(
        visibleTranscriptDocument,
      )
    )
      errors.push(
        "VoiceOver transcript lacks the explicit non-cryptographic manual-evidence caveat",
      );

    const transcriptRows = parseVoiceOverTranscript(transcriptDocument);
    const expectedTranscriptKeys = VOICEOVER_JOURNEYS.flatMap((journey) =>
      languages.map((language) => `${journey}-${language}`),
    );
    const transcriptKeys = transcriptRows.map((row) => row.key);
    for (const duplicate of duplicateValues(transcriptKeys))
      errors.push(
        `Duplicate VoiceOver transcript evidence: ${duplicate.replace(/-(he|ar|en)$/, "/$1")}`,
      );
    for (const missing of expectedTranscriptKeys.filter((key) => !transcriptKeys.includes(key)))
      errors.push(
        `Missing VoiceOver transcript evidence: ${missing.replace(/-(he|ar|en)$/, "/$1")}`,
      );
    for (const unexpected of transcriptKeys.filter((key) => !expectedTranscriptKeys.includes(key)))
      errors.push(`Unexpected VoiceOver transcript evidence: ${unexpected}`);
    for (const row of transcriptRows) {
      const match = row.key.match(/^(.*)-(he|ar|en)$/);
      if (!match || !VOICEOVER_JOURNEYS.includes(match[1] as VoiceOverJourney)) continue;
      const journey = match[1] as VoiceOverJourney;
      const language = match[2] as (typeof languages)[number];
      const key = `${journey}/${language}`;
      if (row.status !== "PASS") errors.push(`VoiceOver transcript ${key} is not PASS`);
      if (row.target !== voiceOverJourneyQuery(journey, language))
        errors.push(`VoiceOver transcript ${key} target does not match catalog`);
      if (
        JSON.stringify(row.observations) !==
        JSON.stringify(expectedVoiceOverManualObservations(journey, language))
      )
        errors.push(`VoiceOver transcript ${key} observations do not match catalog`);
    }
  }
  let interactionArtifact:
    | (InteractionEvidence & {
        schemaVersion?: number;
        generatedAt?: string;
        sourceSha256?: string;
      })
    | null = null;
  try {
    interactionArtifact = JSON.parse(input.interactionDocument);
  } catch {
    errors.push("Interaction artifact is not valid JSON");
  }
  if (interactionArtifact) {
    errors.push(...validateInteractionEvidence(interactionArtifact));
    if (interactionArtifact.schemaVersion !== 2)
      errors.push(`Interaction artifact schemaVersion must be 2`);
    if (interactionArtifact.sourceSha256 !== interactionSourceSha256())
      errors.push("Interaction artifact source SHA-256 is stale");
    const documentedHash = metadataValue(input.accessibilityDocument, "Artifact SHA-256");
    const actualHash = interactionArtifactSha256(input.interactionDocument);
    if (documentedHash !== actualHash)
      errors.push(
        `Interaction artifact SHA-256 mismatch: documented ${documentedHash ?? "missing"}`,
      );
    const documentedTimestamp = metadataValue(input.accessibilityDocument, "Artifact generatedAt");
    if (documentedTimestamp !== interactionArtifact.generatedAt)
      errors.push(
        `Interaction artifact generatedAt mismatch: documented ${documentedTimestamp ?? "missing"}`,
      );
    const forcedColorsChecked = interactionArtifact.scenarioLocales.reduce(
      (total, row) => total + (row.forcedColorsEvidence?.checked ?? 0),
      0,
    );
    const forcedColorsTotal = interactionArtifact.scenarioLocales.reduce(
      (total, row) => total + (row.forcedColorsEvidence?.total ?? 0),
      0,
    );
    const forcedColorsFocusDeltas = interactionArtifact.scenarioLocales.reduce(
      (total, row) => total + (row.forcedColorsEvidence?.focusDeltas ?? 0),
      0,
    );
    const forcedColorsFocusables = interactionArtifact.scenarioLocales.reduce(
      (total, row) => total + (row.forcedColorsEvidence?.focusables ?? 0),
      0,
    );
    if (
      metadataValue(input.accessibilityDocument, "Forced-colors targets") !==
      `${forcedColorsChecked}/${forcedColorsTotal}`
    )
      errors.push("Accessibility summary forced-colors targets do not match interaction artifact");
    if (
      metadataValue(input.accessibilityDocument, "Forced-colors focus deltas") !==
      `${forcedColorsFocusDeltas}/${forcedColorsFocusables}`
    )
      errors.push(
        "Accessibility summary forced-colors focus deltas do not match interaction artifact",
      );
    const expectedLatency = `dialog=${interactionArtifact.representativeFlows.dialog.latencyMs}; schedule=${interactionArtifact.representativeFlows.scheduleFilter.latencyMs}; table=${interactionArtifact.representativeFlows.tableFilter.latencyMs}`;
    if (
      metadataValue(input.accessibilityDocument, "Representative latency (ms)") !== expectedLatency
    )
      errors.push(
        "Accessibility summary representative latency does not match interaction artifact",
      );
    if (
      !interactionArtifact.generatedAt ||
      Number.isNaN(Date.parse(interactionArtifact.generatedAt))
    )
      errors.push("Interaction artifact generatedAt is invalid");
  }
  const accessibilityRows = tableRows(input.accessibilityDocument);
  const automatedRows = accessibilityRows.filter((cells) => cells[0] === "tier-a");
  const expectedAutomated = input.scenarios
    .filter((scenario) => scenario.riskTier === "A" && scenario.kind === "visual")
    .flatMap((scenario) => scenario.languages.map((language) => `${scenario.id}/${language}`))
    .sort();
  const actualAutomated = automatedRows.map((cells) => `${cells[1]}/${cells[2]}`).sort();

  for (const duplicate of duplicateValues(actualAutomated))
    errors.push(`Duplicate automated evidence: ${duplicate}`);
  for (const missing of expectedAutomated.filter((key) => !actualAutomated.includes(key)))
    errors.push(`Missing automated evidence: ${missing}`);
  for (const unexpected of actualAutomated.filter((key) => !expectedAutomated.includes(key)))
    errors.push(`Unexpected automated evidence: ${unexpected}`);

  for (const row of automatedRows) {
    const key = `${row[1]}/${row[2]}`;
    if (row.length !== 13) {
      errors.push(`Automated evidence ${key} must have 13 columns`);
      continue;
    }
    automatedChecks.forEach((check, index) => {
      const value = row[index + 3];
      if (!isRecordedStatus(value)) errors.push(`Automated evidence ${key} lacks ${check} result`);
    });
    if (!row[12].startsWith("docs/design/evidence/task-15-interaction-results.json#"))
      errors.push(`Automated evidence ${key} lacks an interaction artifact anchor`);
    const artifactRow = interactionArtifact?.scenarioLocales.find(
      (candidate) => `${candidate.scenarioId}/${candidate.language}` === key,
    );
    if (!artifactRow) continue;
    const artifactStatuses = [
      artifactRow.keyboard,
      artifactRow.activation,
      artifactRow.escape,
      artifactRow.focus,
      artifactRow.reflow200,
      artifactRow.reflow400,
      artifactRow.reducedMotion,
      artifactRow.forcedColors,
      artifactRow.latency,
    ];
    artifactStatuses.forEach((status, index) => {
      if (row[index + 3] !== status)
        errors.push(
          `Automated evidence ${key} ${automatedChecks[index]} does not match interaction artifact`,
        );
    });
    const expectedAnchor = `docs/design/evidence/task-15-interaction-results.json#${key}`;
    if (row[12] !== expectedAnchor)
      errors.push(`Automated evidence ${key} has an incorrect interaction artifact anchor`);
  }

  const voiceOverRows = accessibilityRows.filter(
    (cells) =>
      cells.length === 4 &&
      REQUIRED_MANUAL_JOURNEYS.includes(cells[0] as (typeof REQUIRED_MANUAL_JOURNEYS)[number]) &&
      languages.includes(cells[1] as (typeof languages)[number]),
  );
  const expectedVoiceOver = REQUIRED_MANUAL_JOURNEYS.flatMap((journey) =>
    languages.map((language) => `${journey}/${language}`),
  ).sort();
  const actualVoiceOver = voiceOverRows.map((cells) => `${cells[0]}/${cells[1]}`).sort();
  for (const duplicate of duplicateValues(actualVoiceOver))
    errors.push(`Duplicate VoiceOver evidence: ${duplicate}`);
  for (const missing of expectedVoiceOver.filter((key) => !actualVoiceOver.includes(key)))
    errors.push(`Missing VoiceOver evidence: ${missing}`);
  for (const row of voiceOverRows) {
    const [journey, language, status, artifact] = row;
    if (status !== "pass" && status !== "fail" && status !== "pending-manual")
      errors.push(`VoiceOver ${journey}/${language} has invalid status ${status}`);
    if (status === "pass" && (!artifact || artifact === "—"))
      errors.push(
        `VoiceOver ${journey}/${language} cannot pass without a recording or transcript artifact`,
      );
    if (status === "pass") {
      const expectedArtifact = `${voiceOverTranscript}#${journey}-${language}`;
      if (artifact !== expectedArtifact)
        errors.push(`VoiceOver ${journey}/${language} has an incorrect transcript artifact`);
    }
  }

  const visualRows = tableRows(input.visualDocument).filter((cells) =>
    cells[0]?.startsWith("artifacts/ui-audit/current/screenshots/"),
  );
  const visualFiles = visualRows.map((cells) => cells[0].replace(/^.*\//, ""));
  for (const duplicate of duplicateValues(visualFiles))
    errors.push(`Duplicate visual evidence: ${duplicate}`);
  for (const row of visualRows) {
    const filename = row[0].replace(/^.*\//, "");
    if (row.length !== 9) {
      errors.push(`Visual evidence ${filename} must have 9 columns`);
      continue;
    }
    for (let index = 1; index <= 7; index += 1) {
      if (row[index] !== "pass" && row[index] !== "fail")
        errors.push(`Visual evidence ${filename} has an unrecorded inspection field`);
    }
    if (row[8] !== "accepted" && !row[8].startsWith("fixed:"))
      errors.push(`Visual evidence ${filename} lacks a disposition`);
  }

  return {
    errors,
    automatedRows: automatedRows.length,
    voiceOverRows: voiceOverRows.length,
    voiceOverPassed: voiceOverRows.filter((row) => row[2] === "pass").length,
    voiceOverPending: voiceOverRows.filter((row) => row[2] === "pending-manual").length,
    visualFiles,
    visualPassed: visualRows.filter((row) => row.slice(1, 8).every((value) => value === "pass"))
      .length,
    visualFailed: visualRows.filter((row) => row.slice(1, 8).some((value) => value === "fail"))
      .length,
  };
}
