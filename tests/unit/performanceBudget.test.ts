import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";

import {
  analyzeBundle,
  importClosure,
  type ViteManifest,
} from "../../tools/ui-audit/bundle-budget";
import {
  buildClientModuleMetadata,
  normalizeViteModuleId,
} from "../../tools/ui-audit/client-module-metadata";
import {
  assertIntendedAuditDom,
  assertLighthouseBudgets,
  auditedDomFromLighthouse,
  lighthouseCases,
  routeDomExpectation,
  settleCleanupTasks,
  stopProcess,
  type LighthouseMeasurement,
} from "../../tools/ui-audit/lighthouse";

const projectRoot = join(import.meta.dir, "../..");
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function makeBundleFixture() {
  const root = mkdtempSync(join(tmpdir(), "cloud-core-budget-"));
  temporaryDirectories.push(root);
  const client = join(root, "dist/client");
  const manifestDirectory = join(client, ".vite");
  const metadataDirectory = join(root, "dist/audit");
  Bun.spawnSync({
    cmd: ["mkdir", "-p", manifestDirectory, metadataDirectory, join(client, "assets")],
  });
  writeFileSync(join(client, "assets/public.js"), "export const publicValue = 'public';\n");
  writeFileSync(join(client, "assets/shared.js"), "export const sharedValue = 'shared';\n");
  writeFileSync(join(client, "assets/admin.js"), "export const adminValue = 'admin';\n");
  writeFileSync(join(client, "assets/public.css"), "body{color:#123456}\n");
  writeFileSync(join(client, "assets/admin.css"), ".admin-only{display:grid}\n");
  writeFileSync(join(client, "assets/font.woff2"), Buffer.alloc(24, 7));

  const manifest: ViteManifest = {
    "src/routes/index.tsx": {
      file: "assets/public.js",
      src: "src/routes/index.tsx",
      isDynamicEntry: true,
      imports: ["_shared.js"],
      dynamicImports: ["src/routes/_authenticated/admin/reports.tsx"],
      css: ["assets/public.css"],
      assets: ["assets/font.woff2"],
    },
    "_shared.js": { file: "assets/shared.js" },
    "src/routes/_authenticated/admin/reports.tsx": {
      file: "assets/admin.js",
      src: "src/routes/_authenticated/admin/reports.tsx",
      isDynamicEntry: true,
    },
    "src/styles/base.css": {
      file: "assets/public.css",
      src: "src/styles/base.css",
    },
    "src/styles/admin.css": {
      file: "assets/admin.css",
      src: "src/styles/admin.css",
    },
  };
  writeFileSync(join(manifestDirectory, "manifest.json"), JSON.stringify(manifest));
  writeFileSync(
    join(metadataDirectory, "client-modules.json"),
    JSON.stringify({
      schemaVersion: 1,
      chunks: {
        "assets/public.js": [
          { id: "src/routes/index.tsx", renderedBytes: 20, renderedExports: ["Route"] },
        ],
        "assets/shared.js": [
          { id: "src/lib/shared.ts", renderedBytes: 20, renderedExports: ["sharedValue"] },
        ],
        "assets/admin.js": [
          {
            id: "src/routes/_authenticated/admin/reports.tsx",
            renderedBytes: 20,
            renderedExports: ["ReportPage"],
          },
        ],
      },
    }),
  );
  return { root, manifest };
}

function fixtureBudget(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    buildDirectory: "dist/client",
    manifestPath: "dist/client/.vite/manifest.json",
    moduleMetadataPath: "dist/audit/client-modules.json",
    publicEntries: ["src/routes/index.tsx"],
    publicStyles: ["src/styles/base.css"],
    forbiddenPublicImports: ["src/routes/_authenticated/admin/", "src/lib/i18n/catalogs/admin.ts"],
    roleCssMarkers: [{ ownerStyle: "src/styles/admin.css", marker: ".admin-only" }],
    limits: {
      publicJavaScript: { rawBytes: 1000, gzipBytes: 999 },
      publicCss: { rawBytes: 1000, gzipBytes: 999 },
      rootCss: { rawBytes: 1000, gzipBytes: 999 },
      routeChunk: { rawBytes: 1000, gzipBytes: 999 },
      totalFonts: { rawBytes: 1000, gzipBytes: 999 },
    },
    ...overrides,
  };
}

