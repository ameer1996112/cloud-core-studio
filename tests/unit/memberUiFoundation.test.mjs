import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MESSAGES } from "../../src/lib/i18n.ts";
import { nextLanguageMenuIndex } from "../../src/components/app-shell/language-menu.ts";

const root = resolve(import.meta.dir, "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

describe("member UI foundation", () => {
  test("defines semantic surface, action, focus, spacing and type tokens", () => {
    const tokens = read("src/styles/tokens.css");

    for (const token of [
      "--color-surface-canvas",
      "--color-surface-base",
      "--color-surface-subtle",
      "--color-action-primary",
      "--color-focus-outer",
      "--space-16",
      "--text-page-title-mobile",
    ]) {
      expect(tokens).toContain(token);
    }
  });

  test("uses a two-layer high-contrast focus indicator", () => {
    const tokens = read("src/styles/tokens.css");
    const theme = read("src/styles/theme-session.css");
    const base = read("src/styles/base-components.css");

    expect(tokens).toContain("--color-focus-inner: #d4af6a");
    expect(theme).toContain("--cc-focus-ring: 0 0 0 2px var(--color-focus-inner)");
    expect(theme).toContain("0 0 0 4px var(--color-focus-outer)");
    expect(base).toContain("box-shadow: var(--cc-focus-ring)");
    expect(theme).toContain(".session-input:focus");
    expect(theme).toContain(".premium-time-selects select:focus");
  });

  test("keeps class location readable instead of truncating it", () => {
    const detail = read("src/components/member/ClassDetailContent.tsx");
    const styles = read("src/styles/studio-refinement.css");
    expect(detail).toContain("getFriendlyStudioLocation(lang)");
    expect(detail).toContain("<bdi>{f.value}</bdi>");
    expect(styles).toMatch(/\.aura-detail-facts dd\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  });

  test("keeps the language menu keyboard-operable", () => {
    const shell = read("src/components/app-shell/AppShell.tsx");

    expect(shell).toContain("onKeyDown={handleMenuKeyDown}");
    expect(shell).toContain('event.key === "Escape"');
    expect(shell).toContain("useId().replace");
    expect(shell).toContain("menuWrapperRef.current?.contains(document.activeElement)");
    expect(shell).toContain("tabIndex={currentLang === code ? 0 : -1}");

    expect(nextLanguageMenuIndex("ArrowDown", 0, 0, 3)).toBe(1);
    expect(nextLanguageMenuIndex("ArrowDown", 1, 0, 3)).toBe(2);
    expect(nextLanguageMenuIndex("ArrowDown", 2, 0, 3)).toBe(0);
    expect(nextLanguageMenuIndex("ArrowUp", 0, 0, 3)).toBe(2);
    expect(nextLanguageMenuIndex("Home", 2, 0, 3)).toBe(0);
    expect(nextLanguageMenuIndex("End", 0, 0, 3)).toBe(2);
    expect(nextLanguageMenuIndex("Enter", 0, 0, 3)).toBeNull();
  });

  test("derives local error direction from the active locale", () => {
    const rootRoute = read("src/routes/__root.tsx");
    const paymentResult = read("src/routes/payment-result.tsx");

    expect(rootRoute).toContain("const { dir } = useI18n()");
    expect(paymentResult).toContain("const { dir } = useI18n()");
    expect(paymentResult).not.toContain('dir="rtl"');
  });

  test("supplies every payment outcome and shared error state in all supported languages", () => {
    for (const lang of ["en", "he", "ar"]) {
      expect(MESSAGES[lang]["page.error.eyebrow"]).toBeDefined();
      expect(MESSAGES[lang]["page.error.body"]).toBeDefined();
      expect(MESSAGES[lang]["page.notFound.eyebrow"]).toBeDefined();
      expect(MESSAGES[lang]["paymentResult.kidsSuccess.detail"]).toBeDefined();
      for (const status of ["success", "pending", "cancelled", "failed", "missing"]) {
        expect(MESSAGES[lang][`paymentResult.${status}.title`]).toBeDefined();
        expect(MESSAGES[lang][`paymentResult.${status}.body`]).toBeDefined();
        expect(MESSAGES[lang][`paymentResult.${status}.detail`]).toBeDefined();
      }
    }
  });
});
