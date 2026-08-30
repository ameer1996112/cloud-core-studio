import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  collectFinalArtifactRecords,
  validateFinalArtifactIntegrity,
} from "../../tools/ui-audit/final-evidence";

const projectRoot = resolve(import.meta.dir, "../..");
const read = (path: string) => readFileSync(join(projectRoot, path), "utf8");
const manifest = JSON.parse(read("artifacts/ui-audit/final/manifest.json"));
const audit = read("docs/design/ui-ux-audit.md");
const inventory = read("docs/design/design-inventory.md");
const migration = read("docs/design/ui-migration-plan.md");
const matrix = read("docs/design/route-state-matrix.md");
const system = read("docs/design/cloud-core-design-system-proposal.md");
const visualLedger = read("docs/design/visual-regression-results.md");

describe("Task 16 final evidence", () => {
  test("publishes the honest score and reconciles its seven deductions", () => {
    expect(manifest.finalScore.total).toBe(92);
    expect(manifest.finalScore.categories).toEqual({
      uxClarityAndTaskFlow: "19/20",
      visualHierarchyAndTypography: "14/15",
      brandExpression: "15/15",
      componentAndDesignSystemConsistency: "14/15",
      mobileAndResponsiveQuality: "9/10",
      rtlAndLocalization: "9/10",
      accessibility: "9/10",
      performanceAndPerceivedSpeed: "3/5",
    });
    expect(manifest.finalScore.deductions).toHaveLength(7);
    expect(
      new Set(manifest.finalScore.deductions.map((item: { category: string }) => item.category))
        .size,
    ).toBe(7);
    const calculatedTotal = Object.values(manifest.finalScore.categories).reduce(
      (total: number, score) => total + Number.parseInt(String(score).split("/")[0], 10),
      0,
    );
    expect(calculatedTotal).toBe(manifest.finalScore.total);
    for (const document of [audit, inventory, migration, matrix, system]) {
      expect(document).toContain("92/100");
    }
  });

  test("does not over-close protected-role or responsive visual coverage", () => {
    expect(audit).toContain("16 visual product surfaces");
    expect(audit).toContain("303 nonvisual state dispositions");
    expect(audit).toContain("170 protected-runtime blocked states");
    expect(audit).toContain("QA-01 | P2 | Open");
    expect(audit).toContain("registration CTA remains below the initial 390×844 viewport");
    expect(audit).not.toContain("covers all role/state presentations");
    expect(migration).not.toContain("final captures |\n| 8 — Admin");
    expect(inventory).not.toContain("all role/state presentations");
    const screenshots = manifest.payloadInventory.filter(
      (item: { group: string }) => item.group === "screenshot",
    );
    expect(screenshots).toHaveLength(288);
    expect(
      screenshots.every((item: { path: string }) =>
        item.path.split("/").at(-1)?.startsWith("guest-"),
      ),
    ).toBe(true);
  });

  test("keeps cross-document findings and evidence links consistent", () => {
    expect(matrix).not.toContain("nested `main` found statically");
    expect(matrix).toContain("nested `main` fixed in source");
    expect(visualLedger).toContain("retained generation ledger");
    expect(visualLedger).toContain("artifacts/ui-audit/final/manifest.json");
    expect(visualLedger).toContain("artifacts/ui-audit/final/screenshots/");
  });

  test("lists every original finding with an explicit disposition", () => {
    const expected = [
      "A11Y-01",
      "A11Y-02",
      "PERF-01",
      "LOC-01",
      "DS-01",
      "UX-01",
      "A11Y-03",
      "QA-01",
      "TYPE-01",
      "CSS-01",
      "RTL-02",
      "NAV-01",
      "POLISH-01",
      "POLISH-02",
      "POLISH-03",
      "POLISH-04",
      "POLISH-05",
    ];
    const rows = audit
      .split("\n")
      .filter((line) => /^\| (?:A11Y|PERF|LOC|DS|UX|QA|TYPE|CSS|RTL|NAV|POLISH)-\d+ \|/.test(line));
    expect(rows).toHaveLength(expected.length);
    expect(rows.map((row) => row.split("|")[1].trim())).toEqual(expected);
    expect(rows.every((row) => /\| (?:Fixed|Open|Partially fixed)/.test(row))).toBe(true);
  });

  test("declares checksummed screenshot and Lighthouse payloads", () => {
    expect(manifest.finalTree.fileCount).toBe(300);
    expect(manifest.payloadInventory).toHaveLength(294);
    expect(
      manifest.payloadInventory.filter((item: { group: string }) => item.group === "screenshot"),
    ).toHaveLength(288);
    expect(
      manifest.payloadInventory.filter(
        (item: { group: string }) => item.group === "lighthouse-payload",
      ),
    ).toHaveLength(6);
    for (const item of manifest.payloadInventory) {
      expect(item.path).toStartWith("artifacts/ui-audit/final/");
      expect(item.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(item.sizeBytes).toBeGreaterThan(0);
    }
  });

  test("fails closed when a final payload is changed, missing, or extra", () => {
    expect(validateFinalArtifactIntegrity({ projectRoot })).toEqual([]);
    const actualFiles = collectFinalArtifactRecords(projectRoot);
    const screenshotIndex = manifest.payloadInventory.findIndex(
      (item: { group: string }) => item.group === "screenshot",
    );

    const changed = structuredClone(manifest);
    changed.payloadInventory[screenshotIndex].sha256 = "0".repeat(64);
    expect(
      validateFinalArtifactIntegrity({ projectRoot, manifest: changed, actualFiles }).join("\n"),
    ).toContain("SHA-256 does not match");

    const missing = structuredClone(manifest);
    missing.payloadInventory.splice(screenshotIndex, 1);
    const missingErrors = validateFinalArtifactIntegrity({
      projectRoot,
      manifest: missing,
      actualFiles,
    }).join("\n");
    expect(missingErrors).toContain("exactly 288 screenshots");
    expect(missingErrors).toContain("unexpected final artifact");

    const fabricated = structuredClone(manifest);
    fabricated.payloadInventory.push({
      group: "screenshot",
      path: "artifacts/ui-audit/final/screenshots/fabricated.png",
      sizeBytes: 1,
      sha256: "0".repeat(64),
    });
    expect(
      validateFinalArtifactIntegrity({ projectRoot, manifest: fabricated, actualFiles }).join("\n"),
    ).toContain("declared payload is missing");

    const extraActual = [
      ...actualFiles,
      { path: "artifacts/ui-audit/final/untracked.json", sizeBytes: 2, sha256: "1".repeat(64) },
    ];
    expect(
      validateFinalArtifactIntegrity({ projectRoot, manifest, actualFiles: extraActual }).join(
        "\n",
      ),
    ).toContain("unexpected final artifact");
  });
});
