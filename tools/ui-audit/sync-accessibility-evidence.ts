import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { interactionArtifactSha256, type InteractionEvidence } from "./interaction-checks";

const projectRoot = resolve(import.meta.dir, "../..");
const artifactPath = resolve(projectRoot, "docs/design/evidence/task-15-interaction-results.json");
const documentPath = resolve(projectRoot, "docs/design/accessibility-verification.md");
const artifactDocument = readFileSync(artifactPath, "utf8");
const artifact = JSON.parse(artifactDocument) as InteractionEvidence & { generatedAt: string };
const rows = new Map(
  artifact.scenarioLocales.map((row) => [`${row.scenarioId}/${row.language}`, row]),
);

let document = readFileSync(documentPath, "utf8")
  .replace(
    /\*\*Artifact generatedAt:\*\* `[^`]*`/,
    `**Artifact generatedAt:** \`${artifact.generatedAt}\``,
  )
  .replace(
    /\*\*Artifact SHA-256:\*\* `[^`]*`/,
    `**Artifact SHA-256:** \`${interactionArtifactSha256(artifactDocument)}\``,
  )
  .replace(
    /\*\*Representative latency \(ms\):\*\* `[^`]*`/,
    `**Representative latency (ms):** \`dialog=${artifact.representativeFlows.dialog.latencyMs}; schedule=${artifact.representativeFlows.scheduleFilter.latencyMs}; table=${artifact.representativeFlows.tableFilter.latencyMs}\``,
  );

document = document
  .split("\n")
  .map((line) => {
    if (!line.startsWith("| tier-a |")) return line;
    const cells = line
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    const key = `${cells[1]}/${cells[2]}`;
    const row = rows.get(key);
    if (!row) throw new Error(`Accessibility document has no interaction row for ${key}`);
    return `| ${[
      "tier-a",
      row.scenarioId,
      row.language,
      row.keyboard,
      row.activation,
      row.escape,
      row.focus,
      row.reflow200,
      row.reflow400,
      row.reducedMotion,
      row.forcedColors,
      row.latency,
      `docs/design/evidence/task-15-interaction-results.json#${key}`,
    ].join(" | ")} |`;
  })
  .join("\n");

writeFileSync(documentPath, document);
console.log(`Synchronized ${rows.size} Task 15 interaction rows`);
