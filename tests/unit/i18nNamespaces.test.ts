import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";

import { coreCatalog } from "../../src/lib/i18n/catalogs/core";
import { adminCatalog } from "../../src/lib/i18n/catalogs/admin";
import { instructorCatalog } from "../../src/lib/i18n/catalogs/instructor";
import { memberCatalog } from "../../src/lib/i18n/catalogs/member";
import { createI18nRuntime, resolveMessage } from "../../src/lib/i18n/runtime";
import type { LocalizedCatalog } from "../../src/lib/i18n/types";

describe("i18n namespaces", () => {
  test("loads only the requested role namespace", async () => {
    const runtime = createI18nRuntime({ language: "ar", core: coreCatalog });

    await runtime.ensureNamespaces(["member"]);

    expect(runtime.loadedNamespaces()).toEqual(["core", "member"]);
    expect(runtime.t("member.schedule.filter.title")).toBe("تصفية الحصص");
  });

  test("falls back to authoritative Hebrew for a missing localized key", () => {
    const catalogs = {
      core: {
        en: { "core.support.title": "Support" },
        he: { "core.support.title": "תמיכה" },
        ar: {},
      } satisfies LocalizedCatalog,
    };

    expect(resolveMessage({ language: "ar", key: "core.support.title", catalogs })).toBe(
      catalogs.core.he["core.support.title"],
    );
  });

  test("keeps unloaded role catalogs out of the eager runtime", () => {
    const runtime = createI18nRuntime({ language: "he", core: coreCatalog });

    expect(runtime.loadedNamespaces()).toEqual(["core"]);
    expect(runtime.hasNamespace("admin")).toBe(false);
    expect(runtime.hasNamespace("instructor")).toBe(false);
    expect(runtime.hasNamespace("member")).toBe(false);
  });

  test("keeps role-only keys out of the eager core catalog", () => {
    expect(
      coreCatalog.he["admin.classDetail.deleteClass" as keyof typeof coreCatalog.he],
    ).toBeUndefined();
    expect(Object.keys(coreCatalog.he).some((key) => key.startsWith("admin."))).toBe(false);
    expect(coreCatalog.he["member.account.body" as keyof typeof coreCatalog.he]).toBeUndefined();
    expect(Object.keys(coreCatalog.he).some((key) => key.startsWith("pulse."))).toBe(false);
  });

  test("keeps every namespace complete against its Hebrew source of truth", () => {
    for (const catalog of [coreCatalog, memberCatalog, instructorCatalog, adminCatalog]) {
      const hebrewKeys = Object.keys(catalog.he).sort();
      expect(Object.keys(catalog.en).sort()).toEqual(hebrewKeys);
      expect(Object.keys(catalog.ar).sort()).toEqual(hebrewKeys);
    }
  });

  test("preserves all 1,366 translated values in every language", () => {
    const expectedHashes = {
      en: "1989d5486cd689d839e4f8cd1d38f389c11e266a8d7984a9e393b9d36cb55597",
      he: "884a4b120f61d45e81dae5c06f9ca786702fa3ed1d7a7cbe8f5fabcfca268f1d",
      ar: "c8a4a76b658c6eb6061922b81c5ce26562659fa265fc54da5f0dbdbd51fda239",
    } as const;

    for (const language of ["en", "he", "ar"] as const) {
      const messages = new Map<string, string>();
      for (const catalog of [coreCatalog, memberCatalog, instructorCatalog, adminCatalog]) {
        for (const [key, value] of Object.entries(catalog[language])) {
          expect(messages.get(key) ?? value).toBe(value);
          messages.set(key, value);
        }
      }
      const serialized = JSON.stringify(
        [...messages].sort(([left], [right]) => left.localeCompare(right)),
      );

      expect(messages.size).toBe(1_366);
      expect(createHash("sha256").update(serialized).digest("hex")).toBe(expectedHashes[language]);
    }
  });
});
