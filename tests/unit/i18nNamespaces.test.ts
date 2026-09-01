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

  test("preserves all 1,378 translated values in every language", () => {
    const expectedHashes = {
      en: "7a8f5ee123d292c7494aef0c4e691b32cfe720d56ba08405dcc32c39ad8404fa",
      he: "ac6ffea3f7e18a53673cbba8067c1accd31ebb97f3bdf48e581c4a2c6ca94b96",
      ar: "ec01a63e19648e15da7157c7ce6ea928a1e0365e7e2301dbead95d1269db08db",
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

      expect(messages.size).toBe(1_378);
      expect(createHash("sha256").update(serialized).digest("hex")).toBe(expectedHashes[language]);
    }
  });
});
