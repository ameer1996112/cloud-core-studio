import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  REQUIRED_MANUAL_JOURNEYS,
  validateAccessibilityEvidence,
} from "../../tools/ui-audit/accessibility-evidence";
import { screenshotFilename } from "../../tools/ui-audit/capture";
import { auditScenarios } from "../../tools/ui-audit/fixtures";
import { filterScheduleClasses } from "../../src/components/member/schedule-filtering";
import {
  accessibilityRelevantStrings,
  contrastRatio,
  forcedColorTargetIsDistinguishable,
  forcedColorTargetCategories,
  hasHorizontalOverflow,
  interactionSourceClosure,
  interactionSourceSha256,
  localeLeakageViolations,
  renderedForcedColorBackground,
  validateInteractionEvidence,
} from "../../tools/ui-audit/interaction-checks";

const projectRoot = join(import.meta.dir, "../..");
const accessibilityDocument = readFileSync(
  join(projectRoot, "docs/design/accessibility-verification.md"),
  "utf8",
);
const visualDocument = readFileSync(
  join(projectRoot, "docs/design/visual-regression-results.md"),
  "utf8",
);
const interactionDocument = readFileSync(
  join(projectRoot, "docs/design/evidence/task-15-interaction-results.json"),
  "utf8",
);
const voiceOverTranscriptDocument = readFileSync(
  join(projectRoot, "docs/design/evidence/task-15-voiceover-transcript.md"),
  "utf8",
);
type DiscrepancyMeasurements = {
  sourceRevision: string;
  support: Record<string, { overflow: number }>;
  appFocus: {
    boxShadow: string;
    contrastAgainstIvory?: number;
    contrastAgainstOpaqueHalo?: number;
  };
  sha256: Record<string, string>;
};

