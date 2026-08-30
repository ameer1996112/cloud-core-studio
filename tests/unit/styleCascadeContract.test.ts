import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import {
  buildCascadeBaseline,
  buildCascadeParticipantDigests,
  cascadeDeclarationSnapshot,
  cascadeScenarioDigest,
  checkCascadeBaseline,
  checkCascadeEquivalence,
  selectorSpecificity,
} from "../../tools/ui-audit/check-style-contract";

const projectRoot = resolve(import.meta.dir, "../..");
const fixtureRoots: string[] = [];

function checkedInCascadeBaseline() {
  return JSON.parse(
    readFileSync(join(projectRoot, "tools/ui-audit/style-cascade-baseline.json"), "utf8"),
  );
}

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "cc-style-cascade-"));
  fixtureRoots.push(root);
  for (const [file, source] of Object.entries(files)) {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source);
  }
  return root;
}

function projectStyles(styles: {
  base: string;
  public?: string;
  member?: string;
  admin?: string;
  instructor?: string;
}) {
  return {
    "src/routes/__root.tsx":
      'import appCss from "../styles/base.css?url"; const head = { links: [{ href: appCss }] }; export { head };',
    "src/components/public/PublicShell.tsx": 'import "@/styles/public.css"; export {};',
    "src/routes/_authenticated/member/route.tsx":
      'import memberCss from "@/styles/member.css?url"; const head = { links: [{ href: memberCss }] }; export { head };',
    "src/routes/_authenticated/admin/route.tsx":
      'import adminCss from "@/styles/admin.css?url"; const head = { links: [{ href: adminCss }] }; export { head };',
    "src/routes/_authenticated/instructor/route.tsx":
      'import instructorCss from "@/styles/instructor.css?url"; const head = { links: [{ href: instructorCss }] }; export { head };',
    "src/styles/base.css": styles.base,
    "src/styles/public.css": styles.public ?? "",
    "src/styles/member.css": styles.member ?? "",
    "src/styles/admin.css": styles.admin ?? "",
    "src/styles/instructor.css": styles.instructor ?? "",
    "tools/ui-audit/route-style-contract.json": JSON.stringify({
      version: 1,
      compatibilityEntry: { file: "src/styles.css", onlyImport: "./styles/base.css" },
      owners: {
        base: "src/routes/__root.tsx",
        public: "src/components/public/PublicShell.tsx",
        member: "src/routes/_authenticated/member/route.tsx",
        admin: "src/routes/_authenticated/admin/route.tsx",
        instructor: "src/routes/_authenticated/instructor/route.tsx",
      },
      transitionContract:
        "Route stylesheets may remain retained after navigation; selectors remain isolated.",
    }),
  };
}

