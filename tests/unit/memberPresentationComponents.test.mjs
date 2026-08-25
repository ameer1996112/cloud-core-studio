import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as actualRouter from "@tanstack/react-router";
import { applyLang } from "../../src/lib/i18n.ts";

mock.module("@tanstack/react-router", () => ({
  ...actualRouter,
  Link: ({ to, children, ...props }) =>
    React.createElement("a", { href: String(to), ...props }, children),
}));

const { MemberPageIntro, MemberSection } =
  await import("../../src/components/member/MemberPage.tsx");
const { MemberSegmentedControl } =
  await import("../../src/components/member/MemberSegmentedControl.tsx");
const { MemberRouteError, MemberRouteSkeleton } =
  await import("../../src/components/member/MemberRouteSkeleton.tsx");

applyLang("en");

describe("member presentation components", () => {
  test("MemberPageIntro renders one heading and a direct schedule action", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MemberPageIntro, {
        title: "Welcome back",
        action: { label: "Find a class", to: "/member/schedule" },
      }),
    );

    expect(markup.match(/<h1\b/g)).toHaveLength(1);
    expect(markup).toContain('href="/member/schedule"');
    expect(markup).toContain(">Find a class</a>");
  });

  test("MemberSection labels the section with its title", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        MemberSection,
        { id: "next", title: "Next class" },
        React.createElement("p", null, "Tomorrow"),
      ),
    );

    expect(markup).toContain('aria-labelledby="next-title"');
    expect(markup).toContain('id="next-title"');
  });

  test("MemberSegmentedControl exposes selected and unselected tabs", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MemberSegmentedControl, {
        baseId: "bookings",
        label: "Booking history",
        value: "upcoming",
        items: [
          { value: "upcoming", label: "Upcoming" },
          { value: "past", label: "Past" },
        ],
        onChange: () => {},
        dir: "ltr",
      }),
    );

    expect(markup).toContain('role="tablist"');
    expect(markup.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(markup).toMatch(/aria-selected="false"[^>]*tabindex="-1"/);
    expect(markup).toContain('id="bookings-tab-upcoming"');
    expect(markup).toContain('aria-controls="bookings-panel-upcoming"');
  });

  test("MemberSegmentedControl keeps one tab reachable when value is invalid", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MemberSegmentedControl, {
        baseId: "bookings",
        label: "Booking history",
        value: "missing",
        items: [
          { value: "upcoming", label: "Upcoming" },
          { value: "past", label: "Past" },
        ],
        onChange: () => {},
        dir: "ltr",
      }),
    );

    expect(markup.match(/tabindex="0"/g) ?? []).toHaveLength(1);
    expect(markup).toMatch(
      /<button[^>]*aria-selected="true"[^>]*tabindex="0"[^>]*><span>Upcoming<\/span>/,
    );
  });

  test("MemberRouteSkeleton exposes loading status and decorative content", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MemberRouteSkeleton, { route: "home" }),
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-hidden="true"');
  });

  test("MemberRouteError announces the error and offers retry", () => {
    applyLang("en");
    const markup = renderToStaticMarkup(
      React.createElement(MemberRouteError, { onRetry: () => {} }),
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain(">Retry</button>");
  });
});
