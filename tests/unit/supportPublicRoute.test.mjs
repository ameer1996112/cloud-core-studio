import { describe, expect, test } from "bun:test";

const decoder = new TextDecoder();
const cwd = process.cwd();

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function renderSupportRoute(lang = "en") {
  const script = `
import { mock } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as actualRouter from "@tanstack/react-router";

const currentLang = ${JSON.stringify(lang)};

mock.module("@tanstack/react-router", () => ({
  ...actualRouter,
  Link: ({ to, children, ...props }) =>
    React.createElement("a", { href: String(to), ...props }, children),
}));

mock.module("@/lib/i18n", () => ({
  LANG_META: {
    en: { dir: "ltr" },
    he: { dir: "rtl" },
    ar: { dir: "rtl" },
  },
  useI18n: () => ({
    lang: currentLang,
    t: (key) =>
      ({
        "legal.privacy": "Privacy",
        "legal.terms": "Terms",
        "legal.checkout": "Checkout",
      })[key] ?? key,
  }),
}));

mock.module("@/hooks/useDocumentTitle", () => ({
  useDocumentTitle: () => {},
}));

mock.module("@/components/legal/LegalLanguageSwitcher", () => ({
  LegalLanguageSwitcher: () =>
    React.createElement("div", { "data-testid": "language-switcher" }, "Language"),
}));

mock.module("@/components/public/PublicShell", () => ({
  PublicShell: ({ children }) => React.createElement("main", { id: "main-content" }, children),
}));

const routeModule = await import("./src/routes/support.tsx");
process.stdout.write(renderToStaticMarkup(React.createElement(routeModule.Route.options.component)));
`;

  const result = Bun.spawnSync({
    cmd: ["bun", "-e", script],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(decoder.decode(result.stderr).trim() || "support route render failed");
  }

  return decoder.decode(result.stdout);
}

describe("public support route", () => {
  test("promotes direct support and public guest navigation before detailed help cards", () => {
    const html = renderSupportRoute("en");

    expect(countOccurrences(html, '<main id="main-content"')).toBe(1);
    expect(html).toContain("Direct support");
    expect(html).toContain("cloudandcorestudio@gmail.com");
    expect(html).toContain("https://wa.me/message/S5HBZNKUMX45O1");
    expect(countOccurrences(html, '<bdi dir="ltr">055-939-8438</bdi>')).toBe(2);
    expect(countOccurrences(html, '<bdi dir="ltr">cloudandcorestudio@gmail.com</bdi>')).toBe(1);
    expect(countOccurrences(html, '<bdi dir="ltr">')).toBe(3);
    expect(html).toContain('href="/member/schedule"');
    expect(html).toContain("Browse schedule");
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/terms"');
    expect(html).toMatch(
      /<a href="\/auth"[^>]*><h3[^>]*>Sign in or get account help<\/h3><p[^>]*>Use the account screen for bookings, packages, and profile support\.<\/p><\/a>/,
    );

    expect(html.indexOf("cloudandcorestudio@gmail.com")).toBeLessThan(html.indexOf("Bookings"));
    expect(html.indexOf('href="/member/schedule"')).toBeLessThan(html.indexOf("Bookings"));
    expect(html.indexOf("Sign in or get account help")).toBeLessThan(html.indexOf("Bookings"));
  });

  test("renders hebrew and arabic support navigation copy with document-owned direction", () => {
    const hebrewHtml = renderSupportRoute("he");
    const arabicHtml = renderSupportRoute("ar");

    expect(hebrewHtml).toContain('<main id="main-content"');
    expect(hebrewHtml).not.toContain('<main id="main-content" dir=');
    expect(hebrewHtml).toContain("יצירת קשר ישירה");
    expect(hebrewHtml).toContain("עיון בלוח השיעורים");
    expect(hebrewHtml).toContain("כניסה או עזרה בחשבון");

    expect(arabicHtml).toContain('<main id="main-content"');
    expect(arabicHtml).not.toContain('<main id="main-content" dir=');
    expect(arabicHtml).toContain("دعم مباشر");
    expect(arabicHtml).toContain("تصفحوا الجدول");
    expect(arabicHtml).toContain("تسجيل الدخول أو المساعدة بالحساب");

    for (const html of [hebrewHtml, arabicHtml]) {
      expect(countOccurrences(html, '<bdi dir="ltr">055-939-8438</bdi>')).toBe(2);
      expect(countOccurrences(html, '<bdi dir="ltr">cloudandcorestudio@gmail.com</bdi>')).toBe(1);
      expect(countOccurrences(html, '<bdi dir="ltr">')).toBe(3);
    }
  });
});
