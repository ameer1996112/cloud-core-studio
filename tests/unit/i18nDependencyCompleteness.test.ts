import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import { adminCatalog } from "../../src/lib/i18n/catalogs/admin";
import { coreCatalog } from "../../src/lib/i18n/catalogs/core";
import { instructorCatalog } from "../../src/lib/i18n/catalogs/instructor";
import { memberCatalog } from "../../src/lib/i18n/catalogs/member";
import { createI18nRuntime } from "../../src/lib/i18n/runtime";
import type { RoleMessageNamespace } from "../../src/lib/i18n/types";
import {
  buildTypeScriptDependencyGraph,
  resolveLocalSourceImport,
  typescriptFilesUnder,
} from "../helpers/typescriptDependencyGraph";

const root = resolve(import.meta.dir, "../..");
const sourceRoot = resolve(root, "src");
const catalogRoot = resolve(sourceRoot, "lib/i18n/catalogs");
const fixtureRoot = resolve(root, "tests/fixtures/i18n-dependency");
const catalogs = {
  core: coreCatalog,
  member: memberCatalog,
  instructor: instructorCatalog,
  admin: adminCatalog,
};
const allKeys = new Set(Object.values(catalogs).flatMap((catalog) => Object.keys(catalog.he)));

const publicRouteFiles = typescriptFilesUnder(resolve(sourceRoot, "routes"))
  .filter((file) => !file.includes("/_authenticated/"))
  .filter((file) => !/\/(?:api|internal)(?:\.|\/)/.test(file));

const shellEntrypoints = [
  resolve(sourceRoot, "routes/_authenticated/route.tsx"),
  resolve(sourceRoot, "components/app-shell/AppShell.tsx"),
  resolve(sourceRoot, "components/app-shell/useRoleNav.ts"),
];
const roleEntrypoints: Record<RoleMessageNamespace, string[]> = {
  member: [
    ...shellEntrypoints,
    ...typescriptFilesUnder(resolve(sourceRoot, "routes/_authenticated/member")),
    resolve(sourceRoot, "routes/_authenticated/receipts/$id.tsx"),
  ],
  instructor: [
    ...shellEntrypoints,
    ...typescriptFilesUnder(resolve(sourceRoot, "routes/_authenticated/instructor")),
  ],
  admin: [
    ...shellEntrypoints,
    ...typescriptFilesUnder(resolve(sourceRoot, "routes/_authenticated/admin")),
  ],
};

const publicGraph = buildTypeScriptDependencyGraph({
  entrypoints: publicRouteFiles,
  sourceRoot,
  messageKeys: allKeys,
  excludedRoots: [catalogRoot],
});
const roleGraphs = Object.fromEntries(
  (Object.keys(roleEntrypoints) as RoleMessageNamespace[]).map((role) => [
    role,
    buildTypeScriptDependencyGraph({
      entrypoints: roleEntrypoints[role],
      sourceRoot,
      messageKeys: allKeys,
      excludedRoots: [catalogRoot],
    }),
  ]),
) as Record<RoleMessageNamespace, ReturnType<typeof buildTypeScriptDependencyGraph>>;

describe("TypeScript dependency graph", () => {
  test("resolves dotted extensionless source basenames before known extensions and indexes", () => {
    const importer = resolve(fixtureRoot, "entry.tsx");

    expect(resolveLocalSourceImport(importer, "./edge.functions", sourceRoot)).toBe(
      resolve(fixtureRoot, "edge.functions.ts"),
    );
    expect(resolveLocalSourceImport(importer, "./edge.client", sourceRoot)).toBe(
      resolve(fixtureRoot, "edge.client.ts"),
    );
    expect(resolveLocalSourceImport(importer, "./edge.server", sourceRoot)).toBe(
      resolve(fixtureRoot, "edge.server.tsx"),
    );
  });

  test("AST traversal follows static/dynamic imports and cannot lose keys after empty JSX attributes", () => {
    const graph = buildTypeScriptDependencyGraph({
      entrypoints: [resolve(fixtureRoot, "entry.tsx")],
      sourceRoot,
      messageKeys: allKeys,
    });

    expect(graph.unresolvedImports).toEqual([]);
    expect(graph.visitedFiles).toEqual([
      resolve(fixtureRoot, "edge.client.ts"),
      resolve(fixtureRoot, "edge.functions.ts"),
      resolve(fixtureRoot, "edge.server.tsx"),
      resolve(fixtureRoot, "entry.tsx"),
    ]);
    expect(graph.messageKeys).toEqual([
      "admin.classes.noTemplate",
      "admin.classes.selectProgram",
      "admin.classes.selectRoom",
      "admin.noPreference",
      "payments.memberSelect",
    ]);
  });
});

describe("i18n route dependency completeness", () => {
  test("all independently traversed public and role dependency edges resolve", () => {
    expect({
      public: publicGraph.unresolvedImports,
      member: roleGraphs.member.unresolvedImports,
      instructor: roleGraphs.instructor.unresolvedImports,
      admin: roleGraphs.admin.unresolvedImports,
    }).toEqual({ public: [], member: [], instructor: [], admin: [] });
  });

  test("the admin graph traverses the previously hidden real translation dependencies", () => {
    expect(roleGraphs.admin.messageKeys).toEqual(
      expect.arrayContaining([
        "admin.classes.selectProgram",
        "admin.classes.selectRoom",
        "admin.classes.noTemplate",
        "admin.noPreference",
        "payments.memberSelect",
      ]),
    );
  });

  test("a cold public runtime resolves every statically reachable public message from core", () => {
    const reviewerKeys = [
      "profile.language",
      "page.schedule.title",
      "page.packages.title",
      "member.search",
      "member.filter.level",
      "member.filter.energy",
      "member.schedule.filter.eyebrow",
      "member.schedule.filter.title",
      "member.schedule.filter.clear",
      "promo.yoga.title",
      "promo.yoga.landingHeadline",
    ];
    const keys = [...new Set([...publicGraph.messageKeys, ...reviewerKeys])].sort();
    const missing: string[] = [];
    const runtime = createI18nRuntime({
      language: "he",
      core: coreCatalog,
      onMissingKey: (key) => missing.push(key),
    });

    for (const key of keys) runtime.t(key);

    expect(runtime.loadedNamespaces()).toEqual(["core"]);
    expect(missing).toEqual([]);
  });

  for (const namespace of ["member", "instructor", "admin"] as const) {
    test(`core plus ${namespace} resolves its statically reachable shell and route messages`, async () => {
      const explicitRoleDependencies = {
        member: ["nav.group.studio", "nav.schedule", "nav.plans"],
        instructor: [
          "nav.studioPulse",
          "roster.title",
          "roster.noBookings",
          "roster.waitlist",
          "state.closed",
          "common.open",
          "attendance.present",
          "attendance.noShow",
          "admin.classes.creditValue",
          "admin.classes.capacityPlaces",
        ],
        admin: ["nav.group.studio", "nav.schedule", "nav.plans"],
      }[namespace];
      const keys = [
        ...new Set([...roleGraphs[namespace].messageKeys, ...explicitRoleDependencies]),
      ].sort();
      const missing: string[] = [];
      const runtime = createI18nRuntime({
        language: "he",
        core: coreCatalog,
        loaders: { [namespace]: async () => catalogs[namespace] },
        onMissingKey: (key) => missing.push(key),
      });

      await runtime.ensureNamespaces([namespace]);
      for (const key of keys) runtime.t(key);

      expect(runtime.loadedNamespaces()).toEqual(["core", namespace]);
      expect(missing).toEqual([]);
    });
  }
});
