import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const readSource = (file) => readFileSync(resolve(root, file), "utf8");

const publicShell = readSource("src/components/public/PublicShell.tsx");
const languageSwitcher = readSource("src/components/public/PublicLanguageSwitcher.tsx");
const legalLanguageSwitcher = readSource("src/components/legal/LegalLanguageSwitcher.tsx");
const rootRoute = readSource("src/routes/__root.tsx");

describe("public shell and localized recovery contracts", () => {
  test("PublicShell owns the single public main landmark and a localized skip target", () => {
    expect(publicShell).toContain("export interface PublicShellProps");
    expect(publicShell).toContain('href="#main-content"');
    expect(publicShell).toContain('t("common.skipToContent")');
    expect(publicShell.match(/<main\b/g)).toHaveLength(1);
    expect(publicShell).toContain('id="main-content"');
  });

  test("PublicShell can suppress shared chrome for self-contained public pages", () => {
    expect(publicShell).toContain("showHeader?: boolean");
    expect(publicShell).toContain("showFooter?: boolean");
    expect(publicShell).toContain("showHeader = true");
    expect(publicShell).toContain("showFooter = true");
    expect(publicShell).toContain("{showHeader ? (");
    expect(publicShell).toContain("{showFooter ? <PublicFooter /> : null}");
  });

  test("the root keeps its localized skip-link fallback until routes adopt PublicShell", () => {
    const rootComponent = rootRoute.slice(rootRoute.indexOf("function RootComponent"));

    expect(rootComponent).toContain('className="global-skip-link"');
    expect(rootComponent).toContain('href="#main-content"');
    expect(rootComponent).toContain('translate("common.skipToContent")');
  });

  test("the shared language switcher offers Hebrew, Arabic, and English", () => {
    expect(languageSwitcher).toContain("PublicLanguageSwitcher");
    expect(languageSwitcher).toContain("applyLang(code)");
    expect(languageSwitcher).toContain("LANG_META");
    for (const lang of ["he", "ar", "en"]) {
      expect(languageSwitcher).toContain(`"${lang}"`);
    }
    expect(legalLanguageSwitcher).toContain("PublicLanguageSwitcher");
  });

  test("root recovery is localized and provides retry, home, and support actions", () => {
    const notFound = rootRoute.match(/function NotFoundComponent\(\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const error = rootRoute.match(/function ErrorComponent\([\s\S]*?\n\}/)?.[0] ?? "";

    expect(notFound).toContain("useI18n()");
    expect(error).toContain("useI18n()");
    expect(notFound).toContain('t("recovery.notFound.title")');
    expect(notFound).toContain('t("recovery.action.home")');
    expect(notFound).toContain('t("recovery.action.support")');
    expect(error).toContain('t("recovery.error.title")');
    expect(error).toContain('t("common.retry")');
    expect(error).toContain('t("recovery.action.home")');
    expect(error).toContain('t("recovery.action.support")');
    expect(error).toContain("dir={dir}");
    expect(error).toContain("<details");
    expect(notFound).not.toMatch(/[\u0590-\u05ff]/);
    expect(error).not.toMatch(/[\u0590-\u05ff]/);
  });

  test("recovery copy exists in every supported locale", () => {
    const i18n = readSource("src/lib/i18n/catalogs/core.ts");
    for (const key of [
      "recovery.notFound.title",
      "recovery.notFound.body",
      "recovery.error.title",
      "recovery.error.body",
      "recovery.action.home",
      "recovery.action.support",
      "recovery.error.details",
    ]) {
      expect(i18n.match(new RegExp(`"${key}":`, "g"))).toHaveLength(3);
    }
  });
});
