import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { mkdirSync } from "node:fs";

import {
  checkStyleContract,
  reducedMotionOverrideAudit,
  type StyleContractIssueCode,
} from "../../tools/ui-audit/check-style-contract";

const projectRoot = resolve(import.meta.dir, "../..");
const fixtureRoots: string[] = [];

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "cc-style-contract-"));
  fixtureRoots.push(root);
  for (const [file, source] of Object.entries(files)) {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source);
  }
  return root;
}

function codes(root: string) {
  return checkStyleContract({ root }).map((issue) => issue.code);
}

function expectViolation(
  code: StyleContractIssueCode,
  cleanFiles: Record<string, string>,
  mutatedFiles: Record<string, string>,
) {
  expect(codes(fixture(cleanFiles))).not.toContain(code);
  expect(codes(fixture(mutatedFiles))).toContain(code);
}

describe("style contract checker", () => {
  test("the scoped reduced-motion rule wins every authored app transition and animation", () => {
    const source = readFileSync(
      join(projectRoot, "src/components/app-marketing/app-marketing.css"),
      "utf8",
    );
    const audit = reducedMotionOverrideAudit(source, ".app-marketing");

    expect(audit.governedDeclarations).toBeGreaterThan(0);
    expect(audit.failures).toEqual([]);

    const unsafe = `.app-marketing .card::before { transition: opacity 1s; }
      @media (prefers-reduced-motion: reduce) {
        .app-marketing *, .app-marketing *::before { transition-duration: 0.01ms; }
      }`;
    expect(reducedMotionOverrideAudit(unsafe, ".app-marketing").failures).not.toEqual([]);

    const safe = `.app-marketing .card::before { transition: opacity 1s; }
      @media (prefers-reduced-motion: reduce) {
        .app-marketing.app-marketing *::before { transition-duration: 0.01ms; }
      }`;
    expect(reducedMotionOverrideAudit(safe, ".app-marketing").failures).toEqual([]);
  });

  test("detects hardcoded colors in component code while allowing tokens and image gradients", () => {
    expectViolation(
      "hardcoded-color",
      {
        "src/styles/tokens.css": ":root { --cc-card-ink: #0b1d3a; }",
        "src/styles/public.css":
          '.hero-image { background-image: linear-gradient(#0008, #0000), url("/hero.webp"); }',
        "src/components/Card.tsx":
          'export const Card = () => <div className="text-[var(--cc-card-ink)]" />;',
      },
      {
        "src/styles/tokens.css": ":root { --cc-card-ink: #0b1d3a; }",
        "src/components/Card.tsx": 'export const Card = () => <div className="text-[#0b1d3a]" />;',
      },
    );

    expectViolation(
      "hardcoded-color",
      {
        "src/styles/tokens.css": ":root { --cc-card-ink: #0b1d3a; }",
        "src/styles/public.css":
          '.hero-image { background-image: linear-gradient(#0008, #0000), url("/hero.webp"); }',
      },
      {
        "src/styles/tokens.css": ":root { --cc-card-ink: #0b1d3a; }",
        "src/styles/public.css": ".card-copy { color: rgb(11 29 58); }",
      },
    );

    expect(
      codes(
        fixture({
          "src/components/Print.tsx":
            "export const Print = () => <style>{`.paper { color: #123456; }`}</style>;",
        }),
      ),
    ).toContain("hardcoded-color");
  });

  test("parses presentation values without treating comments or unrelated strings as CSS", () => {
    expectViolation(
      "hardcoded-color",
      {
        "src/styles/tokens.css": ":root { --cc-card-ink: #0b1d3a; }",
        "src/styles/base.css": "/* #fff and OKLCH(50% 0.2 20) are documentation examples. */",
        "src/components/Card.tsx":
          'const checksum = "#0B1D3A"; export const Card = () => <div data-checksum={checksum} />;',
      },
      {
        "src/styles/tokens.css": ":root { --cc-card-ink: #0b1d3a; }",
        "src/styles/base.css":
          ".card { color: RGB(11 29 58 / 90%); border-color: OkLcH(58% 0.12 80); }",
      },
    );

    const componentRoot = fixture({
      "src/components/Card.tsx":
        'const enabled = true; const toneClass = "shadow-[0_1px_2px_rgba(11,29,58,.4)]"; export const Card = () => <p className={clsx(["body-copy", enabled && "text-[#0B1D3ACC]"].filter(Boolean).join(" "), `bg-[${enabled ? "hSlA(40 50% 50% / .4)" : "transparent"}] ${toneClass}`)} style={{ borderColor: "COLOR(display-p3 0.1 0.2 0.3)" }}><svg><path fill="#ABCDEF" /></svg></p>;',
    });
    expect(
      codes(componentRoot).filter((code) => code === "hardcoded-color").length,
    ).toBeGreaterThan(0);

    expectViolation(
      "hardcoded-color",
      {
        "src/components/Backdrop.tsx":
          'export const Backdrop = ({ overlay = "linear-gradient(var(--cc-overlay-start), var(--cc-overlay-end))" }) => <div style={{ background: overlay }} />;',
      },
      {
        "src/components/Backdrop.tsx":
          'const panel = { backgroundColor: "OKLCH(50% .2 20)" }; export const Backdrop = ({ overlay = "linear-gradient(rgba(250,247,242,.85), rgba(250,247,242,.95))" }) => <div style={{ ...panel, background: overlay }} />;',
      },
    );

    expectViolation(
      "hardcoded-color",
      {
        "src/lib/email.ts":
          'const tone = "safe"; const html = /* style-contract-allow-color: email HTML cannot resolve app CSS custom properties. */ `<div style="color:#123456">${tone}</div>`;',
      },
      {
        "src/lib/email.ts":
          'const tone = "unsafe"; const html = `<div style="color:#123456">${tone}</div>`;',
      },
    );
  });

  test("follows helper returns into inline presentation values", () => {
    expectViolation(
      "hardcoded-color",
      {
        "src/components/Card.tsx":
          'function fade(tone: string) { return tone === "powder" ? "var(--cc-powder)" : "var(--cc-ivory)"; } export const Card = () => <div style={{ background: `linear-gradient(${fade("powder")}, transparent)` }} />;',
      },
      {
        "src/components/Card.tsx":
          'function fade(tone: string) { return tone === "powder" ? "#B7CCE6" : "var(--cc-ivory)"; } export const Card = () => <div style={{ background: `linear-gradient(${fade("powder")}, transparent)` }} />;',
      },
    );
  });

  test("parses raw HTML style blocks and keeps approvals expression-local", () => {
    const rawRoot = fixture({
      "src/lib/error.ts":
        'export const html = `<!doctype html><style>.fatal { color: OkLcH(58% .12 80 / .8); }</style><body bgcolor="#ABCDEF"><p style="border-color:RGB(1 2 3 / .5)">Fatal</p></body>`;',
    });
    expect(codes(rawRoot)).toContain("hardcoded-color");

    const approvalRoot = fixture({
      "src/lib/email.ts":
        "function render() { const approved = /* style-contract-allow-color: standalone email cannot resolve application tokens. */ `<style>.approved{color:#123456}</style>`; const sibling = `<style>.sibling{color:#654321}</style>`; return approved + sibling; } export { render };",
    });
    expect(
      checkStyleContract({ root: approvalRoot }).filter(
        (issue) => issue.code === "hardcoded-color" && issue.message.includes("#654321"),
      ),
    ).toHaveLength(1);

    expect(
      codes(
        fixture({
          "src/lib/email.ts":
            "/* style-contract-allow-color: this function-level annotation is intentionally too broad. */ function render() { return `<style>.fatal{color:#123456}</style>`; } export { render };",
        }),
      ),
    ).toContain("hardcoded-color");
  });

  test("reconstructs interpolated raw HTML before parsing presentation values", () => {
    const interpolated = fixture({
      "src/lib/email.ts":
        'const hard = enabled ? "#123456" : "var(--cc-safe)"; export const html = `<style>.card { border-color:${hard}; }</style><div style="color:${hard}" bgcolor="${hard}">Copy</div>`;',
    });
    expect(codes(interpolated)).toContain("hardcoded-color");

    expect(
      codes(
        fixture({
          "src/lib/email.ts":
            'const safe = "var(--cc-safe)"; export const html = `<style>.card { color:${safe}; }</style><div style="color:${safe}" bgcolor="transparent">Copy</div>`;',
        }),
      ),
    ).not.toContain("hardcoded-color");

    const completeCrossProduct = fixture({
      "src/lib/email.ts": `
        const a = pick ? "xxxxx" : "<";
        const b = pick ? "xxxxx" : "div";
        const c = pick ? "x" : "#";
        const d = pick ? "x" : "1";
        const e = pick ? "x" : "2";
        const f = pick ? "x" : "3";
        const g = pick ? "x" : "4";
        const h = pick ? "x" : "5";
        const i = pick ? "x" : "6";
        export const html = \`${"${a}"}${"${b}"} style="color:${"${c}"}${"${d}"}${"${e}"}${"${f}"}${"${g}"}${"${h}"}${"${i}"}">Copy</div>\`;
      `,
    });
    expect(codes(completeCrossProduct)).toContain("hardcoded-color");
  });

  test("tracks split raw-HTML presentation attributes without Cartesian expansion", () => {
    for (const source of [
      'const attr = "sty" + "le"; const hard = "#123456"; export const html = `<div ${attr}="color:${hard}">Copy</div>`;',
      'const hard = "#123456"; export const html = "<div " + "sty" + "le=\\"color:" + hard + "\\">Copy</div>";',
    ]) {
      expect(codes(fixture({ "src/lib/email.ts": source }))).toContain("hardcoded-color");
    }

    const unrelated = fixture({
      "src/lib/email.ts":
        'const attr = "data-label"; const hard = "#123456"; export const html = `<div ${attr}="${hard}" style="color:var(--cc-safe)">Copy</div>`;',
    });
    expect(codes(unrelated)).not.toContain("hardcoded-color");

    const branches = Array.from(
      { length: 20 },
      (_, index) => `const branch${index} = pick ? "safe-${index}" : "other-${index}";`,
    ).join("\n");
    const interpolations = Array.from({ length: 20 }, (_, index) => `\${branch${index}}`).join(" ");
    const highBranch = fixture({
      "src/lib/email.ts": `${branches}
        const hard = "#123456";
        export const html = \`<div style="--choices: ${interpolations}; color: \${hard}">Copy</div>\`;`,
    });
    const started = performance.now();
    expect(codes(highBranch)).toContain("hardcoded-color");
    expect(performance.now() - started).toBeLessThan(500);

    const optionalHexBranches = Array.from(
      { length: 20 },
      (_, index) => `const digit${index} = pick ? "a" : "";`,
    ).join("\n");
    const optionalDigits = Array.from({ length: 20 }, (_, index) => `\${digit${index}}`).join("");
    const highEntropyHex = fixture({
      "src/lib/email.ts": `${optionalHexBranches}
        export const html = \`<div style="color:#${optionalDigits}">Copy</div>\`;`,
    });
    const hexStarted = performance.now();
    expect(codes(highEntropyHex)).toContain("hardcoded-color");
    expect(performance.now() - hexStarted).toBeLessThan(500);

    const invalidHexBranches = Array.from(
      { length: 20 },
      (_, index) => `const pair${index} = pick ? "a" : "b";`,
    ).join("\n");
    const invalidDigits = Array.from({ length: 20 }, (_, index) => `\${pair${index}}`).join("");
    const invalidHighEntropyHex = fixture({
      "src/lib/email.ts": `${invalidHexBranches}
        export const html = \`<div style="color:#${invalidDigits}">Copy</div>\`;`,
    });
    const invalidHexStarted = performance.now();
    expect(codes(invalidHighEntropyHex)).not.toContain("hardcoded-color");
    expect(performance.now() - invalidHexStarted).toBeLessThan(500);
  });

  test("collects statically composed array-join raw HTML roots", () => {
    const joined = fixture({
      "src/lib/email.ts": `const attr = "style";
        const hard = "#123456";
        export const html = ["<div ", attr, '="color:', hard, '">Copy</div>'].join("");`,
    });
    expect(codes(joined)).toContain("hardcoded-color");

    for (const source of [
      `const parts = ["<div ", "style", '="color:#123456">'] as const;
        export const html = parts.join("");`,
      `const base = ["<div ", "style", '="color:', "#123456", '">'];
        const parts = base;
        export const html = parts.filter(Boolean).join("");`,
    ]) {
      expect(codes(fixture({ "src/lib/email.ts": source }))).toContain("hardcoded-color");
    }

    expect(
      codes(
        fixture({
          "src/lib/email.ts": `const parts = ["<div ", "style", '="color:var(--cc-safe)">'];
            export const html = parts.join("");`,
        }),
      ),
    ).not.toContain("hardcoded-color");

    const reassigned = fixture({
      "src/lib/email.ts": `let parts = ["<div ", "style", '="color:var(--cc-safe)">'];
        parts = ["<div ", "style", '="color:#123456">'];
        export const html = parts.join("");`,
    });
    expect(codes(reassigned)).toContain("hardcoded-color");

    const assignmentAfterUse = fixture({
      "src/lib/email.ts": `let parts = ["<div ", "style", '="color:var(--cc-safe)">'];
        export const html = parts.join("");
        parts = ["<div ", "style", '="color:#123456">'];`,
    });
    expect(codes(assignmentAfterUse)).not.toContain("hardcoded-color");

    const shadowedAlias = fixture({
      "src/lib/email.ts": `const parts = ["<div ", "style", '="color:#123456">'];
        export function render() {
          const parts = ["<div ", "style", '="color:var(--cc-safe)">'];
          return parts.join("");
        }`,
    });
    expect(codes(shadowedAlias)).not.toContain("hardcoded-color");

    const capturedReassignment = fixture({
      "src/lib/email.ts": `let parts = ["<div ", "style", '="color:var(--cc-safe)">'];
        function render() { return parts.join(""); }
        parts = ["<div ", "style", '="color:#123456">'];
        export const html = render();`,
    });
    expect(codes(capturedReassignment)).toContain("hardcoded-color");

    for (const joinedExpression of ['alias.join("")', '[...parts].join("")']) {
      const aliasDeclaration = joinedExpression.startsWith("alias") ? "const alias = parts;" : "";
      const capturedComposition = fixture({
        "src/lib/email.ts": `let parts = ["<div ", "style", '="color:var(--cc-safe)">'];
          function render() { ${aliasDeclaration} return ${joinedExpression}; }
          parts = ["<div ", "style", '="color:#123456">'];
          export const html = render();`,
      });
      expect(codes(capturedComposition)).toContain("hardcoded-color");
    }

    for (const mutation of [
      `parts.push("#123456", '">Copy</div>');`,
      `parts.unshift("<div ", "style", '="color:#123456">');`,
      `parts[2] = '="color:#123456">Copy</div>';`,
    ]) {
      const initial = mutation.includes("unshift")
        ? `["Copy</div>"]`
        : `["<div ", "style", '="color:var(--cc-safe)">Copy</div>']`;
      const pushedInitial = mutation.includes("push") ? `["<div ", "style", '="color:']` : initial;
      const capturedMutation = fixture({
        "src/lib/email.ts": `const parts = ${pushedInitial};
          function render() { return parts.join(""); }
          ${mutation}
          export const html = render();`,
      });
      expect(codes(capturedMutation)).toContain("hardcoded-color");
    }

    const mutationAfterCall = fixture({
      "src/lib/email.ts": `const parts = ["<div ", "style", '="color:var(--cc-safe)">Copy</div>'];
        function render() { return parts.join(""); }
        export const html = render();
        parts[2] = '="color:#123456">Copy</div>';`,
    });
    expect(codes(mutationAfterCall)).not.toContain("hardcoded-color");

    for (const [mutationTarget, joinTarget] of [
      ["alias", "parts"],
      ["parts", "alias"],
    ] as const) {
      const sharedMutation = fixture({
        "src/lib/email.ts": `const parts = ["<div ", "style", '="color:'];
          const alias = parts;
          ${mutationTarget}.push("#123456", '">Copy</div>');
          export const html = ${joinTarget}.join("");`,
      });
      expect(codes(sharedMutation)).toContain("hardcoded-color");

      const capturedSharedMutation = fixture({
        "src/lib/email.ts": `const parts = ["<div ", "style", '="color:'];
          const alias = parts;
          function render() { return ${joinTarget}.join(""); }
          ${mutationTarget}.push("#123456", '">Copy</div>');
          export const html = render();`,
      });
      expect(codes(capturedSharedMutation)).toContain("hardcoded-color");
    }

    const replacedBeforeCall = fixture({
      "src/lib/email.ts": `let parts = ["<div ", "style", '="color:#123456">Copy</div>'];
        function render() { return parts.join(""); }
        parts = ["<div ", "style", '="color:var(--cc-safe)">Copy</div>'];
        export const html = render();`,
    });
    expect(codes(replacedBeforeCall)).not.toContain("hardcoded-color");

    const aliasKeepsOriginalArray = fixture({
      "src/lib/email.ts": `let parts = ["<div ", "style", '="color:var(--cc-safe)">Copy</div>'];
        const alias = parts;
        parts = ["<div ", "style", '="color:#123456">Copy</div>'];
        export const html = alias.join("");`,
    });
    expect(codes(aliasKeepsOriginalArray)).not.toContain("hardcoded-color");
  });

  test("evaluates captured array mutations in semantic call order", () => {
    const nestedHoistedMutation = fixture({
      "src/lib/email.ts": `const parts = ["<div ", "style", '="color:'];
        export const html = make();
        function make() {
          mutate();
          return render();
        }
        function mutate() { parts.push("#123456", '">Copy</div>'); }
        function render() { return parts.join(""); }`,
    });
    expect(codes(nestedHoistedMutation)).toContain("hardcoded-color");

    const nestedMutationAfterRender = fixture({
      "src/lib/email.ts": `const parts = ["<div ", "style", '="color:'];
        export const html = make();
        function make() {
          const html = render();
          mutate();
          return html;
        }
        function mutate() { parts.push("#123456", '">Copy</div>'); }
        function render() { return parts.join(""); }`,
    });
    expect(codes(nestedMutationAfterRender)).not.toContain("hardcoded-color");

    const returnedEarlierNestedRender = fixture({
      "src/lib/email.ts": `const parts = ["<div ", "style", '="color:'];
        export const html = make();
        function make() {
          const before = render();
          mutate();
          render();
          return before;
        }
        function mutate() { parts.push("#123456", '">Copy</div>'); }
        function render() { return parts.join(""); }`,
    });
    expect(codes(returnedEarlierNestedRender)).not.toContain("hardcoded-color");

    const localAliasMutation = fixture({
      "src/lib/email.ts": `const parts = ["<div ", "style", '="color:'];
        function render() {
          const alias = parts;
          alias.push("#123456", '">Copy</div>');
          return parts.join("");
        }
        export const html = render();`,
    });
    expect(codes(localAliasMutation)).toContain("hardcoded-color");

    const spreadAfterAliasMutation = fixture({
      "src/lib/email.ts": `const parts = ["<div ", "style", '="color:'];
        function render() {
          const alias = parts;
          alias.push("#123456", '">Copy</div>');
          return [...parts].join("");
        }
        export const html = render();`,
    });
    expect(codes(spreadAfterAliasMutation)).toContain("hardcoded-color");

    const staticIdentifierIndex = fixture({
      "src/lib/email.ts": `const parts = ["<div ", "style", '="color:var(--cc-safe)">Copy</div>'];
        const index = 2;
        parts[index] = '="color:#123456">Copy</div>';
        export const html = parts.join("");`,
    });
    expect(codes(staticIdentifierIndex)).toContain("hardcoded-color");

    const reassignedIndexAtCall = fixture({
      "src/lib/email.ts": `const parts = ["<div ", "style", '="color:var(--cc-safe)">Copy</div>'];
        let index = 0;
        function mutate() { parts[index] = '="color:#123456">Copy</div>'; }
        index = 2;
        mutate();
        export const html = parts.join("");`,
    });
    expect(codes(reassignedIndexAtCall)).toContain("hardcoded-color");

    const indexMovedAwayBeforeCall = fixture({
      "src/lib/email.ts": `const parts = ["<div ", "style", '="color:var(--cc-safe)">Copy</div>'];
        let index = 2;
        function mutate() { parts[index] = '="color:#123456">Copy</div>'; }
        index = 0;
        mutate();
        export const html = parts.join("");`,
    });
    expect(codes(indexMovedAwayBeforeCall)).not.toContain("hardcoded-color");

    const indexCapturesEarlierValue = fixture({
      "src/lib/email.ts": `const parts = ["<div ", "style", '="color:var(--cc-safe)">Copy</div>'];
        let sourceIndex = 0;
        const index = sourceIndex;
        function mutate() { parts[index] = '="color:#123456">Copy</div>'; }
        sourceIndex = 2;
        mutate();
        export const html = parts.join("");`,
    });
    expect(codes(indexCapturesEarlierValue)).not.toContain("hardcoded-color");

    const indexKeepsDangerousCapturedValue = fixture({
      "src/lib/email.ts": `const parts = ["<div ", "style", '="color:var(--cc-safe)">Copy</div>'];
        let sourceIndex = 2;
        const index = sourceIndex;
        function mutate() { parts[index] = '="color:#123456">Copy</div>'; }
        sourceIndex = 0;
        mutate();
        export const html = parts.join("");`,
    });
    expect(codes(indexKeepsDangerousCapturedValue)).toContain("hardcoded-color");

    const hoistedMutation = fixture({
      "src/lib/email.ts": `const parts = ["<div ", "style", '="color:'];
        function render() { return parts.join(""); }
        mutate();
        export const html = render();
        function mutate() { parts.push("#123456", '">Copy</div>'); }`,
    });
    expect(codes(hoistedMutation)).toContain("hardcoded-color");

    const mutationAfterJoin = fixture({
      "src/lib/email.ts": `const parts = ["<div ", "style", '="color:'];
        function render() { return parts.join(""); }
        export const html = render();
        mutate();
        function mutate() { parts.push("#123456", '">Copy</div>'); }`,
    });
    expect(codes(mutationAfterJoin)).not.toContain("hardcoded-color");

    const mutationAfterLocalJoin = fixture({
      "src/lib/email.ts": `const parts = ["<div ", "style", '="color:'];
        function render() {
          const alias = parts;
          const html = parts.join("");
          alias.push("#123456", '">Copy</div>');
          return html;
        }
        export const html = render();`,
    });
    expect(codes(mutationAfterLocalJoin)).not.toContain("hardcoded-color");

    const hoistedRenderBeforeMutation = fixture({
      "src/lib/email.ts": `const parts = ["<div ", "style", '="color:'];
        export const html = render();
        mutate();
        function mutate() { parts.push("#123456", '">Copy</div>'); }
        function render() { return parts.join(""); }`,
    });
    expect(codes(hoistedRenderBeforeMutation)).not.toContain("hardcoded-color");
  });

  test("fails closed when bounded semantic replay cannot complete", () => {
    const paddingCalls = Array.from({ length: 256 }, () => "pad();").join("\n");
    const overBudgetMutation = fixture({
      "src/lib/email.ts": `const parts = ["<div ", "style", '="color:'];
        function pad() { parts.push(""); }
        function dangerous() { parts.push("#123456", '">Copy</div>'); }
        function render() { return parts.join(""); }
        ${paddingCalls}
        dangerous();
        export const html = render();`,
    });
    expect(codes(overBudgetMutation)).toContain("hardcoded-color");

    const nestedCalls = Array.from({ length: 513 }, () => "step();").join("\n");
    const overBudgetNestedReplay = fixture({
      "src/lib/email.ts": `const parts = ["<div ", "style", '="color:var(--cc-safe)">Copy</div>'];
        export const html = make();
        function make() {
          ${nestedCalls}
          return render();
        }
        function step() {}
        function render() { return parts.join(""); }`,
    });
    expect(codes(overBudgetNestedReplay)).toContain("hardcoded-color");

    const recursiveReplay = fixture({
      "src/lib/email.ts": `const parts = ["<div ", "style", '="color:var(--cc-safe)">Copy</div>'];
        export const html = make();
        function make() { recurse(); return render(); }
        function recurse() { recurse(); }
        function render() { return parts.join(""); }`,
    });
    expect(codes(recursiveReplay)).toContain("hardcoded-color");

    const depthFunctions = Array.from(
      { length: 18 },
      (_, index) =>
        `function step${index}() { ${index === 17 ? "return;" : `step${index + 1}();`} }`,
    ).join("\n");
    const overDepthReplay = fixture({
      "src/lib/email.ts": `const parts = ["<div ", "style", '="color:var(--cc-safe)">Copy</div>'];
        export const html = make();
        function make() { step0(); return render(); }
        ${depthFunctions}
        function render() { return parts.join(""); }`,
    });
    expect(codes(overDepthReplay)).toContain("hardcoded-color");

    const unrelatedDeepCalls = fixture({
      "src/lib/metrics.ts": `export const value = step0();
        ${depthFunctions}`,
    });
    expect(codes(unrelatedDeepCalls)).not.toContain("hardcoded-color");
  });

  test("does not treat data-style or data-bgcolor as presentation attributes", () => {
    const dataAttributes = fixture({
      "src/lib/email.ts":
        'export const html = `<div data-style="color:#123456" data-bgcolor="#654321" style="color:var(--cc-safe)">Copy</div>`;',
    });
    expect(codes(dataAttributes)).not.toContain("hardcoded-color");
  });

  test("ignores CSS comments inside generated style blocks", () => {
    const commentedColor = fixture({
      "src/lib/email.ts":
        "export const html = `<style>/* .old { color:#123456; background:RGB(1 2 3); } */ .live { color:var(--cc-safe); }</style>`;",
    });
    expect(codes(commentedColor)).not.toContain("hardcoded-color");

    for (const liveStyle of [
      '<style>.x::before { content:"/*"; color:#654321 }</style>',
      '<style>.x::before { content:"\\"/*"; color:rgb(1 2 3) }</style>',
      `<style>.x::before { content:"</style><div style='color:#123456'>Copy</div>`,
      `<style>.x::before { content:"</style ><div style='color:#123456'>Copy</div>`,
      `<style>.x::before { content:"</style/><div style='color:#123456'>Copy</div>`,
      `<style>.x::before { content:"</style data-x><div style='color:#123456'>Copy</div>`,
      `<style>.x::before { content:"</style data-x="ok"><div style='color:#123456'>Copy</div>`,
      `<style>.x::before { content:"</style data-x="ok"="><div style='color:#123456'>Copy</div>`,
      `<style>.x::before { content:"</style data-x="ok"'><div style='color:#123456'>Copy</div>`,
      `<style>.x::before { content:"</style data-x="ok"/="><div style='color:#123456'>Copy</div>`,
      `<style>.x::before { content:"</style/ data-x><div style='color:#123456'>Copy</div>`,
      `<style>.x::before { content:"</style "data><div style='color:#123456'>Copy</div>`,
      `<style>.x::before { content:"</style ="><div style='color:#123456'>Copy</div>`,
      `<style>.x::before { content:"</style '=><div style='color:#123456'>Copy</div>`,
      `<style>.x::before { content:"</style data-x/="><div style='color:#123456'>Copy</div>`,
    ]) {
      expect(
        codes(
          fixture({
            "src/lib/email.ts": `export const html = ${JSON.stringify(liveStyle)};`,
          }),
        ),
      ).toContain("hardcoded-color");
    }

    expect(
      codes(
        fixture({
          "src/lib/email.ts": `export const html = ${JSON.stringify(`<style>.x::before { content:"</stylex data-x><div style='color:#123456'>Copy</div>`)};`,
        }),
      ),
    ).not.toContain("hardcoded-color");

    expect(
      codes(
        fixture({
          "src/lib/email.ts": `export const html = ${JSON.stringify(`<style>.safe { color:var(--cc-safe) }</style data-x="><div style='color:#123456'>Copy</div>`)};`,
        }),
      ),
    ).not.toContain("hardcoded-color");
  });

  test("does not classify non-presentation validation defaults as colors", () => {
    expect(
      codes(
        fixture({
          "src/lib/schema.ts":
            'const schema = z.object({ color_tag: z.string().default("#D4AF6A") }); export { schema };',
        }),
      ),
    ).not.toContain("hardcoded-color");
  });

  test("detects physical directional properties in migrated stylesheets", () => {
    expectViolation(
      "physical-direction",
      { "src/styles/member.css": ".card { margin-inline-start: 1rem; inset-inline-end: 0; }" },
      { "src/styles/member.css": ".card { margin-left: 1rem; right: 0; }" },
    );

    expect(codes(fixture({ "src/styles/public.css": "/* right: 0 !important; */" }))).toEqual([]);
  });

  test("detects decorative gold applied to body copy", () => {
    expectViolation(
      "decorative-gold-body-text",
      {
        "src/components/Card.tsx":
          'export const Card = () => <><p className="text-[var(--cc-text-secondary)]">Copy</p><Sparkles className="text-gold" /></>;',
      },
      {
        "src/components/Card.tsx":
          'export const Card = () => <p className="text-gold">Important instructions</p>;',
      },
    );

    expectViolation(
      "decorative-gold-body-text",
      {
        "src/components/Card.tsx":
          'export const Card = () => <Sparkles className={clsx("text-gold")} />;',
      },
      {
        "src/components/Card.tsx":
          'export const Card = () => <p className={clsx(["body-copy", enabled && "text-gold"].filter(Boolean).join(" "))}>Instructions</p>;',
      },
    );

    expectViolation(
      "decorative-gold-body-text",
      {
        "src/components/Card.tsx":
          'const tone = "muted"; const classFor = (prefix: string, value: string) => `${prefix}-${value}`; export const Card = () => <p className={classFor("text", tone)}>Instructions</p>;',
      },
      {
        "src/components/Card.tsx":
          'const gold = "gold"; const classFor = (prefix: string, value: string) => [prefix, value].filter(Boolean).join("-"); export const Card = () => <p className={classFor("text", gold)}>Instructions</p>;',
      },
    );

    expectViolation(
      "decorative-gold-body-text",
      {
        "src/components/Card.tsx":
          'export const Card = () => <p className={clsx(["body-copy", { "text-muted": enabled }], { quiet: maybe })}>Instructions</p>;',
      },
      {
        "src/components/Card.tsx":
          'export const Card = () => <p className={classnames(["body-copy", { "text-gold": enabled }], { quiet: maybe })}>Instructions</p>;',
      },
    );

    expectViolation(
      "decorative-gold-body-text",
      {
        "src/components/Card.tsx":
          'export const Card = () => <p className={clsx({ group: { "text-muted": enabled } })}>Instructions</p>;',
      },
      {
        "src/components/Card.tsx":
          'export const Card = () => <p className={clsx({ group: { "text-gold": enabled } })}>Instructions</p>;',
      },
    );

    const safeObjectKeys = Array.from(
      { length: 300 },
      (_, index) => `"safe-${index}": enabled`,
    ).join(",");
    const beyondCartesianLimit = fixture({
      "src/components/Card.tsx": `export const Card = () => <p className={clsx({${safeObjectKeys}, "text-gold": enabled})}>Instructions</p>;`,
    });
    expect(codes(beyondCartesianLimit)).toContain("decorative-gold-body-text");

    for (const objectMember of [
      '"text-gold"() { return enabled; }',
      'get "text-gold"() { return enabled; }',
    ]) {
      expect(
        codes(
          fixture({
            "src/components/Card.tsx": `export const Card = () => <p className={classnames({ ${objectMember} })}>Instructions</p>;`,
          }),
        ),
      ).toContain("decorative-gold-body-text");
    }

    const computedPieces = [..."text-gold"]
      .map((character, index) => `const piece${index} = enabled ? "x" : "${character}";`)
      .join("\n");
    const computedKey = [..."text-gold"].map((_, index) => `\${piece${index}}`).join("");
    const beyondComputedCartesianLimit = fixture({
      "src/components/Card.tsx": `${computedPieces}
        export const Card = () => <p className={clsx({ [\`${computedKey}\`]: enabled })}>Instructions</p>;`,
    });
    expect(codes(beyondComputedCartesianLimit)).toContain("decorative-gold-body-text");

    const opacityPieces = [..."text-gold/80"]
      .map((character, index) => `const opacityPiece${index} = enabled ? "x" : "${character}";`)
      .join("\n");
    const opacityKey = [..."text-gold/80"].map((_, index) => `\${opacityPiece${index}}`).join("");
    expect(
      codes(
        fixture({
          "src/components/Card.tsx": `${opacityPieces}
            export const Card = () => <p className={clsx(\`${opacityKey}\`)}>Instructions</p>;`,
        }),
      ),
    ).toContain("decorative-gold-body-text");

    for (const composedClass of [
      `clsx(\`${computedKey}\`)`,
      `classnames(["body-copy", [\`${computedKey}\`]])`,
    ]) {
      expect(
        codes(
          fixture({
            "src/components/Card.tsx": `${computedPieces}
              export const Card = () => <p className={${composedClass}}>Instructions</p>;`,
          }),
        ),
      ).toContain("decorative-gold-body-text");
    }

    const completeTokenBoundary = fixture({
      "src/components/Card.tsx": `const suffix = enabled ? "en" : "fish";
        export const Card = () => <p className={clsx({ [\`text-gold\${suffix}\`]: enabled })}>Instructions</p>;`,
    });
    expect(codes(completeTokenBoundary)).not.toContain("decorative-gold-body-text");

    for (const variantClass of [
      "hover:text-gold",
      "md:hover:text-gold/80",
      "!text-gold",
      "hover:!text-gold",
      "text-gold!",
      "hover:text-gold!",
      "md:hover:!text-gold/80",
      "md:hover:text-gold/80!",
    ]) {
      expect(
        codes(
          fixture({
            "src/components/Card.tsx": `export const Card = () => <p className="${variantClass}">Instructions</p>;`,
          }),
        ),
      ).toContain("decorative-gold-body-text");
    }

    expect(
      codes(
        fixture({
          "src/components/Card.tsx":
            'export const Card = () => <p className={clsx(`hover:text-gold${enabled ? "en" : "fish"}`)}>Instructions</p>;',
        }),
      ),
    ).not.toContain("decorative-gold-body-text");

    for (const safeClass of ["text-golden", "!text-golden", "text-golden!"]) {
      expect(
        codes(
          fixture({
            "src/components/Card.tsx": `export const Card = () => <p className="${safeClass}">Instructions</p>;`,
          }),
        ),
      ).not.toContain("decorative-gold-body-text");
    }
  });

  test("detects a breakpoint recipe copied across route stylesheets", () => {
    expectViolation(
      "duplicate-breakpoint-recipe",
      {
        "src/styles/public.css":
          "@media (max-width: 40rem) { .public-card { padding-inline: 1rem; } }",
        "src/styles/member.css": "@media (max-width: 48rem) { .member-card { gap: 1rem; } }",
      },
      {
        "src/styles/public.css":
          "@media (max-width: 40rem) { .public-card { display: grid; padding-inline: 1rem; } }",
        "src/styles/member.css":
          "@media (max-width: 40rem) { .renamed-member-card { padding-inline: 1rem; display: grid; } }",
      },
    );

    expectViolation(
      "duplicate-breakpoint-recipe",
      {
        "src/styles/public.css":
          "@media (max-width: 40rem) { .public-card { display: grid; padding-inline: 1rem; } }",
        "src/styles/member.css":
          "@media (max-width: 40rem) { .member-card { display: flex; padding-inline: 2rem; } }",
      },
      {
        "src/styles/public.css":
          "@media (max-width: 40rem) { .public-card { display: grid; padding-inline: 1rem; } }",
        "src/styles/member.css":
          "@media (max-width: 40rem) { .renamed { color: var(--cc-ink); display: grid; padding-inline: 1rem; } }",
      },
    );

    expect(
      codes(
        fixture({
          "src/styles/public.css": "@media (max-width: 40rem) { .one { display: grid; } }",
          "src/styles/member.css": "@media (max-width: 40rem) { .two { display: grid; } }",
        }),
      ),
    ).not.toContain("duplicate-breakpoint-recipe");

    expect(
      codes(
        fixture({
          "src/styles/public.css":
            "@media (max-width: 40rem) { .one { display: grid; padding-inline: 1rem; } }",
          "src/styles/member.css":
            "@\\6d edia (max-width: 40rem) { .two { padding-inline: 1rem; display: grid; } }",
        }),
      ),
    ).toContain("duplicate-breakpoint-recipe");

    for (const continuation of ["\n", "\r\n", "\r", "\f"]) {
      const escapedMedia = fixture({
        "src/styles/public.css":
          "@media (max-width: 40rem) { .one { display: grid; padding-inline: 1rem; } }",
        "src/styles/member.css": `/* keep source coordinates */\n@\\6d${continuation}edia (max-width: 40rem) { .two { padding-inline: 1rem; display: grid; } }\n.live { color:#123456; }`,
      });
      const issue = checkStyleContract({ root: escapedMedia }).find(
        (candidate) =>
          candidate.code === "duplicate-breakpoint-recipe" &&
          candidate.file === "src/styles/member.css",
      );
      expect([JSON.stringify(continuation), issue?.line]).toEqual([
        JSON.stringify(continuation),
        2,
      ]);
      const colorIssue = checkStyleContract({ root: escapedMedia }).find(
        (candidate) =>
          candidate.code === "hardcoded-color" && candidate.file === "src/styles/member.css",
      );
      expect([JSON.stringify(continuation), colorIssue?.line]).toEqual([
        JSON.stringify(continuation),
        4,
      ]);
    }
  });

  test("detects important declarations in migrated stylesheets", () => {
    expectViolation(
      "important-declaration",
      { "src/styles/admin.css": ".admin-card { display: grid; }" },
      { "src/styles/admin.css": ".admin-card { display: grid !important; }" },
    );

    expectViolation(
      "important-declaration",
      { "src/styles/base.css": ".shared-card { display: grid; }" },
      { "src/styles/base.css": ".shared-card { display: grid !important; }" },
    );

    const baseline = JSON.stringify({
      version: 1,
      signatures: ["src/styles/base.css |  | .shared-card | display | grid"],
    });
    expectViolation(
      "important-declaration",
      {
        "src/styles/base.css": ".shared-card { display: grid !important; }",
        "tools/ui-audit/style-important-baseline.json": baseline,
      },
      {
        "src/styles/base.css": ".shared-card { display: flex !important; }",
        "tools/ui-audit/style-important-baseline.json": baseline,
      },
    );

    expectViolation(
      "important-declaration",
      { "src/components/card.css": ".card { display: grid; }" },
      { "src/components/card.css": ".card { display: grid !important; }" },
    );
  });

  test("canonicalizes every source import form before enforcing route ownership", () => {
    const ownedProject = (leak: string) => ({
      "src/routes/__root.tsx":
        'import appCss from "../styles/base.css?url"; const head = { links: [{ href: appCss }] }; export { head };',
      "src/components/public/PublicShell.tsx": 'import "@/styles/public.css"; export {};',
      "src/routes/_authenticated/member/route.tsx":
        'import memberCss from "@/styles/member.css?url"; const head = { links: [{ href: memberCss }] }; export { head };',
      "src/routes/_authenticated/admin/route.tsx":
        'import adminCss from "@/styles/admin.css?url"; const head = { links: [{ href: adminCss }] }; export { head };',
      "src/routes/_authenticated/instructor/route.tsx":
        'import instructorCss from "@/styles/instructor.css?url"; const head = { links: [{ href: instructorCss }] }; export { head };',
      "src/styles.css": '@import "./styles/base.css";',
      "src/styles/base.css": "",
      "src/styles/public.css": "",
      "src/styles/member.css": "",
      "src/styles/admin.css": "",
      "src/styles/instructor.css": "",
      "src/components/Leak.tsx": leak,
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
    });

    expect(codes(fixture(ownedProject("export {};")))).not.toContain("route-css-boundary");
    for (const leak of [
      'import("../styles/member.css?url");',
      'require("@/styles/admin.css");',
      'import("../styles/instructor.css?url");',
      'import routeCss from "@/styles/public.css?url"; void routeCss;',
    ]) {
      expect(codes(fixture(ownedProject(leak)))).toContain("route-css-boundary");
    }

    expect(
      codes(
        fixture({
          ...ownedProject("export {};"),
          "src/components/card.css": '@import "../styles/member.css"; .card { display: grid; }',
        }),
      ),
    ).toContain("route-css-boundary");

    for (const routeImport of [
      "@import url(../styles/member.css?url) screen and (min-width: 1px);",
      '@import url("../styles/admin.css") layer(admin);',
      "@import url('../styles/public.css?raw') supports(display: grid);",
      '@IMPORT URL("../styles/member\\2e css?url") screen and (min-width: 1px);',
      "@IMPORT url('../styles/admin.css\\?url') layer(admin);",
      '  @IMPORT "../styles/public\\2E css?raw" supports(display: grid);',
      '@IMPORT u\\72l("../styles/member.css?url") screen;',
      "@IMPORT url(../styles/member\\2e css?url) layer(member);",
      '@import url("../styles/membe\\r.css?url") screen;',
      '@im\\70ort url("../styles/member.css?url") screen;',
      '@IM\\50ORT "../styles/member.css?url" layer(member);',
      '@\\69mport url("../styles/member.css?url") screen;',
      '@\\49MPORT "../styles/admin.css?url" layer(admin);',
    ]) {
      expect(
        codes(
          fixture({
            ...ownedProject("export {};"),
            "src/components/card.css": routeImport,
          }),
        ),
      ).toContain("route-css-boundary");
    }

    for (const continuation of ["\n", "\r\n", "\r"]) {
      expect(
        codes(
          fixture({
            ...ownedProject("export {};"),
            "src/components/card.css": `@im\\${continuation}port url("../styles/member.css?url");`,
          }),
        ),
      ).toContain("route-css-boundary");
    }

    for (const [prefix, continuation, suffix, wrapper] of [
      ["mem", "\n", "ber", "url"],
      ["memb", "\r\n", "er", "quoted"],
      ["m", "\r", "ember", "url"],
    ] as const) {
      const specifier = `../styles/${prefix}\\${continuation}${suffix}.css?url`;
      const routeImport =
        wrapper === "url"
          ? `@import url("${specifier}") layer(member);`
          : `@import "${specifier}" screen;`;
      expect(
        codes(
          fixture({
            ...ownedProject("export {};"),
            "src/components/card.css": routeImport,
          }),
        ),
      ).toContain("route-css-boundary");
    }

    expect(
      codes(
        fixture({
          ...ownedProject("export {};"),
          "src/styles/tokens.css": ":root { --cc-safe: currentColor; }",
          "src/components/card.css":
            '@import url("../styles/tokens.css") layer(tokens); .card { display: grid; }',
        }),
      ),
    ).not.toContain("route-css-boundary");

    expect(
      codes(
        fixture({
          ...ownedProject("export {};"),
          "src/styles/tokens.css": ":root { --cc-safe: currentColor; }",
          "src/components/card.css":
            '@IMPORT URL("../styles/tokens\\2e css") supports(display: grid); @IMPORT url(../styles/tokens\\2e css) screen;',
        }),
      ),
    ).not.toContain("route-css-boundary");

    expect(
      codes(
        fixture({
          ...ownedProject("export {};"),
          "src/components/card.css": '@im\\70orts url("../styles/member.css?url");',
        }),
      ),
    ).not.toContain("route-css-boundary");

    expect(
      codes(
        fixture({
          ...ownedProject("export {};"),
          "src/components/card.css": '@im \\70ort url("../styles/member.css?url");',
        }),
      ),
    ).not.toContain("route-css-boundary");

    for (const malformed of [
      '@\\69mports url("../styles/member.css?url");',
      '@ \\69mport url("../styles/member.css?url");',
      '@\\6amport url("../styles/member.css?url");',
    ]) {
      expect(
        codes(
          fixture({
            ...ownedProject("export {};"),
            "src/components/card.css": malformed,
          }),
        ),
      ).not.toContain("route-css-boundary");
    }

    const malformedWithLiveCss = fixture({
      ...ownedProject("export {};"),
      "src/components/card.css":
        '@ \\69mport url("../styles/member.css?url"); .live { color:#123456; }',
    });
    expect(codes(malformedWithLiveCss)).toContain("hardcoded-color");

    const escapedNewline = fixture({
      ...ownedProject("export {};"),
      "src/components/card.css":
        '@\\69\nmport url("../styles/member.css?url");\n\n.live { color:#123456; }',
    });
    const colorIssue = checkStyleContract({ root: escapedNewline }).find(
      (issue) => issue.file === "src/components/card.css" && issue.code === "hardcoded-color",
    );
    expect(colorIssue?.line).toBe(4);
  });

  test("requires styles.css to remain the exact base-only compatibility import", () => {
    expect(codes(fixture({ "src/styles.css": '@import "./styles/base.css";' }))).toEqual([]);

    for (const source of [
      '@import "./styles/base.css"; @import "./styles/member.css";',
      '@import "./styles/base.css"; .member { display: grid; }',
      '@import "./styles/base.css"; :is(.public-card, .admin-card) { display: grid; }',
    ]) {
      expect(codes(fixture({ "src/styles.css": source }))).toContain("route-css-in-compatibility");
    }
  });

  test("the repository satisfies the executable contract", () => {
    expect(checkStyleContract({ root: projectRoot })).toEqual([]);
  });

  test("real raw-HTML and helper-gradient sources satisfy the contract", () => {
    const issues = checkStyleContract({ root: projectRoot });
    expect(
      issues.filter((issue) =>
        /(?:src\/lib\/error-page\.ts|src\/components\/visual\/VisualClassCard\.tsx)$/.test(
          issue.file,
        ),
      ),
    ).toEqual([]);
  });
});
