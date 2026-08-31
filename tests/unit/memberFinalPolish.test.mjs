import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as TanStackRouter from "@tanstack/react-router";
import { mock } from "bun:test";

const read = (relativePath) =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");

mock.module("@tanstack/react-router", () => ({
  ...TanStackRouter,
  Link: ({ to, children, reloadDocument: _reloadDocument, ...props }) =>
    React.createElement("a", { href: to, ...props }, children),
}));

const { MemberMobileBottomNavigation } =
  await import("../../src/components/app-shell/AppShell.tsx");
const { MemberSegmentedControl } =
  await import("../../src/components/member/MemberSegmentedControl.tsx");

describe("member experience final polish", () => {
  test("keeps essential mobile navigation labels at 13px or larger", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MemberMobileBottomNavigation, {
        tabs: [
          { to: "/member", label: "Home", icon: () => React.createElement("svg") },
          { to: "/member/schedule", label: "Schedule", icon: () => React.createElement("svg") },
          { to: "/member/bookings", label: "Bookings", icon: () => React.createElement("svg") },
          { to: "/member/packages", label: "Packages", icon: () => React.createElement("svg") },
          { to: "/member/account", label: "Profile", icon: () => React.createElement("svg") },
        ],
        pathname: "/member",
        isRtl: false,
      }),
    );

    expect(markup).toContain("text-[13px]");
    expect(markup).not.toContain("text-[11px]");
  });

  test("keeps the mobile navigation compact while preserving a 44px-plus touch target", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MemberMobileBottomNavigation, {
        tabs: [
          { to: "/member", label: "Home", icon: () => React.createElement("svg") },
          { to: "/member/schedule", label: "Schedule", icon: () => React.createElement("svg") },
        ],
        pathname: "/member",
        isRtl: false,
      }),
    );
    const css = read("src/styles/base.css");

    expect(markup).toContain("min-h-[48px]");
    expect(css).toMatch(/--member-bottom-nav-height:\s*76px;/);
  });

  test("renders an RTL-safe, non-interactive mobile overflow cue around booking tabs", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MemberSegmentedControl, {
        baseId: "bookings",
        label: "Bookings",
        value: "upcoming",
        items: [
          { value: "upcoming", label: "Upcoming" },
          { value: "waitlist", label: "Waitlist" },
          { value: "past", label: "Past" },
          { value: "cancelled", label: "Cancelled" },
        ],
        onChange: () => {},
        dir: "rtl",
      }),
    );
    const css = read("src/styles/member.css");

    expect(markup).toContain('class="member-segmented-control-frame"');
    expect(markup).toContain('dir="rtl"');
    expect(css).toMatch(
      /\.member-segmented-control-frame::after\s*\{[^}]*inset-inline-end:[^}]*pointer-events:\s*none;/s,
    );
    expect(css).toMatch(/\.member-segmented-control-frame\[dir="rtl"\]::after\s*\{/);
  });

  test("renders booking counts as isolated badges without RTL separator punctuation", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MemberSegmentedControl, {
        baseId: "bookings",
        label: "Bookings",
        value: "upcoming",
        items: [
          { value: "upcoming", label: "קרובות", count: 0 },
          { value: "waitlist", label: "רשימת המתנה", count: 2 },
        ],
        onChange: () => {},
        dir: "rtl",
      }),
    );
    const css = read("src/styles/member.css");

    expect(markup).toContain('class="member-segmented-control__count"');
    expect(markup).toContain("<bdi>0</bdi>");
    expect(markup).not.toContain("·");
    expect(css).toMatch(
      /\.member-segmented-control__count\s*\{[^}]*border-radius:\s*999px;[^}]*font-variant-numeric:\s*tabular-nums;/s,
    );
    expect(css).toMatch(
      /\.member-segmented-control__tab\[aria-selected="true"\]\s+\.member-segmented-control__count\s*\{/,
    );
  });

  test("keeps zero-value booking summary metrics in compact cards", () => {
    const source = read("src/routes/_authenticated/member/bookings.tsx");
    const css = read("src/styles/member.css");

    expect(source).toContain('className="member-booking-stat"');
    expect(source).toContain('className="member-booking-stat__value"');
    expect(css).toMatch(
      /\.member-bookings-stat-strip,\s*\.member-booking-counts-placeholder\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/s,
    );
    expect(css).toMatch(
      /\.member-booking-stat\s*\{[^}]*display:\s*flex;[^}]*border-radius:[^}]*text-align:\s*start;/s,
    );
    expect(css).toMatch(
      /\.member-booking-stat__value\s*\{[^}]*display:\s*inline-grid;[^}]*border-radius:\s*999px;[^}]*font-variant-numeric:\s*tabular-nums;/s,
    );
  });

  test("places the primary bookings workspace before Concierge secondary content", () => {
    const source = read("src/routes/_authenticated/member/bookings.tsx");
    const workspace = source.indexOf("<MemberSegmentedControl");
    const panel = source.indexOf('className="member-bookings-panel"');
    const onboarding = source.indexOf("{showConciergeOnboarding && (");
    const firstVisit = source.indexOf("{firstVisitBooking?.class && (");

    expect(workspace).toBeGreaterThanOrEqual(0);
    expect(panel).toBeGreaterThan(workspace);
    expect(onboarding).toBeGreaterThan(panel);
    expect(firstVisit).toBeGreaterThan(panel);
  });

  test("keeps one authoritative compact Schedule override block after legacy styles", () => {
    const css = read("src/styles/member.css");
    const marker = "/* Schedule overrides live after legacy member filters";
    const markerIndex = css.indexOf(marker);

    expect(css.match(/\/\* Schedule overrides live after legacy member filters/g)).toHaveLength(1);
    expect(markerIndex).toBeGreaterThan(css.indexOf('.member-schedule-filter-panel[dir="rtl"]'));
    expect(css.indexOf(".member-schedule-page")).toBeGreaterThan(markerIndex);
    expect(css.slice(markerIndex)).toMatch(
      /\.member-filter-trigger,\s*\.member-schedule-filter-sheet__apply,[^}]*\{\s*min-height:\s*44px;/s,
    );
    expect(css.slice(markerIndex)).toMatch(
      /@media \(min-width:\s*768px\)[\s\S]*\.member-filter-trigger\s*\{\s*display:\s*none;/,
    );
  });

  test("warms the real public member schedule route", () => {
    const config = read("vite.config.ts");

    expect(config).toContain("./src/routes/member.schedule.tsx");
    expect(config).not.toContain("./src/routes/_authenticated/member/schedule.tsx");
  });
});
