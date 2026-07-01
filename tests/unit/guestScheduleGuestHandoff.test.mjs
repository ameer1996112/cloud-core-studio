import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as actualRouter from "../../node_modules/@tanstack/react-router/dist/cjs/index.cjs";
import * as actualReactStart from "../../node_modules/@tanstack/react-start/dist/esm/index.js";

const openClass = {
  id: "open-class",
  title: "Open Class",
  starts_at: "2026-07-03T09:00:00.000Z",
  duration_minutes: 50,
  capacity: 10,
  booked_count: 6,
  waitlist_count: 0,
  room: "Studio A",
  energy: "grounded",
  credit_cost: 1,
  cancellation_window_hours: 12,
  status: "scheduled",
  instructor: { name: "Maya" },
  program_type: { level: "All levels" },
  room_ref: { name: "Studio A" },
};

const fullClass = {
  ...openClass,
  id: "full-class",
  title: "Full Class",
  booked_count: 10,
};

mock.module("@tanstack/react-router", () => ({
  ...actualRouter,
  Link: ({ to, children, ...props }) =>
    React.createElement("a", { href: String(to), ...props }, children),
}));

mock.module("@tanstack/react-start", () => ({
  ...actualReactStart,
  useServerFn: () => () => Promise.resolve(null),
}));

mock.module("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }) => {
    if (queryKey[0] === "member-schedule") {
      return {
        data: {
          classes: [openClass, fullClass],
          member: null,
          bookingsByClass: {},
          waitlistByClass: {},
          hasActivePackage: null,
        },
        isLoading: false,
      };
    }

    return { data: null, isLoading: false };
  },
}));

mock.module("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe() {} } },
      }),
    },
  },
}));

mock.module("@/components/member/ClassDetailSheet", () => ({
  deriveGuestClassState: (cls) => {
    const spots = (cls.capacity ?? 0) - (cls.booked_count ?? 0);
    if (cls.status === "cancelled") return { kind: "cancelled" };
    if (cls.status !== "scheduled") return { kind: "closed" };
    if (spots <= 0) return { kind: "full" };
    if (spots <= 2) return { kind: "almost", spotsLeft: spots };
    return { kind: "available", spotsLeft: spots };
  },
  ClassDetailSheet: ({ viewerContext, open, classId }) =>
    React.createElement("div", {
      "data-testid": "class-detail-sheet",
      "data-viewer-context": viewerContext,
      "data-open": String(open),
      "data-class-id": classId ?? "",
    }),
}));

mock.module("@/components/member/PremiumClassCard", () => ({
  deriveClassState: (cls, ctx) => {
    if (ctx.booked) return { kind: "booked" };
    if (ctx.waiting) return { kind: "waiting" };
    const spots = (cls.capacity ?? 0) - (cls.booked_count ?? 0);
    if (spots <= 0) return { kind: "waitlist_available" };
    return { kind: "available", spotsLeft: spots };
  },
  MemberEmptyState: ({ title, body }) =>
    React.createElement("div", { "data-testid": "empty-state" }, `${title} ${body}`),
}));

mock.module("@/components/visual/VisualClassCard", () => ({
  VisualClassCard: ({ cls }) => React.createElement("button", {}, cls.title),
  ScheduleDaySection: ({ children }) => React.createElement("section", {}, children),
}));

mock.module("@/components/app-shell/AppShell", () => ({
  AppShell: ({ children }) => React.createElement("div", {}, children),
}));

mock.module("@/components/member/MemberScheduleFilterPanel", () => ({
  MemberScheduleFilterPanel: () => React.createElement("div", { "data-testid": "filters" }),
}));

mock.module("@/hooks/useDocumentTitle", () => ({
  useDocumentTitle: () => {},
}));

mock.module("@/lib/i18n", () => ({
  t: (key) => {
    const map = {
      "nav.schedule": "Schedule",
      "legal.support": "Support",
      "member.filter.level": "Level",
      "member.filter.energy": "Energy",
      "common.with": "With",
      "common.room": "Room",
      "member.stat.available": "Available",
      "member.stat.credits": "Credits",
      "member.schedule.kicker": "Schedule",
      "member.schedule.body": "Body",
      "member.empty.schedule.title": "No classes",
      "member.empty.schedule.body": "No schedule yet",
      "member.noSessions": "No sessions",
      "member.clearFilters": "Clear filters",
    };

    return map[key] ?? key;
  },
  useI18n: () => ({ lang: "en", dir: "ltr" }),
}));

mock.module("@/lib/localized-content", () => ({
  localizedClassTitle: (cls) => cls.title,
  localizedFilterLabel: (value) => value,
  localizedInstructorName: (value) => value,
  localizedRoomName: ({ name }) => name,
  localizedToneName: (value) => value,
}));

describe("guest schedule handoff", () => {
  test("renders the signed-out schedule with a guest detail handoff and guest-safe open count", async () => {
    const routeModule = await import("../../src/routes/member.schedule.tsx");
    const html = renderToStaticMarkup(
      React.createElement(routeModule.MemberScheduleContent, { session: null }),
    );

    expect(html).toContain('data-testid="class-detail-sheet"');
    expect(html).toContain('data-viewer-context="guest"');
    expect(html).toContain("Open classes");
    expect(html).toContain(">1<");
    expect(html).toContain("Open Class");
    expect(html).toContain("Full Class");
  });
});
