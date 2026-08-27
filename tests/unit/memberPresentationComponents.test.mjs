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

  test("MemberSegmentedControl moves focus, wraps, and reveals tabs in LTR and RTL", () => {
    const items = [
      { value: "upcoming", label: "Upcoming" },
      { value: "waitlist", label: "Waitlist" },
      { value: "past", label: "Past" },
      { value: "cancelled", label: "Cancelled" },
    ];

    function exercise(dir, currentIndex, key) {
      const changes = [];
      const focused = [];
      const revealed = [];
      const prevented = [];
      const tree = MemberSegmentedControl({
        baseId: `bookings-${dir}`,
        label: "Booking history",
        value: items[currentIndex].value,
        items,
        onChange: (value) => changes.push(value),
        dir,
      });
      const tablist = tree.props.children;
      const tabs = tablist.props.children;
      const nodes = tabs.map((_, index) => ({
        focus: () => focused.push(index),
        scrollIntoView: (options) => revealed.push({ index, options }),
      }));
      const parentElement = {
        querySelectorAll: (selector) => {
          expect(selector).toBe('[role="tab"]');
          return nodes;
        },
      };

      tabs[currentIndex].props.onKeyDown({
        key,
        currentTarget: { parentElement },
        preventDefault: () => prevented.push(true),
      });

      return { changes, focused, revealed, prevented };
    }

    expect(exercise("ltr", 3, "ArrowRight")).toEqual({
      changes: ["upcoming"],
      focused: [0],
      revealed: [{ index: 0, options: { block: "nearest", inline: "nearest" } }],
      prevented: [true],
    });
    expect(exercise("ltr", 0, "ArrowLeft").changes).toEqual(["cancelled"]);
    expect(exercise("rtl", 0, "ArrowRight").changes).toEqual(["cancelled"]);
    expect(exercise("rtl", 3, "ArrowLeft").changes).toEqual(["upcoming"]);
    expect(exercise("ltr", 2, "Home").changes).toEqual(["upcoming"]);
    expect(exercise("rtl", 1, "End").changes).toEqual(["cancelled"]);
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
