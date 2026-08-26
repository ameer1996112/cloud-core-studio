import { afterEach, describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as TanStackRouter from "@tanstack/react-router";
import { applyLang, t } from "../../src/lib/i18n.ts";
import {
  bottomTabsForRole,
  isActive,
  usesMemberShell,
} from "../../src/components/app-shell/useRoleNav.ts";

mock.module("@tanstack/react-router", () => ({
  ...TanStackRouter,
  Link: ({ to, children, reloadDocument, ...props }) =>
    React.createElement(
      "a",
      {
        href: to,
        "data-reload-document": reloadDocument ? "true" : undefined,
        ...props,
      },
      children,
    ),
}));

const { MemberDesktopHeader, MemberMobileBottomNavigation } =
  await import("../../src/components/app-shell/AppShell.tsx");

afterEach(() => applyLang("he"));

describe("member navigation", () => {
  test("keeps five stable member destinations", () => {
    applyLang("en");
    expect(bottomTabsForRole("member").map((item) => item.to)).toEqual([
      "/member",
      "/member/schedule",
      "/member/bookings",
      "/member/packages",
      "/member/account",
    ]);
  });

  test("uses concise booking labels in all languages", () => {
    applyLang("he");
    expect(bottomTabsForRole("member")[2].label).toBe("הזמנות");
    applyLang("ar");
    expect(bottomTabsForRole("member")[2].label).toBe("الحجوزات");
  });

  test("uses concise Schedule and Profile labels that fit the mobile RTL navigation", () => {
    applyLang("he");
    expect(bottomTabsForRole("member")[1].label).toBe("שיעורים");
    expect(bottomTabsForRole("member")[4].label).toBe("פרופיל");

    applyLang("ar");
    expect(bottomTabsForRole("member")[1].label).toBe("الحصص");
    expect(bottomTabsForRole("member")[4].label).toBe("ملفي");
  });

  test("marks only the exact home route active", () => {
    applyLang("en");
    const home = bottomTabsForRole("member")[0];
    expect(isActive("/member", home)).toBe(true);
    expect(isActive("/member/schedule", home)).toBe(false);
  });

  test("matches nested routes without matching similar route names", () => {
    applyLang("en");
    const bookings = bottomTabsForRole("member")[2];
    expect(isActive("/member/bookings/receipt", bookings)).toBe(true);
    expect(isActive("/member/bookings-extra", bookings)).toBe(false);
  });

  test("renders one accessible desktop landmark with supplied shell controls", () => {
    applyLang("en");
    const markup = renderToStaticMarkup(
      React.createElement(MemberDesktopHeader, {
        tabs: bottomTabsForRole("member"),
        pathname: "/member/schedule",
        isRtl: false,
        notificationControl: React.createElement("button", null, "Notifications"),
        signOutControl: React.createElement("button", null, "Sign out"),
      }),
    );

    expect(markup.match(/<nav\b/g)).toHaveLength(1);
    expect(markup).toContain(`aria-label="${t("shell.practice")}"`);
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    expect(markup).toContain(t("nav.schedule"));
    expect(markup).toContain("Notifications");
    expect(markup).toContain("Sign out");
    expect(markup).not.toContain("<h1");
  });

  test("renders accessible mobile navigation with stable member destinations", () => {
    applyLang("en");
    const markup = renderToStaticMarkup(
      React.createElement(MemberMobileBottomNavigation, {
        tabs: bottomTabsForRole("member"),
        pathname: "/member/bookings",
        isRtl: false,
      }),
    );

    expect(markup).toContain(`aria-label="${t("shell.practice")}"`);
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    expect([...markup.matchAll(/href="([^"]+)"/g)].map((match) => match[1])).toEqual([
      "/member",
      "/member/schedule",
      "/member/bookings",
      "/member/packages",
      "/member/account",
    ]);
  });

  test("uses document navigation when mobile users leave the public Schedule boundary", () => {
    applyLang("en");
    const markup = renderToStaticMarkup(
      React.createElement(MemberMobileBottomNavigation, {
        tabs: bottomTabsForRole("member"),
        pathname: "/member/schedule",
        isRtl: false,
      }),
    );

    expect(markup.match(/data-reload-document="true"/g)).toHaveLength(4);
  });

  test("uses document navigation when desktop users leave the public Schedule boundary", () => {
    applyLang("en");
    const markup = renderToStaticMarkup(
      React.createElement(MemberDesktopHeader, {
        tabs: bottomTabsForRole("member"),
        pathname: "/member/schedule",
        isRtl: false,
        notificationControl: React.createElement("button", null, "Notifications"),
        signOutControl: React.createElement("button", null, "Sign out"),
      }),
    );

    expect(markup.match(/data-reload-document="true"/g)).toHaveLength(5);
  });

  test("selects the member shell only for members", () => {
    expect(usesMemberShell("member")).toBe(true);
    expect(usesMemberShell("admin")).toBe(false);
    expect(usesMemberShell("instructor")).toBe(false);
  });
});
