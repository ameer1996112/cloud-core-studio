import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { coreCatalog } from "../../src/lib/i18n/catalogs/core.ts";
import { memberCatalog } from "../../src/lib/i18n/catalogs/member.ts";
import { nextLanguageMenuIndex } from "../../src/components/app-shell/language-menu.ts";

const root = resolve(import.meta.dir, "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

describe("member UI foundation", () => {
  test("defines the current semantic surface, action, focus, spacing, and type tokens", () => {
    const tokens = read("src/styles/tokens.css");

    for (const token of [
      "--cc-surface-canvas",
      "--cc-surface-raised",
      "--cc-action-primary",
      "--cc-focus-outline",
      "--cc-focus-ring",
      "--cc-space-12",
      "--cc-target-min",
    ]) {
      expect(tokens).toContain(token);
    }
  });

  test("keeps class location readable instead of truncating it", () => {
    const detail = read("src/components/member/ClassDetailSheet.tsx");

    expect(detail).toContain("allowWrap={true}");
    expect(detail).toContain("break-words");
  });

  test("keeps the language menu keyboard-operable", () => {
    const shell = read("src/components/app-shell/AppShell.tsx");

    expect(shell).toContain("onKeyDown={handleMenuKeyDown}");
    expect(shell).toContain('event.key === "Escape"');
    expect(shell).toContain("menuWrapperRef.current?.contains(document.activeElement)");
    expect(shell).toContain("tabIndex={currentLang === code ? 0 : -1}");
    expect(nextLanguageMenuIndex("ArrowDown", 0, 0, 3)).toBe(1);
    expect(nextLanguageMenuIndex("ArrowUp", 0, 0, 3)).toBe(2);
    expect(nextLanguageMenuIndex("Home", 2, 0, 3)).toBe(0);
    expect(nextLanguageMenuIndex("End", 0, 0, 3)).toBe(2);
  });

  test("uses locale-derived direction in root, authenticated recovery, and payment-result presentation", () => {
    const rootRoute = read("src/routes/__root.tsx");
    const authenticatedRoute = read("src/routes/_authenticated/route.tsx");
    const paymentResult = read("src/routes/payment-result.tsx");

    expect(rootRoute).toContain("dir={getDirection(initialLang)}");
    expect(authenticatedRoute).toContain("const { dir, t } = useI18n()");
    expect(authenticatedRoute).toContain('t("recovery.error.title")');
    expect(authenticatedRoute).toContain('t("recovery.notFound.title")');
    expect(paymentResult).toContain("useI18n()");
    expect(paymentResult).not.toContain('dir="rtl"');
  });

  test("supplies recovery copy in all supported languages", () => {
    for (const lang of ["en", "he", "ar"]) {
      expect(coreCatalog[lang]["recovery.error.title"]).toBeDefined();
      expect(coreCatalog[lang]["recovery.error.body"]).toBeDefined();
      expect(coreCatalog[lang]["recovery.notFound.title"]).toBeDefined();
      expect(memberCatalog[lang]["profile.deleteRequestSubmittedTitle"]).toBeDefined();
      expect(memberCatalog[lang]["packages.cardPaymentRetry"]).toBeDefined();
    }
  });
});
