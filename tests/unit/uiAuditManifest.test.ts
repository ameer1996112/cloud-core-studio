import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screenshotFilename } from "../../tools/ui-audit/capture";
import { auditScenarios } from "../../tools/ui-audit/fixtures";
import {
  parseRouteStateMatrix,
  validateFixtureImports,
  validateFixtureSource,
  validateScenarioManifest,
} from "../../tools/ui-audit/validate-manifest";

const projectRoot = join(import.meta.dir, "../..");
const matrix = readFileSync(join(projectRoot, "docs/design/route-state-matrix.md"), "utf8");

function renderVisualScenarios(): Record<string, string> {
  const script = `
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RouterContextProvider, createMemoryHistory, createRootRoute, createRouter } from "@tanstack/react-router";
import { setActiveLang } from "./src/lib/i18n";
import { auditScenarios } from "./tools/ui-audit/fixtures";

const router = createRouter({
  routeTree: createRootRoute(),
  history: createMemoryHistory({ initialEntries: ["/"] }),
});
const rendered = {};
for (const scenario of auditScenarios.filter((item) => item.kind === "visual")) {
  setActiveLang("en");
  rendered[scenario.matrixKey] = renderToStaticMarkup(
    React.createElement(
      RouterContextProvider,
      { router },
      scenario.render({ language: "en" }),
    ),
  );
}
process.stdout.write(JSON.stringify(rendered));
`;
  const result = Bun.spawnSync({
    cmd: [process.execPath, "-e", script],
    cwd: projectRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0)
    throw new Error(new TextDecoder().decode(result.stderr) || "visual scenario render failed");
  return JSON.parse(new TextDecoder().decode(result.stdout)) as Record<string, string>;
}

describe("UI audit scenario manifest", () => {
  test("parses the documented UI route-state cells", () => {
    const entries = parseRouteStateMatrix(matrix);

    expect(entries.length).toBeGreaterThan(300);
    expect(entries.some((entry) => entry.route === "/auth" && entry.state === "default")).toBe(
      true,
    );
    expect(
      entries.some(
        (entry) => entry.route === "/admin/messages" && entry.state === "permission-denied",
      ),
    ).toBe(true);
  });

  test("covers every documented row and applicable state exactly once", () => {
    expect(validateScenarioManifest(parseRouteStateMatrix(matrix), auditScenarios)).toEqual([]);
  });

  test("tier A evidence covers every language and requested viewport", () => {
    const allLanguages = ["ar", "en", "he"];
    const allViewports = ["1024x768", "1440x900", "360x800", "390x844", "430x932", "768x1024"];

    for (const scenario of auditScenarios.filter((item) => item.riskTier === "A")) {
      expect([...scenario.languages].sort(), scenario.scenarioId).toEqual(allLanguages);
      expect([...scenario.viewports].sort(), scenario.scenarioId).toEqual(allViewports);
    }
  });

  test("uses unique deterministic screenshot filenames", () => {
    const filenames = auditScenarios
      .filter((scenario) => scenario.kind === "visual")
      .flatMap((scenario) =>
        scenario.languages.flatMap((language) =>
          scenario.viewports.map((viewport) => screenshotFilename(scenario, language, viewport)),
        ),
      );

    expect(filenames).toHaveLength(288);
    expect(new Set(filenames).size).toBe(filenames.length);
    expect(filenames).toContain("guest-auth-en-390x844-default.png");
    expect(
      filenames.every((filename) =>
        /^[a-z]+-[a-z0-9-]+-(?:he|ar|en)-\d+x\d+-[a-z-]+\.png$/.test(filename),
      ),
    ).toBe(true);
  });

  test("visual evidence names a real exported product presentation", () => {
    const visualScenarios = auditScenarios.filter((scenario) => scenario.kind === "visual");
    expect(visualScenarios).toHaveLength(16);

    for (const scenario of visualScenarios) {
      expect(scenario.evidence.type, scenario.matrixKey).toBe("component");
      if (scenario.evidence.type !== "component") continue;
      expect(scenario.evidence.source.module, scenario.matrixKey).toStartWith("src/");
      expect(scenario.evidence.source.export, scenario.matrixKey).not.toBe("Route");
      expect(scenario.evidence.marker, scenario.matrixKey).toStartWith("[data-product-view=");
      expect(typeof scenario.render, scenario.matrixKey).toBe("function");

      const source = readFileSync(join(projectRoot, scenario.evidence.source.module), "utf8");
      expect(source, scenario.evidence.source.module).toMatch(
        new RegExp(`export (?:function|const) ${scenario.evidence.source.export}\\b`),
      );
    }
  });

  test("non-visual evidence records source or guard behavior and cannot be rendered", () => {
    for (const scenario of auditScenarios.filter((item) => item.kind !== "visual")) {
      expect(scenario.render, scenario.matrixKey).toBeUndefined();
      if (scenario.kind === "static") {
        expect(scenario.evidence.type, scenario.matrixKey).toBe("source");
      } else if (scenario.kind === "redirected") {
        expect(scenario.evidence.type, scenario.matrixKey).toBe("redirect");
        if (scenario.evidence.type === "redirect")
          expect(scenario.evidence.expectation, scenario.matrixKey).not.toBeEmpty();
      } else {
        expect(scenario.evidence.type, scenario.matrixKey).toBe("blocked");
        if (scenario.evidence.type === "blocked")
          expect(scenario.evidence.reason, scenario.matrixKey).toBe(
            "authenticated-fixture-required",
          );
      }
    }
  });

  test("representative journeys point at their actual product exports", () => {
    const expectedSources = new Map([
      ["public|/auth|default", ["src/components/auth/AuthPanel.tsx", "AuthPanel"]],
      [
        "public|/member/schedule|default",
        ["src/components/visual/VisualClassCard.tsx", "VisualClassCard"],
      ],
      [
        "member|Class detail sheet|default",
        ["src/components/member/ClassDetailSheet.tsx", "ClassDetailSheet"],
      ],
      ["public|/checkout|default", ["src/routes/checkout.tsx", "CheckoutPresentation"]],
      [
        "public|/payment-result?status=success|success",
        ["src/components/member/MemberOutcomePanel.tsx", "MemberOutcomePanel"],
      ],
      ["public|/support|default", ["src/routes/support.tsx", "SupportPresentation"]],
      [
        "public|/app|default",
        ["src/components/app-marketing/AppMarketingPage.tsx", "AppMarketingPage"],
      ],
    ]);

    for (const [matrixKey, [module, exported]] of expectedSources) {
      const scenario = auditScenarios.find((candidate) => candidate.matrixKey === matrixKey);
      expect(scenario, matrixKey).toBeDefined();
      expect(scenario!.evidence.source, matrixKey).toEqual({ module, export: exported });
    }
  });

  test("every documented visual state has a route/state-specific product marker", () => {
    const markers = auditScenarios
      .filter((scenario) => scenario.kind === "visual")
      .map((scenario) =>
        scenario.evidence.type === "component" ? scenario.evidence.marker : "invalid",
      );

    expect(new Set(markers).size).toBe(markers.length);
    expect(markers).toContain('[data-product-view="auth-signup-disabled"]');
    expect(markers).toContain('[data-product-view="guest-schedule-empty"]');
    expect(markers).toContain('[data-product-view="payment-failed"]');
  });

  test("every visual adapter renders its declared product marker", () => {
    const rendered = renderVisualScenarios();
    for (const scenario of auditScenarios.filter((item) => item.kind === "visual")) {
      const markup = rendered[scenario.matrixKey];
      const marker =
        scenario.evidence.type === "component"
          ? scenario.evidence.marker.match(/\[data-product-view="([^"]+)"\]/)?.[1]
          : undefined;

      expect(marker, scenario.matrixKey).toBeDefined();
      expect(markup, scenario.matrixKey).toContain(`data-product-view="${marker}"`);
    }
  });

  test("rendered product DOM differentiates auth, schedule, and payment states", () => {
    const rendered = renderVisualScenarios();
    const render = (matrixKey: string) => {
      const scenario = auditScenarios.find((candidate) => candidate.matrixKey === matrixKey);
      expect(scenario?.kind, matrixKey).toBe("visual");
      if (!scenario || scenario.kind !== "visual") throw new Error(matrixKey);
      return rendered[matrixKey];
    };

    const signup = render("public|/auth?mode=signup|default");
    const signupDisabled = render("public|/auth?mode=signup|disabled");
    const schedule = render("public|/member/schedule|default");
    const scheduleEmpty = render("public|/member/schedule|empty");
    const paymentSuccess = render("public|/payment-result?status=success|success");
    const paymentFailed = render("public|/payment-result?status=failed|error");

    expect(signup).toContain('data-product-view="auth-signup-default"');
    expect(signupDisabled).toContain('data-product-view="auth-signup-disabled"');
    expect(signupDisabled).not.toBe(signup);
    expect(schedule).toContain('data-product-view="guest-schedule-default"');
    expect(scheduleEmpty).toContain('data-product-view="guest-schedule-empty"');
    expect(scheduleEmpty).not.toContain("premium-lesson-card--live");
    expect(paymentSuccess).toContain('data-product-view="payment-success"');
    expect(paymentFailed).toContain('data-product-view="payment-failed"');
    expect(paymentFailed).not.toBe(paymentSuccess);
  });

  test("fixture scenario imports cannot reach services or mutation hooks", () => {
    expect(validateFixtureImports(projectRoot)).toEqual([]);
    expect(
      validateFixtureSource(
        "unsafe.tsx",
        'import { useMutation } from "../../src/routes/account.functions";',
      ),
    ).toEqual([
      "unsafe.tsx: forbidden .functions import",
      "unsafe.tsx: forbidden mutation hook import",
    ]);
    expect(
      validateFixtureSource("unsafe.tsx", 'import { client } from "../../src/lib/supabase";'),
    ).toEqual(["unsafe.tsx: forbidden Supabase import"]);
    expect(
      validateFixtureSource(
        "unsafe.tsx",
        'import { useBookingMutation } from "../../src/hooks/bookings";',
      ),
    ).toEqual(["unsafe.tsx: forbidden mutation hook import"]);
  });
});