describe("Task 15 accessibility evidence", () => {
  test("records every automated tier-A journey and locale without replacing manual evidence", () => {
    const result = validateAccessibilityEvidence({
      accessibilityDocument,
      visualDocument,
      interactionDocument,
      voiceOverTranscriptDocument,
      scenarios: auditScenarios,
    });

    expect(result.errors).toEqual([]);
    expect(result.automatedRows).toBe(48);
    expect(result.voiceOverRows).toBe(REQUIRED_MANUAL_JOURNEYS.length * 3);
    expect(result.voiceOverPassed).toBe(REQUIRED_MANUAL_JOURNEYS.length * 3);
    expect(result.voiceOverPending).toBe(0);
  });

  test("records one systematic visual disposition for every generated capture", () => {
    const expectedFiles = auditScenarios
      .filter((scenario) => scenario.riskTier === "A" && scenario.kind === "visual")
      .flatMap((scenario) =>
        scenario.languages.flatMap((language) =>
          scenario.viewports.map((viewport) => screenshotFilename(scenario, language, viewport)),
        ),
      )
      .sort();
    const result = validateAccessibilityEvidence({
      accessibilityDocument,
      visualDocument,
      interactionDocument,
      voiceOverTranscriptDocument,
      scenarios: auditScenarios,
    });

    expect(expectedFiles).toHaveLength(288);
    expect(result.visualFiles.sort()).toEqual(expectedFiles);
    expect(result.visualPassed).toBe(288);
    expect(result.visualFailed).toBe(0);
  });

  test("rejects a VoiceOver pass that has no recording or transcript evidence", () => {
    const dishonest = accessibilityDocument.replace(
      /\|\s*auth\s*\|\s*he\s*\|\s*pass\s*\|\s*docs\/design\/evidence\/task-15-voiceover-transcript\.md#auth-he\s*\|/,
      "| auth | he | pass | — |",
    );
    const result = validateAccessibilityEvidence({
      accessibilityDocument: dishonest,
      visualDocument,
      interactionDocument,
      voiceOverTranscriptDocument,
      scenarios: auditScenarios,
    });

    expect(result.errors).toContain(
      "VoiceOver auth/he cannot pass without a recording or transcript artifact",
    );
    expect(result.errors).toContain("VoiceOver auth/he has an incorrect transcript artifact");
  });

  test("rejects missing, fabricated, duplicate, or identity-stale VoiceOver transcript rows", () => {
    const loadedFromTrackedPath = validateAccessibilityEvidence({
      accessibilityDocument,
      visualDocument,
      interactionDocument,
      voiceOverTranscriptDocument: undefined,
      scenarios: auditScenarios,
    });
    const missing = validateAccessibilityEvidence({
      accessibilityDocument,
      visualDocument,
      interactionDocument,
      voiceOverTranscriptDocument: undefined,
      voiceOverTranscriptPath: join(projectRoot, "docs/design/evidence/missing-transcript.md"),
      scenarios: auditScenarios,
    });
    const fabricated = validateAccessibilityEvidence({
      accessibilityDocument,
      visualDocument,
      interactionDocument,
      voiceOverTranscriptDocument: voiceOverTranscriptDocument
        .replace(
          "Target: `/?scenario=guest-auth-default&language=he&evidence=1`",
          "Target: `/?scenario=fabricated&language=he&evidence=1`",
        )
        .replace("initial-focus:אימייל", "initial-focus:fabricated"),
      scenarios: auditScenarios,
    });
    const duplicated = validateAccessibilityEvidence({
      accessibilityDocument,
      visualDocument,
      interactionDocument,
      voiceOverTranscriptDocument: `${voiceOverTranscriptDocument}\n## auth-he\n\n- Status: PASS`,
      scenarios: auditScenarios,
    });

    expect(loadedFromTrackedPath.errors).not.toContain("VoiceOver transcript artifact is missing");
    expect(missing.errors).toContain("VoiceOver transcript artifact is missing");
    expect(fabricated.errors).toContain("VoiceOver transcript SHA-256 is stale");
    expect(fabricated.errors).toContain(
      "VoiceOver transcript auth/he target does not match catalog",
    );
    expect(fabricated.errors).toContain(
      "VoiceOver transcript auth/he observations do not match catalog",
    );
    expect(duplicated.errors).toContain("Duplicate VoiceOver transcript evidence: auth/he");
  });

  test("requires the explicit non-cryptographic manual-attribution caveat", () => {
    const withoutCaveat = voiceOverTranscriptDocument.replace(
      "It establishes tracked evidence completeness and identity; it is not cryptographic proof of human operation.",
      "It establishes tracked evidence completeness and identity.",
    );
    const replacementHash = createHash("sha256").update(withoutCaveat).digest("hex");
    const documentWithMatchingHash = accessibilityDocument.replace(
      /^\*\*VoiceOver transcript SHA-256:\*\* `[^`]+`$/m,
      `**VoiceOver transcript SHA-256:** \`${replacementHash}\``,
    );
    const result = validateAccessibilityEvidence({
      accessibilityDocument: documentWithMatchingHash,
      visualDocument,
      interactionDocument,
      voiceOverTranscriptDocument: withoutCaveat,
      scenarios: auditScenarios,
    });

    expect(result.errors).toContain(
      "VoiceOver transcript lacks the explicit non-cryptographic manual-evidence caveat",
    );
    expect(result.errors).not.toContain("VoiceOver transcript SHA-256 is stale");
  });

  test("requires the manual-evidence caveat to be reader-visible prose", () => {
    const caveat =
      "It establishes tracked evidence completeness and identity; it is not cryptographic proof of human operation.";
    const commentedCaveat = voiceOverTranscriptDocument.replace(caveat, `<!-- ${caveat} -->`);
    const replacementHash = createHash("sha256").update(commentedCaveat).digest("hex");
    const documentWithMatchingHash = accessibilityDocument.replace(
      /^\*\*VoiceOver transcript SHA-256:\*\* `[^`]+`$/m,
      `**VoiceOver transcript SHA-256:** \`${replacementHash}\``,
    );
    const result = validateAccessibilityEvidence({
      accessibilityDocument: documentWithMatchingHash,
      visualDocument,
      interactionDocument,
      voiceOverTranscriptDocument: commentedCaveat,
      scenarios: auditScenarios,
    });

    expect(result.errors).toContain(
      "VoiceOver transcript lacks the explicit non-cryptographic manual-evidence caveat",
    );
    expect(result.errors).not.toContain("VoiceOver transcript SHA-256 is stale");
  });

  test("rejects duplicate or omitted visual capture dispositions", () => {
    const firstVisualRow = visualDocument
      .split("\n")
      .find((line) => line.startsWith("| artifacts/ui-audit/current/screenshots/"));
    expect(firstVisualRow).toBeDefined();
    const damaged = `${visualDocument}\n${firstVisualRow}`;
    const result = validateAccessibilityEvidence({
      accessibilityDocument,
      visualDocument: damaged,
      interactionDocument,
      voiceOverTranscriptDocument,
      scenarios: auditScenarios,
    });

    expect(result.errors.some((error) => error.startsWith("Duplicate visual evidence:"))).toBe(
      true,
    );
  });

  test("retains reproducible before and after evidence for both fixed discrepancies", () => {
    const beforeRoot = join(projectRoot, "docs/design/evidence/task-15-before-0b2d63c");
    const afterRoot = join(projectRoot, "docs/design/evidence/task-15-after");
    const before = JSON.parse(
      readFileSync(join(beforeRoot, "measurements.json"), "utf8"),
    ) as DiscrepancyMeasurements;
    const after = JSON.parse(
      readFileSync(join(afterRoot, "measurements.json"), "utf8"),
    ) as DiscrepancyMeasurements;

    expect(before.sourceRevision).toBe("0b2d63ca9acee404b58b931453f0bbfa4ea7fae3");
    expect(after.sourceRevision).toBe("fe455d4a1937cab5d472e58d1a157f5ede22dc83");
    expect(Object.values(before.support).map((entry) => entry.overflow)).toEqual([63, 63, 63]);
    expect(Object.values(after.support).map((entry) => entry.overflow)).toEqual([0, 0, 0]);
    expect(before.appFocus.boxShadow).toBe("none");
    expect(after.appFocus.boxShadow).toContain("6px");
    expect(before.appFocus.contrastAgainstIvory).toBe(2.04);
    expect(after.appFocus.contrastAgainstOpaqueHalo).toBe(5.6);
    for (const [filename, expectedHash] of Object.entries(before.sha256)) {
      expect(
        createHash("sha256")
          .update(readFileSync(join(beforeRoot, filename)))
          .digest("hex"),
      ).toBe(expectedHash);
    }
    for (const [filename, expectedHash] of Object.entries(after.sha256)) {
      expect(
        createHash("sha256")
          .update(readFileSync(join(afterRoot, filename)))
          .digest("hex"),
      ).toBe(expectedHash);
    }
    expect(visualDocument).toContain("| support-400-reflow |");
    expect(visualDocument).toContain("| app-marketing-image-focus |");
  });

  test("rejects fabricated, missing, extra, or blanket interaction rows", () => {
    const fabricated = JSON.parse(interactionDocument);
    fabricated.scenarioLocales[0].scenarioId = "fabricated-scenario";
    fabricated.scenarioLocales[1].keyboard = "pass";
    fabricated.scenarioLocales[1].activation = "pass";
    fabricated.scenarioLocales[1].escape = "pass";
    fabricated.scenarioLocales[1].focus = "pass";
    fabricated.scenarioLocales[1].reflow200 = "pass";
    fabricated.scenarioLocales[1].reflow400 = "pass";
    fabricated.scenarioLocales[1].reducedMotion = "pass";
    fabricated.scenarioLocales[1].forcedColors = "pass";
    fabricated.scenarioLocales[1].latency = "pass";
    fabricated.scenarioLocales.push({ ...fabricated.scenarioLocales[2] });

    const result = validateAccessibilityEvidence({
      accessibilityDocument,
      visualDocument,
      interactionDocument: JSON.stringify(fabricated),
      voiceOverTranscriptDocument,
      scenarios: auditScenarios,
    });

    expect(result.errors).toContain("Unexpected interaction evidence: fabricated-scenario/ar");
    expect(result.errors).toContain("Missing interaction evidence: guest-app-default/ar");
    expect(result.errors).toContain("Duplicate interaction evidence: guest-app-default/he");
    expect(result.errors).toContain("guest-app-default/en uses an impossible blanket status");
  });

  test("rejects missing typed not-applicable reasons and stale artifact identity", () => {
    const stale = JSON.parse(interactionDocument);
    delete stale.scenarioLocales[0].notApplicableReasons.escape;
    stale.generatedAt = "2020-01-01T00:00:00.000Z";

    const result = validateAccessibilityEvidence({
      accessibilityDocument,
      visualDocument,
      interactionDocument: JSON.stringify(stale),
      voiceOverTranscriptDocument,
      scenarios: auditScenarios,
    });

    expect(result.errors).toContain(
      "guest-app-default/ar escape not-applicable lacks a typed reason",
    );
    expect(result.errors.some((error) => error.includes("artifact SHA-256"))).toBe(true);
    expect(result.errors.some((error) => error.includes("generatedAt"))).toBe(true);
  });

  test("rejects stale forced-color counts, focus deltas, and representative latency in the summary", () => {
    const staleDocuments = [
      accessibilityDocument.replace(
        /^\*\*Forced-colors targets:\*\* `[^`]+`$/m,
        "**Forced-colors targets:** `899/900`",
      ),
      accessibilityDocument.replace(
        /^\*\*Forced-colors focus deltas:\*\* `[^`]+`$/m,
        "**Forced-colors focus deltas:** `155/156`",
      ),
      accessibilityDocument.replace(
        /^\*\*Representative latency \(ms\):\*\* `[^`]+`$/m,
        "**Representative latency (ms):** `dialog=199; schedule=199; table=199`",
      ),
    ];
    const expectedErrors = [
      "Accessibility summary forced-colors targets do not match interaction artifact",
      "Accessibility summary forced-colors focus deltas do not match interaction artifact",
      "Accessibility summary representative latency does not match interaction artifact",
    ];

    staleDocuments.forEach((accessibilityDocument, index) => {
      const result = validateAccessibilityEvidence({
        accessibilityDocument,
        visualDocument,
        interactionDocument,
        voiceOverTranscriptDocument,
        scenarios: auditScenarios,
      });
      expect(result.errors).toContain(expectedErrors[index]);
    });
  });

  test("rejects reintroduced reader-visible numeric duplicates outside the checked metadata", () => {
    const staleProseDocuments = [
      accessibilityDocument.replace(
        "## Result",
        "## Result\n\nThe run passed all 899/900 governed forced-colors targets, including 155/156 captured pre-focus/focused deltas.",
      ),
      accessibilityDocument.replace(
        "## Result",
        "## Result\n\nRepresentative latency: dialog 199 ms; production schedule filtering 198 ms; table filtering 197 ms.",
      ),
    ];

    const countResult = validateAccessibilityEvidence({
      accessibilityDocument: staleProseDocuments[0],
      visualDocument,
      interactionDocument,
      voiceOverTranscriptDocument,
      scenarios: auditScenarios,
    });
    const latencyResult = validateAccessibilityEvidence({
      accessibilityDocument: staleProseDocuments[1],
      visualDocument,
      interactionDocument,
      voiceOverTranscriptDocument,
      scenarios: auditScenarios,
    });

    expect(countResult.errors).toContain(
      "Accessibility result prose duplicates mechanically checked forced-color counts",
    );
    expect(latencyResult.errors).toContain(
      "Accessibility result prose duplicates mechanically checked representative latency",
    );
  });

  test("requires one passing localized fixture-semantics row for every pending manual journey", () => {
    const artifact = JSON.parse(interactionDocument);
    expect(artifact.assistiveTechnologyFixtureSemantics).toHaveLength(21);
    expect(
      artifact.assistiveTechnologyFixtureSemantics.every(
        (row: { status: string }) => row.status === "pass",
      ),
    ).toBe(true);

    artifact.assistiveTechnologyFixtureSemantics.pop();
    artifact.assistiveTechnologyFixtureSemantics.push({
      ...artifact.assistiveTechnologyFixtureSemantics[0],
    });
    const errors = validateInteractionEvidence(artifact);
    expect(errors.some((error) => error.startsWith("Missing assistive-technology fixture"))).toBe(
      true,
    );
    expect(errors.some((error) => error.startsWith("Duplicate assistive-technology fixture"))).toBe(
      true,
    );
  });

  test("rejects invalid nested evidence and aggregate statuses that do not reconcile", () => {
    const artifact = JSON.parse(interactionDocument);
    const row = artifact.scenarioLocales.find(
      (candidate: { scenarioId: string; language: string }) =>
        candidate.scenarioId === "guest-app-default" && candidate.language === "en",
    );
    row.keyboardEvidence.expectedOrder = [];
    row.activationEvidence[0].status = "waived";
    row.activation = "not-applicable";
    row.forcedColorsEvidence = { checked: 0, total: 0, focusables: 0, text: 0, images: 0 };
    artifact.representativeFlows.dialog.status = "not-applicable";

    const errors = validateInteractionEvidence(artifact);
    expect(errors).toContain(
      "guest-app-default/en keyboard pass requires nonempty complete focus-order evidence",
    );
    expect(errors).toContain("guest-app-default/en a:Sign In activation has invalid status waived");
    expect(errors).toContain(
      "guest-app-default/en activation aggregate does not reconcile with nested evidence",
    );
    expect(errors).toContain(
      "guest-app-default/en forced-colors pass requires a complete nonempty target set",
    );
    expect(errors).toContain("dialog representative interaction has invalid status not-applicable");
  });

  test("requires the exact assistive-technology target and check catalog", () => {
    const artifact = JSON.parse(interactionDocument);
    const row = artifact.assistiveTechnologyFixtureSemantics.find(
      (candidate: { journey: string; language: string }) =>
        candidate.journey === "auth" && candidate.language === "he",
    );
    row.target = "/?scenario=fabricated&language=he";
    row.checks = ["heading:fabricated", "fabricated-check"];

    const errors = validateInteractionEvidence(artifact);
    expect(errors).toContain("auth/he assistive-technology fixture target does not match catalog");
    expect(errors).toContain("auth/he assistive-technology fixture checks do not match catalog");
  });

  test("hashes the dependency-closed local import graph for rendered fixtures and catalogs", () => {
    const closure = interactionSourceClosure(projectRoot);
    expect(closure).toContain("tools/ui-audit/FixtureApp.tsx");
    expect(closure).toContain("tools/ui-audit/scenarios/visual-adapters.tsx");
    expect(closure).toContain("src/components/visual/VisualClassCard.tsx");
    expect(closure).toContain("src/lib/i18n/catalogs/core.ts");
    expect(closure).toContain("public/images/textures/ivory-paper.svg");
    expect(closure).toEqual([...closure].sort());
  });

  test("changes freshness when a CSS public-url asset changes", () => {
    const root = mkdtempSync(join(tmpdir(), "task15-closure-"));
    try {
      mkdirSync(join(root, "tools/ui-audit"), { recursive: true });
      mkdirSync(join(root, "public/images/textures"), { recursive: true });
      writeFileSync(join(root, "tools/ui-audit/main.tsx"), 'import "./fixture.css";');
      writeFileSync(join(root, "tools/ui-audit/interaction-checks.ts"), "export {};");
      writeFileSync(
        join(root, "tools/ui-audit/fixture.css"),
        '.fixture { background-image: url("/images/textures/ivory-paper.svg"); }',
      );
      const asset = join(root, "public/images/textures/ivory-paper.svg");
      writeFileSync(asset, "before");
      const before = interactionSourceSha256(root);
      expect(interactionSourceClosure(root)).toContain("public/images/textures/ivory-paper.svg");
      writeFileSync(asset, "after");
      expect(interactionSourceSha256(root)).not.toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("documents one supported Bun command with the required product-image loader", () => {
    const scripts = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8")).scripts;
    expect(scripts["ui-audit:interactions"]).toBe(
      "bun --loader .webp=file tools/ui-audit/interaction-checks.ts",
    );
    expect(accessibilityDocument).toContain("bun run ui-audit:interactions");
  });

  test("rejects cross-script and unapproved English leakage without rejecting proper nouns", () => {
    expect(localeLeakageViolations("he", ["רשימת נוכחות", "Attendance roster"])).toEqual([
      "Attendance roster",
    ]);
    expect(localeLeakageViolations("ar", ["قائمة الحضور", "מוזמן/ת"])).toEqual(["מוזמן/ת"]);
    expect(localeLeakageViolations("en", ["Payment received", "סטטוס התשלום מאושר"])).toEqual([
      "סטטוס התשלום מאושר",
    ]);
    expect(
      localeLeakageViolations("he", [
        "Cloud & Core Studio",
        "יוגה אווירית Flow",
        "Maya Cohen",
        "HOT Pilates",
        "Apple and the Apple logo are trademarks of Apple Inc., registered in the U.S. and other countries and regions. App Store is a service mark of Apple Inc.",
        "עברית",
        "العربية",
        "English",
      ]),
    ).toEqual([]);
  });

  test("rejects leaks from hidden name sources, aria-description, and form-derived values", () => {
    const values = accessibilityRelevantStrings({
      visibleText: ["כניסה לסטודיו"],
      hiddenReferencedText: ["Attendance roster"],
      accessibleAttributes: ["Open destructive dialog"],
      formValues: ["Payment confirmed"],
    });
    expect(localeLeakageViolations("he", values)).toEqual([
      "Attendance roster",
      "Open destructive dialog",
      "Payment confirmed",
    ]);
  });

  test("records real outcomes for every enabled button, checkbox, link, and editable field", () => {
    const artifact = JSON.parse(interactionDocument);
    const activations = artifact.scenarioLocales.flatMap(
      (row: { activationEvidence: Array<Record<string, unknown>> }) => row.activationEvidence,
    );
    expect(
      activations.filter(
        (entry: { kind: string; status: string }) =>
          ["button", "checkbox"].includes(entry.kind) && entry.status === "not-applicable",
      ),
    ).toEqual([]);
    expect(
      activations
        .filter((entry: { kind: string }) => ["button", "checkbox"].includes(entry.kind))
        .every(
          (entry: { keys: string[]; assertion: string }) =>
            entry.keys.join(",") === "Enter,Space" &&
            entry.assertion.includes("Enter:") &&
            entry.assertion.includes("Space:"),
        ),
    ).toBe(true);
    expect(
      activations
        .filter((entry: { kind: string }) => entry.kind === "field")
        .every(
          (entry: { status: string; assertion: string }) =>
            entry.status === "pass" && entry.assertion === "editable-value-change",
        ),
    ).toBe(true);
  });

  test("rejects fabricated per-key activation outcomes and arbitrary auth or schedule statuses", () => {
    const artifact = JSON.parse(interactionDocument);
    const auth = artifact.scenarioLocales.find(
      (row: { scenarioId: string; language: string }) =>
        row.scenarioId === "guest-auth-default" && row.language === "en",
    );
    const schedule = artifact.scenarioLocales.find(
      (row: { scenarioId: string; language: string }) =>
        row.scenarioId === "guest-member-schedule-default" && row.language === "en",
    );
    auth.activationEvidence[0].assertion = "Enter:fabricated,Space:fabricated";
    schedule.activationEvidence[0].assertion =
      "Enter:auth-submit-live-status:Anything,Space:schedule-details-state-opened:Anything";

    const errors = validateInteractionEvidence(artifact);
    expect(errors).toContain(
      "guest-auth-default/en button:Enter the studio activation outcome contract does not match adapter",
    );
    expect(errors).toContain(
      "guest-member-schedule-default/en div:Aerial Yoga, 09:00, Details & booking activation outcome contract does not match adapter",
    );
  });

  test("rejects a fabricated exact navigation intent for a committed actionable link", () => {
    const artifact = JSON.parse(interactionDocument);
    const app = artifact.scenarioLocales.find(
      (row: { scenarioId: string; language: string }) =>
        row.scenarioId === "guest-app-default" && row.language === "en",
    );
    const link = app.activationEvidence.find((entry: { kind: string }) => entry.kind === "link");
    link.assertion = "native-navigation-intent:https://fabricated.example/";

    expect(validateInteractionEvidence(artifact)).toContain(
      `guest-app-default/en ${link.control} link activation outcome does not match catalog`,
    );
  });

  test("rejects unknown link controls and missing or malformed navigation assertions", () => {
    const artifact = JSON.parse(interactionDocument);
    const app = artifact.scenarioLocales.find(
      (row: { scenarioId: string; language: string }) =>
        row.scenarioId === "guest-app-default" && row.language === "en",
    );
    const known = app.activationEvidence.find((entry: { kind: string }) => entry.kind === "link");
    known.control = "a:Unknown new link";
    known.assertion = "fabricated";

    const errors = validateInteractionEvidence(artifact);
    expect(errors).toContain(
      "guest-app-default/en a:Unknown new link link control is absent from exact target catalog",
    );
    expect(errors).toContain(
      "guest-app-default/en a:Unknown new link link navigation assertion is missing or malformed",
    );

    const missingTargetArtifact = JSON.parse(interactionDocument);
    const missingTargetApp = missingTargetArtifact.scenarioLocales.find(
      (row: { scenarioId: string; language: string }) =>
        row.scenarioId === "guest-app-default" && row.language === "en",
    );
    const missingTargetLink = missingTargetApp.activationEvidence.find(
      (entry: { kind: string }) => entry.kind === "link",
    );
    missingTargetLink.assertion = "native-navigation-intent:";
    expect(validateInteractionEvidence(missingTargetArtifact)).toContain(
      `guest-app-default/en ${missingTargetLink.control} link navigation assertion is missing or malformed`,
    );

    const missingAssertionArtifact = JSON.parse(interactionDocument);
    const missingAssertionApp = missingAssertionArtifact.scenarioLocales.find(
      (row: { scenarioId: string; language: string }) =>
        row.scenarioId === "guest-app-default" && row.language === "en",
    );
    const missingAssertionLink = missingAssertionApp.activationEvidence.find(
      (entry: { kind: string }) => entry.kind === "link",
    );
    delete missingAssertionLink.assertion;
    expect(validateInteractionEvidence(missingAssertionArtifact)).toContain(
      `guest-app-default/en ${missingAssertionLink.control} link navigation assertion is missing or malformed`,
    );
  });

  test("forced-colors evidence covers ordinary text, controls, and images", () => {
    const artifact = JSON.parse(interactionDocument);
    for (const row of artifact.scenarioLocales) {
      expect(row.forcedColors).toBe("pass");
      expect(row.forcedColorsEvidence.checked).toBe(row.forcedColorsEvidence.total);
      expect(row.forcedColorsEvidence.total).toBeGreaterThan(0);
      expect(row.forcedColorsEvidence.text).toBeGreaterThan(0);
      expect(row.forcedColorsEvidence.controls).toBeGreaterThanOrEqual(0);
      expect(row.forcedColorsEvidence.images).toBeGreaterThanOrEqual(0);
    }
  });

  test("rejects zeroed forced-colors categories when the scenario contains them", () => {
    const artifact = JSON.parse(interactionDocument);
    const app = artifact.scenarioLocales.find(
      (row: { scenarioId: string; language: string }) =>
        row.scenarioId === "guest-app-default" && row.language === "en",
    );
    app.forcedColorsEvidence.focusables = 0;
    app.forcedColorsEvidence.controls = 0;
    app.forcedColorsEvidence.text = 0;
    app.forcedColorsEvidence.images = 0;

    const errors = validateInteractionEvidence(artifact);
    expect(errors).toContain("guest-app-default/en forced-colors focusables category is empty");
    expect(errors).toContain("guest-app-default/en forced-colors controls category is empty");
    expect(errors).toContain("guest-app-default/en forced-colors text category is empty");
    expect(errors).toContain("guest-app-default/en forced-colors images category is empty");
  });

  test("requires one captured pre-focus/focused delta per forced-color focusable", () => {
    const artifact = JSON.parse(interactionDocument);
    const app = artifact.scenarioLocales.find(
      (row: { scenarioId: string; language: string }) =>
        row.scenarioId === "guest-app-default" && row.language === "en",
    );
    app.forcedColorsEvidence.focusDeltas = app.forcedColorsEvidence.focusables - 1;

    expect(validateInteractionEvidence(artifact)).toContain(
      "guest-app-default/en forced-colors focus deltas are incomplete",
    );
  });

  test("requires meaningful forced-color text and control contrast", () => {
    expect(
      forcedColorTargetIsDistinguishable({
        text: true,
        control: false,
        accessibleOnly: false,
        anchor: false,
        disabled: false,
        color: "rgb(0, 0, 0)",
        background: "rgb(0, 0, 0)",
        borderColor: "rgb(0, 0, 0)",
        borderWidth: 0,
        outlineColor: "rgb(0, 0, 0)",
        outlineStyle: "none",
        outlineWidth: 0,
        boxShadow: "none",
        textDecorationLine: "none",
      }),
    ).toBe(false);
    expect(
      forcedColorTargetIsDistinguishable({
        text: true,
        control: true,
        accessibleOnly: false,
        anchor: false,
        disabled: false,
        color: "rgb(0, 0, 0)",
        background: "rgb(255, 255, 255)",
        borderColor: "rgb(0, 0, 0)",
        borderWidth: 1,
        outlineColor: "rgb(0, 0, 0)",
        outlineStyle: "none",
        outlineWidth: 0,
        boxShadow: "none",
        textDecorationLine: "none",
      }),
    ).toBe(true);
    expect(
      forcedColorTargetIsDistinguishable({
        text: true,
        control: false,
        accessibleOnly: false,
        anchor: false,
        disabled: false,
        color: "rgb(0, 0, 0)",
        background: "rgba(255, 255, 255, 0.9)",
        borderColor: "rgba(5, 0, 73, 0.8)",
        borderWidth: 0,
        outlineColor: "rgba(5, 0, 73, 0.8)",
        outlineStyle: "solid",
        outlineWidth: 3,
        boxShadow: "none",
        textDecorationLine: "none",
      }),
    ).toBe(true);
    expect(
      forcedColorTargetIsDistinguishable({
        text: false,
        control: true,
        accessibleOnly: false,
        anchor: false,
        disabled: true,
        color: "rgb(0, 0, 0)",
        background: "rgba(255, 255, 255, 0.05)",
        borderColor: "rgb(0, 0, 0)",
        borderWidth: 0,
        outlineColor: "rgb(0, 0, 0)",
        outlineStyle: "none",
        outlineWidth: 3,
        boxShadow: "none",
        textDecorationLine: "none",
      }),
    ).toBe(true);
  });

  test("classifies visible text inside every control type as text-bearing", () => {
    expect(
      forcedColorTargetCategories({
        image: false,
        control: true,
        referenced: false,
        directText: false,
        textContent: "Reserve your space",
        formText: "",
      }).text,
    ).toBe(true);
    expect(
      forcedColorTargetCategories({
        image: false,
        control: true,
        referenced: false,
        directText: false,
        textContent: "Open the app",
        formText: "",
      }).text,
    ).toBe(true);
    expect(
      forcedColorTargetCategories({
        image: false,
        control: true,
        referenced: false,
        directText: false,
        textContent: "",
        formText: "Email address",
      }).text,
    ).toBe(true);
  });

  test("never lets borders, shadows, or underlines excuse 1:1 control text", () => {
    const sameText = {
      text: true,
      control: true,
      accessibleOnly: false,
      disabled: false,
      color: "rgb(255, 255, 255)",
      background: "rgb(255, 255, 255)",
      outlineColor: "rgb(255, 255, 255)",
      outlineStyle: "none",
      outlineWidth: 0,
    } as const;
    expect(
      forcedColorTargetIsDistinguishable({
        ...sameText,
        anchor: false,
        borderColor: "rgb(0, 0, 0)",
        borderWidth: 2,
        boxShadow: "none",
        textDecorationLine: "none",
      }),
    ).toBe(false);
    expect(
      forcedColorTargetIsDistinguishable({
        ...sameText,
        anchor: false,
        borderColor: "rgb(255, 255, 255)",
        borderWidth: 0,
        boxShadow: "rgb(255, 255, 255) 0 0 0 4px",
        textDecorationLine: "none",
      }),
    ).toBe(false);
    expect(
      forcedColorTargetIsDistinguishable({
        ...sameText,
        anchor: true,
        borderColor: "rgb(255, 255, 255)",
        borderWidth: 0,
        boxShadow: "none",
        textDecorationLine: "underline",
      }),
    ).toBe(false);
  });

  test("composites effective opacity before accepting forced-color text contrast", () => {
    const target = {
      text: true,
      control: false,
      accessibleOnly: false,
      anchor: false,
      disabled: false,
      color: "rgb(0, 0, 0)",
      background: "rgb(255, 255, 255)",
      exteriorBackground: "rgb(255, 255, 255)",
      borderColor: "rgb(0, 0, 0)",
      borderWidth: 0,
      outlineColor: "rgb(0, 0, 0)",
      outlineStyle: "none",
      outlineWidth: 0,
      boxShadow: "none",
      textDecorationLine: "none",
      focusable: false,
      focused: false,
      focusIndicatorColor: "rgb(0, 0, 0)",
      focusIndicatorWidth: 0,
    } as const;

    expect(forcedColorTargetIsDistinguishable({ ...target, effectiveOpacity: 0.01 })).toBe(false);
    expect(forcedColorTargetIsDistinguishable({ ...target, effectiveOpacity: 1 })).toBe(true);
  });

  test("composites nested forced-color background alpha exactly once in paint order", () => {
    const parentOverCanvas = renderedForcedColorBackground([
      "transparent",
      "rgba(0, 0, 0, 0.5)",
      "rgb(255, 255, 255)",
    ]);
    expect(parentOverCanvas).toBe("rgb(128, 128, 128)");

    const textTarget = {
      text: true,
      control: false,
      accessibleOnly: false,
      anchor: false,
      disabled: false,
      background: parentOverCanvas!,
      exteriorBackground: "rgb(255, 255, 255)",
      borderColor: "rgb(0, 0, 0)",
      borderWidth: 0,
      outlineColor: "rgb(0, 0, 0)",
      outlineStyle: "none",
      outlineWidth: 0,
      boxShadow: "none",
      textDecorationLine: "none",
    } as const;
    expect(forcedColorTargetIsDistinguishable({ ...textTarget, color: "rgb(255, 255, 255)" })).toBe(
      false,
    );
    expect(forcedColorTargetIsDistinguishable({ ...textTarget, color: "rgb(0, 0, 0)" })).toBe(true);

    const nestedAlpha = renderedForcedColorBackground([
      "rgba(255, 255, 255, 0.5)",
      "rgba(0, 0, 0, 0.5)",
      "rgb(255, 255, 255)",
    ]);
    expect(nestedAlpha).toBe("rgb(192, 192, 192)");
    expect(
      forcedColorTargetIsDistinguishable({
        ...textTarget,
        color: "rgb(255, 255, 255)",
        background: nestedAlpha!,
      }),
    ).toBe(false);
    expect(
      forcedColorTargetIsDistinguishable({
        ...textTarget,
        color: "rgb(0, 0, 0)",
        background: nestedAlpha!,
      }),
    ).toBe(true);
  });

  test("composites ancestor CSS opacity as nested groups over the true exterior", () => {
    const target = {
      text: true,
      control: false,
      accessibleOnly: false,
      anchor: false,
      disabled: false,
      color: "rgb(255, 255, 255)",
      background: "rgb(0, 0, 0)",
      exteriorBackground: "rgb(0, 0, 0)",
      borderColor: "rgb(0, 0, 0)",
      borderWidth: 0,
      outlineColor: "rgb(0, 0, 0)",
      outlineStyle: "none",
      outlineWidth: 0,
      boxShadow: "none",
      textDecorationLine: "none",
      effectiveOpacity: 0.5,
      paintLayers: [
        { background: "transparent", opacity: 1 },
        { background: "rgb(0, 0, 0)", opacity: 0.5 },
        { background: "rgb(255, 255, 255)", opacity: 1 },
      ],
    } as const;

    // White glyphs remain white while the parent's black group background renders gray.
    expect(forcedColorTargetIsDistinguishable(target)).toBe(false);

    // Two nested opacity groups still preserve sufficient contrast at high opacity.
    expect(
      forcedColorTargetIsDistinguishable({
        ...target,
        color: "rgb(0, 0, 0)",
        paintLayers: [
          { background: "transparent", opacity: 0.9 },
          { background: "rgb(255, 255, 255)", opacity: 0.9 },
          { background: "rgb(255, 255, 255)", opacity: 1 },
        ],
      }),
    ).toBe(true);
  });

  test("requires an active focus indicator independent from a static control border", () => {
    const target = {
      text: false,
      control: true,
      accessibleOnly: false,
      anchor: false,
      disabled: false,
      color: "rgb(0, 0, 0)",
      background: "rgb(255, 255, 255)",
      exteriorBackground: "rgb(255, 255, 255)",
      borderColor: "rgb(0, 0, 0)",
      borderWidth: 1,
      outlineColor: "rgb(255, 255, 255)",
      outlineStyle: "none",
      outlineWidth: 0,
      boxShadow: "rgb(255, 255, 255) 0 0 0 3px",
      textDecorationLine: "none",
      effectiveOpacity: 1,
      focusable: true,
      focused: true,
      focusIndicatorWidth: 3,
    } as const;

    expect(
      forcedColorTargetIsDistinguishable({
        ...target,
        focusIndicatorColor: "rgb(255, 255, 255)",
        focusIndicators: [
          {
            kind: "outline",
            color: "rgb(255, 255, 255)",
            width: 3,
            changed: true,
            inset: false,
          },
        ],
      }),
    ).toBe(false);
    expect(
      forcedColorTargetIsDistinguishable({
        ...target,
        focusIndicatorColor: "rgb(0, 0, 0)",
        focusIndicators: [
          {
            kind: "outline",
            color: "rgb(0, 0, 0)",
            width: 3,
            changed: true,
            inset: false,
          },
        ],
      }),
    ).toBe(true);
  });

  test("accepts only a new or materially changed outer focus indicator", () => {
    const target = {
      text: false,
      control: true,
      accessibleOnly: false,
      anchor: false,
      disabled: false,
      color: "rgb(0, 0, 0)",
      background: "rgb(255, 255, 255)",
      exteriorBackground: "rgb(255, 255, 255)",
      borderColor: "rgb(0, 0, 0)",
      borderWidth: 1,
      outlineColor: "rgb(0, 0, 0)",
      outlineStyle: "none",
      outlineWidth: 0,
      boxShadow: "rgb(0, 0, 0) 0 0 0 3px",
      textDecorationLine: "none",
      effectiveOpacity: 1,
      focusable: true,
      focused: true,
      focusIndicatorColor: "rgb(0, 0, 0)",
      focusIndicatorWidth: 3,
    } as const;

    expect(
      forcedColorTargetIsDistinguishable({
        ...target,
        focusIndicators: [
          {
            kind: "shadow",
            color: "rgb(0, 0, 0)",
            width: 3,
            changed: false,
            inset: false,
          },
        ],
      }),
    ).toBe(false);
    expect(
      forcedColorTargetIsDistinguishable({
        ...target,
        focusIndicators: [
          {
            kind: "shadow",
            color: "rgb(0, 0, 0)",
            width: 3,
            changed: true,
            inset: true,
          },
        ],
      }),
    ).toBe(false);
    expect(
      forcedColorTargetIsDistinguishable({
        ...target,
        focusIndicators: [
          {
            kind: "shadow",
            color: "rgb(0, 0, 0)",
            width: 3,
            changed: true,
            inset: false,
          },
        ],
      }),
    ).toBe(true);
  });

  test("compares forced-color boundaries with the adjacent exterior background", () => {
    const target = {
      text: false,
      control: true,
      accessibleOnly: false,
      anchor: false,
      disabled: false,
      color: "rgb(0, 0, 0)",
      background: "rgb(255, 255, 255)",
      borderColor: "rgb(0, 0, 0)",
      borderWidth: 1,
      outlineColor: "rgb(0, 0, 0)",
      outlineStyle: "none",
      outlineWidth: 0,
      boxShadow: "none",
      textDecorationLine: "none",
      effectiveOpacity: 1,
      focusable: false,
      focused: false,
      focusIndicatorColor: "rgb(0, 0, 0)",
      focusIndicatorWidth: 0,
    } as const;

    expect(
      forcedColorTargetIsDistinguishable({
        ...target,
        exteriorBackground: "rgb(0, 0, 0)",
      }),
    ).toBe(false);
    expect(
      forcedColorTargetIsDistinguishable({
        ...target,
        exteriorBackground: "rgb(255, 255, 255)",
      }),
    ).toBe(true);
  });
});

describe("interaction evidence helpers", () => {
  test("the production schedule filter returns the matching deterministic class", () => {
    const classes = [
      { id: "aerial", starts_at: "2026-08-30T09:00:00.000Z", title: "Aerial Yoga Flow" },
      { id: "pilates", starts_at: "2026-08-30T11:00:00.000Z", title: "Pilates Sculpt" },
    ];

    expect(
      filterScheduleClasses(classes, {
        search: "Aerial",
        dateScope: "all",
        filter: {},
        now: new Date("2026-08-29T00:00:00.000Z"),
      }).map((entry) => entry.id),
    ).toEqual(["aerial"]);
  });

  test("calculates focus-indicator contrast independently of CSS token names", () => {
    expect(contrastRatio("rgb(0, 0, 0)", "rgb(255, 255, 255)")).toBeCloseTo(21, 3);
    expect(contrastRatio("rgba(255, 255, 255, 0.5)", "rgb(0, 0, 0)")).toBeNull();
  });

  test("allows only subpixel horizontal overflow tolerance", () => {
    expect(hasHorizontalOverflow({ scrollWidth: 320.5, clientWidth: 320 })).toBe(false);
    expect(hasHorizontalOverflow({ scrollWidth: 322, clientWidth: 320 })).toBe(true);
  });

  test("rejects incomplete or over-budget representative interaction results", () => {
    expect(
      validateInteractionEvidence({
        scenarioLocales: [],
        surfaceFocus: {},
        representativeFlows: {
          dialog: { status: "pass", latencyMs: 201 },
          scheduleFilter: { status: "pass", latencyMs: 25 },
          tableFilter: { status: "pass", latencyMs: 30 },
        },
        assistiveTechnologyFixtureSemantics: [],
      }).some((error) => error.includes("48 tier-A scenario/locale")),
    ).toBe(true);
    expect(
      validateInteractionEvidence({
        scenarioLocales: [],
        surfaceFocus: {},
        representativeFlows: {
          dialog: { status: "pass", latencyMs: 201 },
          scheduleFilter: { status: "pass", latencyMs: 25 },
          tableFilter: { status: "pass", latencyMs: 30 },
        },
        assistiveTechnologyFixtureSemantics: [],
      }),
    ).toContain("dialog interaction latency 201ms exceeds the 200ms budget");
  });

  test("requires explicit passing focus evidence for every named surface", () => {
    const errors = validateInteractionEvidence({
      scenarioLocales: [],
      surfaceFocus: {
        white: { status: "pass", contrastRatio: 4.5, outlineWidth: 3, source: "fixture" },
        ivory: { status: "pass", contrastRatio: 4.5, outlineWidth: 3, source: "fixture" },
        navy: { status: "pass", contrastRatio: 4.5, outlineWidth: 3, source: "fixture" },
        image: { status: "pass", contrastRatio: 4.5, outlineWidth: 3, source: "product" },
      },
      representativeFlows: {
        dialog: { status: "pass", latencyMs: 20 },
        scheduleFilter: { status: "pass", latencyMs: 20 },
        tableFilter: { status: "pass", latencyMs: 20 },
      },
      assistiveTechnologyFixtureSemantics: [],
    });

    expect(errors).toContain("Missing focus-surface evidence: sand");
  });
});