describe("production performance budgets", () => {
  test("public import closure follows static imports but excludes lazy role routes", () => {
    const { manifest } = makeBundleFixture();

    expect(importClosure(manifest, "src/routes/index.tsx")).toEqual([
      "_shared.js",
      "src/routes/index.tsx",
    ]);
  });

  test("manifest lookup fails closed for missing and ambiguous source entries", () => {
    const { manifest } = makeBundleFixture();
    expect(() => importClosure(manifest, "src/routes/auth.tsx")).toThrow("missing");

    manifest["duplicate-index"] = {
      file: "assets/public.js",
      src: "src/routes/index.tsx",
    };
    expect(() => importClosure(manifest, "src/routes/index.tsx")).toThrow("ambiguous");
  });

  test("bundle analysis records deterministic raw and gzip evidence", () => {
    const { root } = makeBundleFixture();
    const budgetPath = join(root, "budget.json");
    writeFileSync(budgetPath, JSON.stringify(fixtureBudget()));

    const first = analyzeBundle({ projectRoot: root, budgetPath });
    const second = analyzeBundle({ projectRoot: root, budgetPath });

    expect(first).toEqual(second);
    expect(first.violations).toEqual([]);
    expect(first.metrics.publicJavaScript.rawBytes).toBe(74);
    expect(first.metrics.publicJavaScript.gzipBytes).toBeGreaterThan(0);
    expect(first.metrics.publicCss.rawBytes).toBe(20);
    expect(first.metrics.rootCss.rawBytes).toBe(20);
    expect(first.metrics.totalFonts.rawBytes).toBe(24);
    expect(first.publicImports).not.toContain("src/routes/_authenticated/admin/reports.tsx");
    expect(first.publicModules).toEqual(["src/lib/shared.ts", "src/routes/index.tsx"]);
  });

  test("configured thresholds cover every required bundle class", () => {
    const budget = JSON.parse(
      readFileSync(join(projectRoot, "tools/ui-audit/performance-budget.json"), "utf8"),
    );
    expect(Object.keys(budget.limits).sort()).toEqual([
      "publicCss",
      "publicJavaScript",
      "rootCss",
      "routeChunk",
      "totalFonts",
    ]);
    for (const limit of Object.values(budget.limits) as Array<Record<string, number>>) {
      expect(limit.rawBytes).toBeGreaterThan(0);
      expect(limit.gzipBytes).toBeGreaterThan(0);
      expect(limit.gzipBytes).toBeLessThan(limit.rawBytes);
    }
    expect(budget.roleCssMarkers.map(({ marker }: { marker: string }) => marker)).toEqual(
      expect.arrayContaining([
        ".md\\:grid-cols-\\[minmax\\(0\\,1fr\\)_280px\\]",
        ".xl\\:grid-cols-\\[minmax\\(0\\,1\\.05fr\\)_minmax\\(360px\\,0\\.95fr\\)\\]",
        ".max-w-\\[8rem\\]",
      ]),
    );
    expect(
      new Set(budget.roleCssMarkers.map(({ ownerStyle }: { ownerStyle: string }) => ownerStyle)),
    ).toEqual(
      new Set(["src/styles/member.css", "src/styles/instructor.css", "src/styles/admin.css"]),
    );
  });

  test("bundle analysis rejects role-only utility markers in the public CSS closure", () => {
    const { root } = makeBundleFixture();
    const budgetPath = join(root, "budget.json");
    writeFileSync(join(root, "dist/client/assets/public.css"), ".admin-only{display:grid}\n");
    writeFileSync(budgetPath, JSON.stringify(fixtureBudget()));

    expect(analyzeBundle({ projectRoot: root, budgetPath }).violations).toContain(
      "public CSS closure contains forbidden role marker .admin-only in assets/public.css",
    );
  });

  test("bundle provenance rejects a forbidden module embedded in an anonymous shared chunk", () => {
    const { root } = makeBundleFixture();
    const budgetPath = join(root, "budget.json");
    writeFileSync(budgetPath, JSON.stringify(fixtureBudget()));
    writeFileSync(
      join(root, "dist/audit/client-modules.json"),
      JSON.stringify({
        schemaVersion: 1,
        chunks: {
          "assets/public.js": [
            { id: "src/routes/index.tsx", renderedBytes: 20, renderedExports: ["Route"] },
          ],
          "assets/shared.js": [
            { id: "src/lib/shared.ts", renderedBytes: 20, renderedExports: ["sharedValue"] },
            {
              id: "src/routes/_authenticated/admin/embedded.ts",
              renderedBytes: 20,
              renderedExports: ["secret"],
            },
          ],
          "assets/admin.js": [],
        },
      }),
    );

    expect(analyzeBundle({ projectRoot: root, budgetPath }).violations).toContain(
      "public import closure contains forbidden module src/routes/_authenticated/admin/ via src/routes/_authenticated/admin/embedded.ts in assets/shared.js",
    );
  });

  test("bundle provenance fails closed when a public chunk lacks module metadata", () => {
    const { root } = makeBundleFixture();
    const budgetPath = join(root, "budget.json");
    writeFileSync(budgetPath, JSON.stringify(fixtureBudget()));
    writeFileSync(
      join(root, "dist/audit/client-modules.json"),
      JSON.stringify({
        schemaVersion: 1,
        chunks: {
          "assets/public.js": [
            { id: "src/routes/index.tsx", renderedBytes: 20, renderedExports: ["Route"] },
          ],
        },
      }),
    );

    expect(() => analyzeBundle({ projectRoot: root, budgetPath })).toThrow(
      "module metadata is missing for public chunk assets/shared.js",
    );
  });

  test("records route-registry shells without treating them as role implementation", () => {
    const { root } = makeBundleFixture();
    const budgetPath = join(root, "budget.json");
    writeFileSync(budgetPath, JSON.stringify(fixtureBudget()));
    writeFileSync(
      join(root, "dist/audit/client-modules.json"),
      JSON.stringify({
        schemaVersion: 1,
        chunks: {
          "assets/public.js": [
            { id: "src/routes/index.tsx", renderedBytes: 20, renderedExports: ["Route"] },
          ],
          "assets/shared.js": [
            {
              id: "src/routes/_authenticated/admin/route.tsx",
              renderedBytes: 40,
              renderedExports: ["Route"],
            },
          ],
          "assets/admin.js": [],
        },
      }),
    );

    const analysis = analyzeBundle({ projectRoot: root, budgetPath });
    expect(analysis.violations).toEqual([]);
    expect(analysis.publicRouteShells).toEqual([
      "src/routes/_authenticated/admin/route.tsx",
      "src/routes/index.tsx",
    ]);
  });

  test("never exempts a queried route implementation beside its unsuffixed shell", () => {
    const { root } = makeBundleFixture();
    const budgetPath = join(root, "budget.json");
    writeFileSync(budgetPath, JSON.stringify(fixtureBudget()));
    writeFileSync(
      join(root, "dist/audit/client-modules.json"),
      JSON.stringify({
        schemaVersion: 1,
        chunks: {
          "assets/public.js": [
            { id: "src/routes/index.tsx", renderedBytes: 20, renderedExports: ["Route"] },
          ],
          "assets/shared.js": [
            {
              id: "src\\routes\\_authenticated\\admin\\route.tsx",
              renderedBytes: 20,
              renderedExports: ["Route"],
            },
            {
              id: "src\\routes\\_authenticated\\admin\\route.tsx?tsr-split=component",
              renderedBytes: 40,
              renderedExports: ["component"],
            },
          ],
          "assets/admin.js": [],
        },
      }),
    );

    const analysis = analyzeBundle({ projectRoot: root, budgetPath });
    expect(analysis.publicRouteShells).toContain("src/routes/_authenticated/admin/route.tsx");
    expect(analysis.publicModules).toContain(
      "src/routes/_authenticated/admin/route.tsx?tsr-split=component",
    );
    expect(analysis.violations).toContain(
      "public import closure contains forbidden module src/routes/_authenticated/admin/ via src/routes/_authenticated/admin/route.tsx?tsr-split=component in assets/shared.js",
    );
  });

  test("producer relativizes Windows-root Vite ids before anonymous-chunk enforcement", () => {
    const { root } = makeBundleFixture();
    const budgetPath = join(root, "budget.json");
    writeFileSync(budgetPath, JSON.stringify(fixtureBudget()));
    const splitId = "C:/repo/src/routes/_authenticated/admin/kids.tsx?tsr-split=component#route";
    const metadata = buildClientModuleMetadata("C:\\repo", {
      "assets/public.js": {
        type: "chunk",
        modules: {
          "C:/repo/src/routes/index.tsx": {
            renderedLength: 20,
            renderedExports: ["Route"],
          },
        },
      },
      "assets/shared.js": {
        type: "chunk",
        modules: {
          [splitId]: { renderedLength: 40, renderedExports: ["component"] },
        },
      },
      "assets/admin.js": { type: "chunk", modules: {} },
    });
    writeFileSync(join(root, "dist/audit/client-modules.json"), JSON.stringify(metadata));

    expect(metadata.chunks["assets/shared.js"][0].id).toBe(
      "src/routes/_authenticated/admin/kids.tsx?tsr-split=component#route",
    );
    expect(normalizeViteModuleId("C:\\REPO", splitId)).toBe(
      "src/routes/_authenticated/admin/kids.tsx?tsr-split=component#route",
    );
    expect(normalizeViteModuleId("C:\\repo", `D:/repo/src/outside.ts?raw`)).toBe(
      "D:/repo/src/outside.ts?raw",
    );
    expect(normalizeViteModuleId("C:\\repo", `C:/repository/src/outside.ts?raw`)).toBe(
      "C:/repository/src/outside.ts?raw",
    );
    expect(analyzeBundle({ projectRoot: root, budgetPath }).violations).toContain(
      "public import closure contains forbidden module src/routes/_authenticated/admin/ via src/routes/_authenticated/admin/kids.tsx?tsr-split=component#route in assets/shared.js",
    );
  });

  test("producer relativizes UNC-root Vite ids without crossing server or share boundaries", () => {
    const { root } = makeBundleFixture();
    const budgetPath = join(root, "budget.json");
    writeFileSync(budgetPath, JSON.stringify(fixtureBudget()));
    const uncRoot = "\\\\SERVER\\Share\\repo";
    const splitId =
      "/server/share/repo/src/routes/_authenticated/admin/kids.tsx?tsr-split=component#route";
    const metadata = buildClientModuleMetadata(uncRoot, {
      "assets/public.js": {
        type: "chunk",
        modules: {
          "/server/share/repo/src/routes/index.tsx": {
            renderedLength: 20,
            renderedExports: ["Route"],
          },
        },
      },
      "assets/shared.js": {
        type: "chunk",
        modules: {
          [splitId]: { renderedLength: 40, renderedExports: ["component"] },
        },
      },
      "assets/admin.js": { type: "chunk", modules: {} },
    });
    writeFileSync(join(root, "dist/audit/client-modules.json"), JSON.stringify(metadata));

    expect(metadata.chunks["assets/shared.js"][0].id).toBe(
      "src/routes/_authenticated/admin/kids.tsx?tsr-split=component#route",
    );
    expect(normalizeViteModuleId(uncRoot, "//server/share/repo/src/inside.ts?raw#x")).toBe(
      "src/inside.ts?raw#x",
    );
    expect(normalizeViteModuleId(uncRoot, "//server/other/repo/src/outside.ts?raw#x")).toBe(
      "//server/other/repo/src/outside.ts?raw#x",
    );
    expect(normalizeViteModuleId(uncRoot, "//other/share/repo/src/outside.ts?raw#x")).toBe(
      "//other/share/repo/src/outside.ts?raw#x",
    );
    expect(normalizeViteModuleId(uncRoot, "//server/share/repository/src/outside.ts?raw#x")).toBe(
      "//server/share/repository/src/outside.ts?raw#x",
    );
    expect(normalizeViteModuleId("/repo", splitId)).toBe(splitId);
    expect(analyzeBundle({ projectRoot: root, budgetPath }).violations).toContain(
      "public import closure contains forbidden module src/routes/_authenticated/admin/ via src/routes/_authenticated/admin/kids.tsx?tsr-split=component#route in assets/shared.js",
    );
  });

  test("mobile Lighthouse matrix covers public home, auth, and schedule in HE, AR, and EN", () => {
    expect(lighthouseCases).toHaveLength(9);
    expect(lighthouseCases.map(({ id }) => id).sort()).toEqual([
      "auth-ar",
      "auth-en",
      "auth-he",
      "home-ar",
      "home-en",
      "home-he",
      "schedule-ar",
      "schedule-en",
      "schedule-he",
    ]);
  });

  test("Lighthouse gates are strict and include axe impact", () => {
    const passing: LighthouseMeasurement = {
      id: "home-he",
      route: "/",
      language: "he",
      lcpMs: 2499,
      cls: 0.099,
      accessibilityScore: 1,
      seriousOrCriticalAxeViolations: 0,
    };
    expect(assertLighthouseBudgets([passing])).toEqual([]);

    expect(
      assertLighthouseBudgets([
        { ...passing, lcpMs: 2500 },
        { ...passing, id: "auth-he", cls: 0.1 },
        { ...passing, id: "schedule-he", accessibilityScore: 0.99 },
        { ...passing, id: "home-ar", seriousOrCriticalAxeViolations: 1 },
      ]),
    ).toHaveLength(4);
  });

  test("route audits fail closed on redirects, missing markers, and the root error boundary", () => {
    const home = lighthouseCases.find(({ id }) => id === "home-he")!;
    const schedule = lighthouseCases.find(({ id }) => id === "schedule-he")!;

    expect(routeDomExpectation(home)).toEqual({
      finalPathname: "/auth",
      selector: "main.auth-page",
    });
    expect(routeDomExpectation(schedule)).toEqual({
      finalPathname: "/member/schedule",
      selector: "main.public-safe-page",
    });
    expect(() =>
      assertIntendedAuditDom(home, {
        finalPathname: "/auth",
        expectedMarkerVisible: true,
        rootErrorBoundaryVisible: false,
        documentLanguage: "he",
        documentDirection: "rtl",
      }),
    ).not.toThrow();
    expect(() =>
      assertIntendedAuditDom(schedule, {
        finalPathname: "/member/schedule",
        expectedMarkerVisible: false,
        rootErrorBoundaryVisible: true,
        documentLanguage: "he",
        documentDirection: "rtl",
      }),
    ).toThrow("root error boundary");
    expect(() =>
      assertIntendedAuditDom(schedule, {
        finalPathname: "/auth",
        expectedMarkerVisible: true,
        rootErrorBoundaryVisible: false,
        documentLanguage: "he",
        documentDirection: "rtl",
      }),
    ).toThrow("ended at /auth");
  });

  test("validates the exact Lighthouse navigation artifact and requested locale", () => {
    const authAr = lighthouseCases.find(({ id }) => id === "auth-ar")!;
    const valid = auditedDomFromLighthouse(
      authAr,
      { finalUrl: "http://127.0.0.1:4173/auth" },
      {
        RouteDom: {
          finalPathname: "/auth",
          mainClasses: ["auth-page"],
          rootErrorBoundaryVisible: false,
          documentLanguage: "ar",
          documentDirection: "rtl",
        },
      },
    );
    expect(() => assertIntendedAuditDom(authAr, valid)).not.toThrow();

    expect(() =>
      assertIntendedAuditDom(authAr, {
        ...valid,
        documentLanguage: "he",
      }),
    ).toThrow("document language he");
    expect(() =>
      assertIntendedAuditDom(authAr, {
        ...valid,
        documentDirection: "ltr",
      }),
    ).toThrow("document direction ltr");
    expect(() =>
      auditedDomFromLighthouse(authAr, { finalUrl: "http://127.0.0.1:4173/auth" }, {}),
    ).toThrow("RouteDom");
  });

  test("Lighthouse cleanup attempts every resource even when one close fails", async () => {
    const attempted: string[] = [];
    await expect(
      settleCleanupTasks([
        async () => {
          attempted.push("axe");
          throw new Error("axe close failed");
        },
        async () => {
          attempted.push("chrome");
        },
        async () => {
          attempted.push("server");
        },
      ]),
    ).rejects.toThrow("axe close failed");

    expect(attempted).toEqual(["axe", "chrome", "server"]);
  });

  test("cleanup failures remain visible without masking the primary audit error", async () => {
    const primary = new Error("audit failed");
    await settleCleanupTasks(
      [
        async () => {
          throw new Error("browser close failed");
        },
      ],
      primary,
    );
    expect(primary.message).toContain("audit failed");
    expect(primary.message).toContain("Cleanup failures: browser close failed");
  });

  test("production process cleanup awaits graceful and forced exits", async () => {
    class FakeChild extends EventEmitter {
      exitCode: number | null = null;
      signalCode: NodeJS.Signals | null = null;
      signals: NodeJS.Signals[] = [];
      exitOn: NodeJS.Signals;

      constructor(exitOn: NodeJS.Signals) {
        super();
        this.exitOn = exitOn;
      }

      kill(signal: NodeJS.Signals) {
        this.signals.push(signal);
        if (signal === this.exitOn) {
          setTimeout(() => {
            this.signalCode = signal;
            this.emit("exit", null, signal);
          }, 2);
        }
        return true;
      }
    }

    const graceful = new FakeChild("SIGTERM");
    await stopProcess(graceful as never, { gracefulTimeoutMs: 20, forceTimeoutMs: 20 });
    expect(graceful.signals).toEqual(["SIGTERM"]);

    const forced = new FakeChild("SIGKILL");
    await stopProcess(forced as never, { gracefulTimeoutMs: 1, forceTimeoutMs: 20 });
    expect(forced.signals).toEqual(["SIGTERM", "SIGKILL"]);
    expect(forced.signalCode).toBe("SIGKILL");
  });
});
