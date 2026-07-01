import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as actualRouter from "@tanstack/react-router";

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
    lang: "en",
    t: (key) =>
      ({
        "legal.privacy": "Privacy",
        "legal.terms": "Terms",
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

describe("public support route", () => {
  test("promotes direct support and public guest navigation before detailed help cards", async () => {
    const routeModule = await import("../../src/routes/support.tsx");
    const html = renderToStaticMarkup(React.createElement(routeModule.Route.options.component));

    expect(html).toContain("Contact the studio team directly");
    expect(html).toContain("cloudandcorestudio@gmail.com");
    expect(html).toContain("https://wa.me/message/S5HBZNKUMX45O1");
    expect(html).toContain('href="/member/schedule"');
    expect(html).toContain('href="/auth"');
    expect(html).toContain("Browse schedule");
    expect(html).toContain("Sign in or get account help");
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/terms"');

    expect(html.indexOf("cloudandcorestudio@gmail.com")).toBeLessThan(html.indexOf("Bookings"));
    expect(html.indexOf('href="/member/schedule"')).toBeLessThan(html.indexOf("Bookings"));
  });
});