describe("route stylesheet cascade equivalence", () => {
  test("every conservatively discovered cross-boundary participant matches the checked snapshot", () => {
    expect(checkCascadeEquivalence({ root: projectRoot })).toEqual([]);
  });

  test("the real baseline is a non-vacuous, legacy-derived winner proof", () => {
    const baseline = checkedInCascadeBaseline();
    const immutableResultSha256 =
      "3ad33b7c955dc7823d7b56dbed1badd252c4524dfc639720f0224f8664ac0402";

    expect(baseline.scenarios.length).toBe(302);
    expect(
      baseline.scenarios.filter((scenario: { direction: string }) => scenario.direction === "ltr")
        .length,
    ).toBe(145);
    expect(
      baseline.scenarios.filter((scenario: { direction: string }) => scenario.direction === "rtl")
        .length,
    ).toBe(157);
    expect(baseline.legacyProvenance).toEqual({
      commit: "0292a3a",
      file: "src/styles.css",
      sourceSha256: "42335d9a95dd3a377b1cd1894756a5a328c9b3e312ebd12eaafc2fda36fc30cf",
      resultSha256: immutableResultSha256,
      relevantScenarioCount: baseline.scenarios.length,
      identityAuthorityCommit: "4810a61",
      identityAuthorityFile: "tools/ui-audit/style-cascade-baseline.json",
      identityAuthoritySourceSha256:
        "4db34d593b704fe3f6cd87a6061b45b0b003998105e62c1bd80a7118c08d73c5",
      identitySha256: "589eb1ed14d58d1e4c9ffae7a7152ec5e08031dc9034eba1491b5cdb34099192",
    });
    expect(cascadeScenarioDigest(baseline.scenarios)).toBe(immutableResultSha256);
    expect(baseline.approvedLegacyDifferences).toHaveLength(1);
    expect(baseline.approvedLegacyDifferences[0].direction).toBe("both");
    for (const role of ["public", "member", "admin"] as const) {
      expect(baseline.participantDigests[role].count).toBeGreaterThan(0);
    }
    expect(baseline.participantDigests.instructor).toEqual({
      count: 0,
      sha256: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
    });
  });

  test("includes instructor declarations in participant and equivalence discovery", () => {
    const root = fixture(
      projectStyles({
        base: ".shared-card { color: var(--cc-ink); }",
        instructor: ".shared-card { color: var(--cc-action); }",
      }),
    );
    const baseline = buildCascadeBaseline({
      root,
      legacySource:
        ".shared-card { color: var(--cc-ink); } .shared-card { color: var(--cc-action); }",
    });

    expect(buildCascadeParticipantDigests({ root }).instructor.count).toBeGreaterThan(0);
    expect(baseline.scenarios.some((scenario) => scenario.role === "instructor")).toBe(true);
    expect(checkCascadeBaseline({ root, baseline })).toEqual([]);
  });

  test("rejects a duplicated scenario even when mutable counts and result digests are refreshed", () => {
    const baseline = checkedInCascadeBaseline();
    baseline.scenarios[0] = structuredClone(baseline.scenarios[1]);
    baseline.legacyProvenance.resultSha256 = cascadeScenarioDigest(baseline.scenarios);

    expect(
      checkCascadeBaseline({ root: projectRoot, baseline }).map((issue) => issue.message),
    ).toContain(
      "The complete cascade scenario identity set no longer matches its immutable authority.",
    );
  });

  test("requires immutable provenance for the checked-in authoritative baseline", () => {
    const baseline = checkedInCascadeBaseline();
    delete baseline.legacyProvenance;

    expect(
      checkCascadeBaseline({ root: projectRoot, baseline }).map((issue) => issue.message),
    ).toContain(
      "The checked-in cascade baseline requires immutable legacy and identity provenance.",
    );
  });

  test("authenticates equivalent full commit ids before checking scenario identity", () => {
    const baseline = checkedInCascadeBaseline();
    baseline.scenarios[0] = structuredClone(baseline.scenarios[1]);
    baseline.legacyProvenance.resultSha256 = cascadeScenarioDigest(baseline.scenarios);
    baseline.legacyProvenance.commit = execFileSync("git", ["rev-parse", "0292a3a^{commit}"], {
      cwd: projectRoot,
      encoding: "utf8",
    }).trim();
    baseline.legacyProvenance.identityAuthorityCommit = execFileSync(
      "git",
      ["rev-parse", "4810a61^{commit}"],
      { cwd: projectRoot, encoding: "utf8" },
    ).trim();

    expect(
      checkCascadeBaseline({ root: projectRoot, baseline }).map((issue) => issue.message),
    ).toContain(
      "The complete cascade scenario identity set no longer matches its immutable authority.",
    );
  });

  test("a refreshed current participant digest cannot self-whitelist a legacy winner change", () => {
    const root = fixture(
      projectStyles({
        base: ".card { color: var(--cc-ink); }",
        member: ".card { color: var(--cc-action); }",
      }),
    );
    const scenarios = buildCascadeBaseline({
      root,
      legacySource: ".card { color: var(--cc-ink); } .card { color: var(--cc-action); }",
    }).scenarios;
    const baseline = {
      version: 2 as const,
      scenarios,
      participantDigests: buildCascadeParticipantDigests({ root }),
    };
    expect(checkCascadeBaseline({ root, baseline })).toEqual([]);

    writeFileSync(join(root, "src/styles/member.css"), ".card { color: var(--cc-danger); }");
    baseline.participantDigests = buildCascadeParticipantDigests({ root });
    expect(checkCascadeBaseline({ root, baseline }).map((issue) => issue.code)).toContain(
      "cascade-equivalence",
    );
  });

  test("recomputes legacy winners from the immutable provenance commit", () => {
    const legacy = ".card { color: var(--cc-ink); } .card { color: var(--cc-action); }";
    const root = fixture({
      ...projectStyles({
        base: ".card { color: var(--cc-ink); }",
        member: ".card { color: var(--cc-danger); }",
      }),
      "src/styles.css": legacy,
    });
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Style Contract",
        "-c",
        "user.email=style-contract@example.invalid",
        "commit",
        "-q",
        "-m",
        "legacy",
      ],
      { cwd: root },
    );
    const commit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    const original = buildCascadeBaseline({ root, legacySource: legacy });
    const attackedScenarios = original.scenarios.map((scenario) => ({
      ...scenario,
      expectedValue: "var(--cc-danger)",
      expectedImportant: false,
      expectedSpecificity: [0, 1, 0] as [number, number, number],
    }));
    const attacked = {
      version: 2 as const,
      scenarios: attackedScenarios,
      participantDigests: buildCascadeParticipantDigests({ root }),
      legacyProvenance: {
        commit,
        file: "src/styles.css",
        sourceSha256: createHash("sha256").update(legacy).digest("hex"),
        resultSha256: cascadeScenarioDigest(attackedScenarios),
        relevantScenarioCount: attackedScenarios.length,
      },
    };

    expect(checkCascadeBaseline({ root, baseline: attacked }).map((issue) => issue.code)).toContain(
      "cascade-equivalence",
    );
  });

  test("a route value change or source-order reversal fails the independent snapshot", () => {
    const root = fixture(
      projectStyles({
        base: ".member-card { width: 10rem; }",
        member: ".member-shell .member-card { width: 20rem; }",
      }),
    );
    const baseline = buildCascadeBaseline({
      root,
      legacySource: ".member-card { width: 10rem; } .member-shell .member-card { width: 20rem; }",
    });
    expect(checkCascadeBaseline({ root, baseline })).toEqual([]);

    writeFileSync(join(root, "src/styles/member.css"), ".member-card { width: 5rem; }");
    expect(checkCascadeBaseline({ root, baseline }).map((issue) => issue.code)).toContain(
      "cascade-equivalence",
    );
  });

  test("uses standards-aware specificity for functional pseudos and selector syntax", () => {
    expect(
      selectorSpecificity(
        ":where(#ignored) article:is(.choice, #chosen):not(.nope, [data-x])::before",
      ),
    ).toEqual([1, 1, 2]);
    expect(selectorSpecificity(".card:has(.child, #focus .deep) > button[data-action]")).toEqual([
      1, 3, 1,
    ]);
    expect(selectorSpecificity("&[data-state='open']::selection")).toEqual([0, 1, 1]);
  });

  test("CSS nesting gives every parent-list branch the maximum parent specificity", () => {
    const root = fixture(
      projectStyles({
        base: ".low, #high { .target { color: var(--cc-ink); } }",
        member: ".route-target { color: var(--cc-action); }",
      }),
    );
    const legacy =
      ".low, #high { .target { color: var(--cc-ink); } } .route-target { color: var(--cc-action); }";
    const baseline = buildCascadeBaseline({ root, legacySource: legacy });
    const nested = baseline.scenarios.filter((scenario) =>
      scenario.baseSelector.includes(".target"),
    );

    expect(nested.length).toBeGreaterThan(0);
    expect(nested.every((scenario) => scenario.expectedSpecificity.join("-") === "1-1-0")).toBe(
      true,
    );
    expect(checkCascadeBaseline({ root, baseline })).toEqual([]);

    writeFileSync(join(root, "src/styles/base.css"), ".low { .target { color: var(--cc-ink); } }");
    expect(checkCascadeBaseline({ root, baseline }).map((issue) => issue.code)).toContain(
      "cascade-equivalence",
    );
  });

  test("discovers element-to-class overlaps without a shared terminal anchor", () => {
    const root = fixture(
      projectStyles({
        base: "button { color: var(--cc-ink); }",
        member: ".cta { color: var(--cc-action); }",
      }),
    );
    const baseline = buildCascadeBaseline({
      root,
      legacySource: "button { color: var(--cc-ink); } .cta { color: var(--cc-action); }",
    });
    expect(
      baseline.scenarios.some(
        (scenario) => scenario.baseSelector === "button" && scenario.routeSelector === ".cta",
      ),
    ).toBe(true);
    expect(checkCascadeBaseline({ root, baseline })).toEqual([]);

    writeFileSync(join(root, "src/styles/member.css"), ".cta { color: var(--cc-danger); }");
    expect(checkCascadeBaseline({ root, baseline }).map((issue) => issue.code)).toContain(
      "cascade-equivalence",
    );
  });

  test("conservatively keeps class-to-class and universal-to-class overlaps", () => {
    const root = fixture(
      projectStyles({
        base: ".base-card, * { color: var(--cc-ink); }",
        member: ".route-card { color: var(--cc-action); }",
      }),
    );
    const baseline = buildCascadeBaseline({
      root,
      legacySource:
        ".base-card, * { color: var(--cc-ink); } .route-card { color: var(--cc-action); }",
    });

    expect(
      baseline.scenarios.some(
        (scenario) =>
          scenario.baseSelector === ".base-card" && scenario.routeSelector === ".route-card",
      ),
    ).toBe(true);
    expect(
      baseline.scenarios.some(
        (scenario) => scenario.baseSelector === "*" && scenario.routeSelector === ".route-card",
      ),
    ).toBe(true);

    const compactBaseline = {
      ...baseline,
      version: 2 as const,
      participantDigests: buildCascadeParticipantDigests({ root }),
    };
    writeFileSync(
      join(root, "src/styles/member.css"),
      ".route-card, .new-route-card { color: var(--cc-action); }",
    );
    expect(
      checkCascadeBaseline({ root, baseline: compactBaseline }).map((issue) => issue.code),
    ).toContain("cascade-equivalence");
  });

  test("compares logical and physical shorthand effects", () => {
    const root = fixture(
      projectStyles({
        base: ".card { padding: 1rem; border-left: 1px solid; }",
        member: ".card { padding-inline: 2rem; border-inline-width: 2px; }",
      }),
    );
    const legacy =
      ".card { padding: 1rem; border-left: 1px solid; } .card { padding-inline: 2rem; border-inline-width: 2px; }";
    const baseline = buildCascadeBaseline({ root, legacySource: legacy });
    expect(baseline.scenarios.some((scenario) => scenario.property === "padding-left")).toBe(true);
    expect(baseline.scenarios.some((scenario) => scenario.property === "border-left-width")).toBe(
      true,
    );
    expect(checkCascadeBaseline({ root, baseline })).toEqual([]);
  });

  test("expands physical and logical shorthands to exact LTR and RTL component values", () => {
    const declarations = cascadeDeclarationSnapshot(`.card {
      padding: 1rem 2rem 3rem 4rem;
      margin-inline: 5rem 6rem;
      inset: 7px 8px 9px 10px;
      inset-inline: 11px 12px;
      border-width: 1px 2px 3px 4px;
      border-inline-width: 5px 6px;
      padding-inline-start: 13rem;
    }`);
    const value = (property: string, direction: "ltr" | "rtl") =>
      declarations.findLast(
        (declaration) =>
          declaration.selector === ".card" &&
          declaration.property === property &&
          declaration.direction === direction,
      )?.value;

    expect(value("padding-top", "ltr")).toBe("1rem");
    expect(value("padding-right", "ltr")).toBe("2rem");
    expect(value("padding-bottom", "ltr")).toBe("3rem");
    expect(value("padding-left", "ltr")).toBe("13rem");
    expect(value("padding-left", "rtl")).toBe("4rem");
    expect(value("padding-right", "rtl")).toBe("13rem");
    expect(value("margin-left", "ltr")).toBe("5rem");
    expect(value("margin-right", "ltr")).toBe("6rem");
    expect(value("margin-left", "rtl")).toBe("6rem");
    expect(value("margin-right", "rtl")).toBe("5rem");
    expect(value("top", "ltr")).toBe("7px");
    expect(value("bottom", "rtl")).toBe("9px");
    expect(value("left", "ltr")).toBe("11px");
    expect(value("right", "ltr")).toBe("12px");
    expect(value("left", "rtl")).toBe("12px");
    expect(value("right", "rtl")).toBe("11px");
    expect(value("border-top-width", "ltr")).toBe("1px");
    expect(value("border-bottom-width", "rtl")).toBe("3px");
    expect(value("border-left-width", "ltr")).toBe("5px");
    expect(value("border-right-width", "ltr")).toBe("6px");
    expect(value("border-left-width", "rtl")).toBe("6px");
    expect(value("border-right-width", "rtl")).toBe("5px");

    const root = fixture(
      projectStyles({
        base: ".card { padding-left: 1rem; padding-right: 2rem; }",
        member: ".card { padding-inline-start: 9rem; }",
      }),
    );
    const baseline = buildCascadeBaseline({
      root,
      legacySource:
        ".card { padding-left: 1rem; padding-right: 2rem; } .card { padding-inline-start: 9rem; }",
    });
    expect(
      baseline.scenarios.some(
        (scenario) =>
          scenario.direction === "ltr" &&
          scenario.property === "padding-left" &&
          scenario.expectedValue === "9rem",
      ),
    ).toBe(true);
    expect(
      baseline.scenarios.some(
        (scenario) =>
          scenario.direction === "rtl" &&
          scenario.property === "padding-right" &&
          scenario.expectedValue === "9rem",
      ),
    ).toBe(true);

    writeFileSync(join(root, "src/styles/member.css"), ".card { padding-inline-end: 9rem; }");
    expect(checkCascadeBaseline({ root, baseline }).map((issue) => issue.code)).toContain(
      "cascade-equivalence",
    );
  });

  test("parses composite border shorthands into exact directional components", () => {
    const declarations = cascadeDeclarationSnapshot(`.card {
      border: 1px solid red;
      border-inline: 2px dashed blue;
      border-block: 3px dotted green;
      border-inline-start: 4px double gold;
      border-block-end: 5px groove purple;
    }
    .physical { border: 1px solid red; }
    .variables { border: var(--w) solid red; }
    .two-variables { border: var(--w) solid var(--c); }
    .variable-style { border: 1px var(--style) red; }
    .variable-width-style { border: var(--w) var(--style) red; }
    .env-side { border-left: 2px env(--style) green; }
    .env-logical { border-inline-end: env(--w) env(--style) blue; }
    .single-var-style { border-inline-start: 1px var(--style); }
    .single-env-width { border-right: env(--w); }
    .style-color { border-left: solid var(--c); }
    .logical-style-color { border-inline-end: dashed env(--c); }
    .exponent { border-inline-start: 1e2px dashed blue; }
    .functional { border-block: min(1px, 2px) solid red; }
    .global { border: inherit; }
    .defaults { border: solid; }`);
    const value = (selector: string, property: string, direction: "ltr" | "rtl") =>
      declarations.findLast(
        (declaration) =>
          declaration.selector === selector &&
          declaration.property === property &&
          declaration.direction === direction,
      )?.value;

    expect(value(".card", "border-top-width", "ltr")).toBe("3px");
    expect(value(".card", "border-top-style", "ltr")).toBe("dotted");
    expect(value(".card", "border-top-color", "ltr")).toBe("green");
    expect(value(".card", "border-bottom-width", "rtl")).toBe("5px");
    expect(value(".card", "border-bottom-style", "rtl")).toBe("groove");
    expect(value(".card", "border-bottom-color", "rtl")).toBe("purple");
    expect(value(".card", "border-left-width", "ltr")).toBe("4px");
    expect(value(".card", "border-left-style", "ltr")).toBe("double");
    expect(value(".card", "border-left-color", "ltr")).toBe("gold");
    expect(value(".card", "border-right-width", "ltr")).toBe("2px");
    expect(value(".card", "border-right-style", "ltr")).toBe("dashed");
    expect(value(".card", "border-right-color", "ltr")).toBe("blue");
    expect(value(".card", "border-left-width", "rtl")).toBe("2px");
    expect(value(".card", "border-right-width", "rtl")).toBe("4px");
    expect(value(".card", "border-right-style", "rtl")).toBe("double");
    expect(value(".card", "border-right-color", "rtl")).toBe("gold");
    expect(value(".physical", "border-left-width", "ltr")).toBe("1px");
    expect(value(".physical", "border-left-style", "ltr")).toBe("solid");
    expect(value(".physical", "border-left-color", "ltr")).toBe("red");
    expect(value(".variables", "border-top-width", "ltr")).toBe("var(--w)");
    expect(value(".variables", "border-top-style", "ltr")).toBe("solid");
    expect(value(".variables", "border-top-color", "ltr")).toBe("red");
    expect(value(".two-variables", "border-top-width", "ltr")).toBe("var(--w)");
    expect(value(".two-variables", "border-top-style", "ltr")).toBe("solid");
    expect(value(".two-variables", "border-top-color", "ltr")).toBe("var(--c)");
    expect(value(".variable-style", "border-top-width", "ltr")).toBe("1px");
    expect(value(".variable-style", "border-top-style", "ltr")).toBe("var(--style)");
    expect(value(".variable-style", "border-top-color", "ltr")).toBe("red");
    expect(value(".variable-width-style", "border-top-width", "ltr")).toBe("var(--w)");
    expect(value(".variable-width-style", "border-top-style", "ltr")).toBe("var(--style)");
    expect(value(".variable-width-style", "border-top-color", "ltr")).toBe("red");
    expect(value(".env-side", "border-left-width", "rtl")).toBe("2px");
    expect(value(".env-side", "border-left-style", "rtl")).toBe("env(--style)");
    expect(value(".env-side", "border-left-color", "rtl")).toBe("green");
    expect(value(".env-logical", "border-right-width", "ltr")).toBe("env(--w)");
    expect(value(".env-logical", "border-right-style", "ltr")).toBe("env(--style)");
    expect(value(".env-logical", "border-right-color", "ltr")).toBe("blue");
    expect(value(".env-logical", "border-left-width", "rtl")).toBe("env(--w)");
    expect(value(".env-logical", "border-left-style", "rtl")).toBe("env(--style)");
    expect(value(".env-logical", "border-left-color", "rtl")).toBe("blue");
    expect(value(".single-var-style", "border-left-width", "ltr")).toBe("1px");
    expect(value(".single-var-style", "border-left-style", "ltr")).toBe("var(--style)");
    expect(value(".single-var-style", "border-left-color", "ltr")).toBe("currentcolor");
    expect(value(".single-var-style", "border-right-width", "rtl")).toBe("1px");
    expect(value(".single-var-style", "border-right-style", "rtl")).toBe("var(--style)");
    expect(value(".single-env-width", "border-right-width", "ltr")).toBe("env(--w)");
    expect(value(".single-env-width", "border-right-style", "ltr")).toBe("none");
    expect(value(".single-env-width", "border-right-color", "ltr")).toBe("currentcolor");
    expect(value(".style-color", "border-left-width", "ltr")).toContain("medium");
    expect(value(".style-color", "border-left-width", "ltr")).toContain("var(--c)");
    expect(value(".style-color", "border-left-style", "ltr")).toBe("solid");
    expect(value(".style-color", "border-left-color", "ltr")).toContain("currentcolor");
    expect(value(".style-color", "border-left-color", "ltr")).toContain("var(--c)");
    expect(value(".logical-style-color", "border-right-width", "ltr")).toContain("medium");
    expect(value(".logical-style-color", "border-right-width", "ltr")).toContain("env(--c)");
    expect(value(".logical-style-color", "border-right-style", "ltr")).toBe("dashed");
    expect(value(".logical-style-color", "border-right-color", "ltr")).toContain("currentcolor");
    expect(value(".logical-style-color", "border-right-color", "ltr")).toContain("env(--c)");
    expect(value(".logical-style-color", "border-left-color", "rtl")).toContain("env(--c)");
    expect(value(".exponent", "border-left-width", "ltr")).toBe("1e2px");
    expect(value(".exponent", "border-right-width", "rtl")).toBe("1e2px");
    expect(value(".functional", "border-top-width", "ltr")).toBe("min(1px, 2px)");
    expect(value(".functional", "border-bottom-width", "rtl")).toBe("min(1px, 2px)");
    expect(value(".global", "border-left-width", "ltr")).toBe("inherit");
    expect(value(".global", "border-left-style", "ltr")).toBe("inherit");
    expect(value(".global", "border-left-color", "ltr")).toBe("inherit");
    expect(value(".defaults", "border-left-width", "ltr")).toBe("medium");
    expect(value(".defaults", "border-left-style", "ltr")).toBe("solid");
    expect(value(".defaults", "border-left-color", "ltr")).toBe("currentcolor");
  });

  test("keeps a lone border variable after an explicit style conservative", () => {
    const root = fixture(
      projectStyles({
        base: ".card { border-left-width: 4px; }",
        member: ".card { border-left: solid var(--w); }",
      }),
    );
    const scenarios = buildCascadeBaseline({
      root,
      legacySource: ".card { border-left-width: 4px; } .card { border-left: solid var(--w); }",
    }).scenarios.filter((scenario) => scenario.property === "border-left-width");
    expect(scenarios.length).toBeGreaterThan(0);
    const baseline = {
      version: 2 as const,
      scenarios,
      participantDigests: buildCascadeParticipantDigests({ root }),
    };
    expect(checkCascadeBaseline({ root, baseline })).toEqual([]);

    writeFileSync(join(root, "src/styles/member.css"), ".card { border-left: solid var(--c); }");
    baseline.participantDigests = buildCascadeParticipantDigests({ root });
    expect(checkCascadeBaseline({ root, baseline }).map((issue) => issue.code)).toContain(
      "cascade-equivalence",
    );
  });

  test("only normalizes a legacy var fallback when the recursively resolved token is equivalent", () => {
    const correctRoot = fixture({
      ...projectStyles({
        base: ".card { color: var(--cc-card-ink); }",
        member: ".member .card { color: var(--cc-card-ink); }",
      }),
      "src/styles/tokens.css": ":root { --cc-ink: #123456; --cc-card-ink: var(--cc-ink); }",
    });
    const correct = buildCascadeBaseline({
      root: correctRoot,
      legacySource:
        ".card { color: var(--cc-card-ink, #123456); } .member .card { color: var(--cc-card-ink, #123456); }",
    });
    expect(checkCascadeBaseline({ root: correctRoot, baseline: correct })).toEqual([]);

    const wrong = buildCascadeBaseline({
      root: correctRoot,
      legacySource:
        ".card { color: var(--cc-card-ink, #654321); } .member .card { color: var(--cc-card-ink, #654321); }",
    });
    expect(
      checkCascadeBaseline({ root: correctRoot, baseline: wrong }).map((issue) => issue.code),
    ).toContain("cascade-equivalence");

    const changedToken = buildCascadeBaseline({
      root: correctRoot,
      legacySource: ".card { color: #654321; } .member .card { color: #654321; }",
    });
    expect(
      checkCascadeBaseline({ root: correctRoot, baseline: changedToken }).map(
        (issue) => issue.code,
      ),
    ).toContain("cascade-equivalence");
  });

  test("validates the source-derived base then route loading contract", () => {
    const root = fixture(
      projectStyles({
        base: ".card { color: var(--cc-ink); }",
        member: ".card { color: var(--cc-action); }",
      }),
    );
    const baseline = buildCascadeBaseline({
      root,
      legacySource: ".card { color: var(--cc-ink); } .card { color: var(--cc-action); }",
    });
    expect(checkCascadeBaseline({ root, baseline })).toEqual([]);

    writeFileSync(join(root, "src/routes/__root.tsx"), "export {};");
    expect(checkCascadeBaseline({ root, baseline }).map((issue) => issue.code)).toContain(
      "cascade-equivalence",
    );
  });
});
