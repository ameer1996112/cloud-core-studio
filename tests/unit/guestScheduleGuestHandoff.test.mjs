import { fileURLToPath } from "node:url";
import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as actualRouter from "@tanstack/react-router";
import * as actualReactStart from "@tanstack/react-start";
import * as actualLessonCardVariants from "../../src/lib/lesson-card-variants.ts";
import * as actualLocalizedContent from "../../src/lib/localized-content.ts";

const premiumClassCardPath = fileURLToPath(
  new URL("../../src/components/member/PremiumClassCard.tsx", import.meta.url),
);

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
  program_type: { level: "All levels", name_en: "Flow" },
  room_ref: { name: "Studio A" },
};

const fullClass = {
  ...openClass,
  id: "full-class",
  title: "Full Class",
  booked_count: 10,
};

const guestSession = null;
const memberSession = { user: { id: "member-1" } };
const observedQueryKeys = [];
const renderedCardOpeners = [];
const renderedCardStates = [];
const invalidateCalls = [];
const mutationConfigs = [];

const scheduleDataByScope = {
  guest: {
    classes: [openClass, fullClass],
    member: null,
    bookingsByClass: {},
    waitlistByClass: {},
    hasActivePackage: null,
  },
  "member:member-1": {
    classes: [openClass, fullClass],
    member: { remaining_credits: 7 },
    bookingsByClass: {},
    waitlistByClass: {},
    hasActivePackage: true,
  },
  legacy: {
    classes: [openClass, fullClass],
    member: null,
    bookingsByClass: {},
    waitlistByClass: {},
    hasActivePackage: null,
  },
};

const detailDataByScope = {
  guest: {
    "open-class": {
      cls: openClass,
      myBooking: null,
      myWaitlist: null,
      member: null,
      hasActivePackage: null,
    },
  },
  "member:member-1": {
    "open-class": {
      cls: openClass,
      myBooking: { status: "booked", id: "booking-1" },
      myWaitlist: null,
      member: { remaining_credits: 7 },
      hasActivePackage: true,
    },
  },
  legacy: {
    "open-class": {
      cls: openClass,
      myBooking: null,
      myWaitlist: null,
      member: null,
      hasActivePackage: null,
    },
  },
};

mock.module("@tanstack/react-router", () => ({
  ...actualRouter,
  Link: ({ to, children, ...props }) =>
    React.createElement("a", { href: String(to), ...props }, children),
  useNavigate: () => () => {},
}));

mock.module("@tanstack/react-start", () => ({
  ...actualReactStart,
  useServerFn: () => () => Promise.resolve(null),
}));

mock.module("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }) => {
    observedQueryKeys.push(queryKey);

    if (queryKey[0] === "member-schedule") {
      return {
        data: scheduleDataByScope[queryKey[1] ?? "legacy"] ?? scheduleDataByScope.legacy,
        isLoading: false,
      };
    }

    if (queryKey[0] === "class-detail") {
      const usesScopedKey = queryKey.length >= 3;
      const scope = usesScopedKey ? queryKey[1] : "legacy";
      const classId = usesScopedKey ? queryKey[2] : queryKey[1];

      return {
        data: classId ? (detailDataByScope[scope]?.[classId] ?? null) : null,
        isLoading: false,
      };
    }

    if (queryKey[0] === "my-bookings-all") {
      return {
        data: {
          bookings: [],
          attendanceByBooking: {},
          waitlist: [],
        },
        isLoading: false,
      };
    }

    if (queryKey[0] === "public-studio-settings") {
      return { data: null, isLoading: false };
    }

    return { data: null, isLoading: false };
  },
  useMutation: (config) => {
    mutationConfigs.push(config);
    return { mutate() {}, isPending: false };
  },
  useQueryClient: () => ({
    invalidateQueries: (options) => {
      invalidateCalls.push(options);
    },
  }),
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

mock.module("@/components/ui/dialog", () => ({
  Dialog: ({ children }) => React.createElement("div", { "data-testid": "dialog" }, children),
  DialogContent: ({ children }) =>
    React.createElement("div", { "data-testid": "dialog-content" }, children),
  DialogDescription: ({ children }) =>
    React.createElement("div", { "data-testid": "dialog-description" }, children),
  DialogTitle: ({ children }) =>
    React.createElement("div", { "data-testid": "dialog-title" }, children),
}));

mock.module("@/lib/member.functions", () => ({
  listAvailableClasses: {},
  getMyBookingsAll: {},
  memberCancelBooking: {},
  getClassDetail: {},
  joinWaitlist: {},
  leaveWaitlist: {},
}));

mock.module("@/lib/studioSettings.functions", () => ({
  getPublicStudioSettings: {},
}));

mock.module("@/lib/cloud-core.functions", () => ({
  bookClass: {},
}));

mock.module("sonner", () => ({
  toast: Object.assign(() => {}, { success() {}, error() {} }),
}));

const premiumCardMock = {
  ClassImage: () => React.createElement("div", { "data-testid": "class-image" }),
  StateBadge: ({ state }) =>
    React.createElement("div", { "data-testid": "state-badge" }, state.kind),
  deriveClassState: (cls, ctx) => {
    if (ctx.booked) return { kind: "booked" };
    if (ctx.waiting) return { kind: "waiting" };
    const spots = (cls.capacity ?? 0) - (cls.booked_count ?? 0);
    if (spots <= 0) return { kind: "waitlist_available" };
    return { kind: "available", spotsLeft: spots };
  },
  formatTime: () => "09:00",
  formatDate: () => "Thu, Jul 3",
};

const MemberEmptyState = ({ title, body }) =>
  React.createElement("div", { "data-testid": "empty-state" }, `${title} ${body}`);

mock.module("@/components/member/PremiumClassCard", () => ({
  ...premiumCardMock,
  MemberEmptyState,
}));
mock.module(premiumClassCardPath, () => ({ ...premiumCardMock, MemberEmptyState }));

mock.module("@/components/visual/VisualClassCard", () => ({
  LessonReservationCard: ({ title }) => React.createElement("div", {}, title ?? "reservation"),
  VisualClassCard: ({ cls, state, onOpen }) => {
    renderedCardOpeners.push({ classId: cls.id, onOpen });
    renderedCardStates.push({ classId: cls.id, state });
    return React.createElement("button", { type: "button", onClick: onOpen }, cls.title);
  },
  ScheduleDaySection: ({ children }) => React.createElement("section", {}, children),
  ClassArtTile: () => React.createElement("div", { "data-testid": "art-tile" }),
  LessonAvailabilityMeter: () =>
    React.createElement("div", { "data-testid": "availability-meter" }, "Availability"),
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
  t: (key, params) => {
    const map = {
      "nav.schedule": "Schedule",
      "legal.support": "Support",
      "member.filter.level": "Level",
      "member.filter.energy": "Energy",
      "common.with": "With",
      "common.where": "Where",
      "common.room": "Room",
      "common.close": "Close",
      "common.when": "When",
      "common.spots": "Spots",
      "common.credits": "Credits",
      "member.stat.available": "Available",
      "member.stat.credits": "Credits",
      "member.schedule.kicker": "Schedule",
      "member.schedule.body": "Body",
      "member.empty.schedule.title": "No classes",
      "member.empty.schedule.body": "No schedule yet",
      "member.noSessions": "No sessions",
      "member.clearFilters": "Clear filters",
      "booking.details": "Booking details",
      "booking.bring": "Bring water",
      "booking.registrationClosed": "Registration closed",
      "booking.viewMine": "View my bookings",
      "member.oneCredit": "1 credit",
    };

    if (key === "booking.cancelWindow") return `Cancel ${String(params?.hours ?? "")}`;
    return map[key] ?? key;
  },
  getLocale: () => "en",
  useI18n: () => ({ lang: "en", dir: "ltr" }),
}));

mock.module("@/lib/localized-content", () => ({
  ...actualLocalizedContent,
  localizedClassTitle: (cls) => cls.title,
  localizedClassTitleParts: (cls) => ({ brand: "Cloud & Core", program: cls.title }),
  localizedFilterLabel: (value) => value,
  localizedInstructorName: (value) => value,
  localizedOptionalInstructorName: (name) => name ?? null,
  localizedProgramDescription: () => "Program description",
  localizedRoomName: ({ name }) => name,
}));

mock.module("@/components/ui/bidi", () => ({
  LtrInline: ({ children }) => React.createElement(React.Fragment, {}, children),
  MixedLessonTitle: ({ program, ...props }) => React.createElement("h2", props, program),
}));

mock.module("@/lib/messageTemplate", () => ({
  buildIcs: () => "",
  downloadIcs: () => Promise.resolve(),
  waUrl: () => "https://wa.example.test",
}));

mock.module("@/lib/lesson-card-variants", () => ({
  ...actualLessonCardVariants,
  getFriendlyStudioLocation: () => "Cloud & Core Studio",
}));

mock.module("@/lib/image-assets", () => ({
  studioImages: {
    atmosphere: { src: "/studio-atmosphere.webp", alt_en: "Studio" },
  },
  localizedAlt: () => "Studio",
  resolveClassImagePosition: () => "center center",
}));

function renderPublicRoute(routeModule, { session, selectedClassId, onSelectedClassChange }) {
  return renderToStaticMarkup(
    React.createElement(routeModule.Route.options.component, {
      authSnapshot: { initialized: true, session },
      selectedClassId,
      onSelectedClassChange,
    }),
  );
}

describe("guest schedule handoff", () => {
  test("renders a hydration-safe placeholder before session probing completes", async () => {
    const routeModule = await import("../../src/routes/member.schedule.tsx");

    const html = renderToStaticMarkup(React.createElement(routeModule.Route.options.component));

    expect(html).toContain("skeleton-brand");
    expect(html).not.toContain("Guest schedule preview");
  });

  test("separates guest and member schedule/detail query scopes across the real public route", async () => {
    const routeModule = await import("../../src/routes/member.schedule.tsx");
    let selectedClassId = null;

    observedQueryKeys.length = 0;
    renderedCardOpeners.length = 0;
    renderedCardStates.length = 0;

    const guestHtml = renderPublicRoute(routeModule, {
      session: guestSession,
      selectedClassId,
      onSelectedClassChange: (nextValue) => {
        selectedClassId = nextValue;
      },
    });

    expect(guestHtml).toContain("Guest schedule preview");
    expect(observedQueryKeys).toContainEqual(["member-schedule", "guest"]);
    expect(guestHtml).toContain("Open classes");
    expect(guestHtml).toContain(">1<");
    expect(renderedCardStates).toContainEqual({
      classId: "open-class",
      state: { kind: "available", spotsLeft: 4 },
    });
    expect(renderedCardStates).toContainEqual({ classId: "full-class", state: { kind: "full" } });

    const openClassCard = renderedCardOpeners.find(({ classId }) => classId === "open-class");
    expect(openClassCard).toBeDefined();
    openClassCard.onOpen();
    expect(selectedClassId).toBe("open-class");

    observedQueryKeys.length = 0;
    const guestDetailHtml = renderPublicRoute(routeModule, {
      session: guestSession,
      selectedClassId,
      onSelectedClassChange: (nextValue) => {
        selectedClassId = nextValue;
      },
    });

    expect(observedQueryKeys).toContainEqual(["member-schedule", "guest"]);
    expect(observedQueryKeys).toContainEqual(["class-detail", "guest", "open-class"]);
    expect(guestDetailHtml).toContain("Sign in to book");
    expect(guestDetailHtml).toContain("Guest browsing stays open");
    expect(guestDetailHtml).toContain(
      'href="/auth?returnTo=%2Fmember%2Fschedule%3FclassId%3Dopen-class"',
    );

    observedQueryKeys.length = 0;
    const memberHtml = renderPublicRoute(routeModule, {
      session: memberSession,
      selectedClassId,
      onSelectedClassChange: (nextValue) => {
        selectedClassId = nextValue;
      },
    });

    expect(memberHtml).not.toContain("Guest schedule preview");
    expect(observedQueryKeys).toContainEqual(["member-schedule", "member:member-1"]);
    expect(observedQueryKeys).toContainEqual(["class-detail", "member:member-1", "open-class"]);
    expect(memberHtml).toContain("Credits");
    expect(memberHtml).toContain(">7<");
    expect(memberHtml).toContain("View my bookings");
    expect(memberHtml).not.toContain("Sign in to book");
  });

  test("member booking cancellation invalidates scoped member schedule queries", async () => {
    const bookingsModule = await import("../../src/routes/_authenticated/member/bookings.tsx");

    invalidateCalls.length = 0;
    mutationConfigs.length = 0;

    renderToStaticMarkup(React.createElement(bookingsModule.Route.options.component));

    expect(mutationConfigs.length).toBeGreaterThan(0);

    const cancelMutation = mutationConfigs.find((config) => {
      invalidateCalls.length = 0;
      config.onSuccess?.({ status: "cancelled" });
      return invalidateCalls.some(
        (call) => JSON.stringify(call?.queryKey) === JSON.stringify(["member-home"]),
      );
    });

    expect(cancelMutation).toBeDefined();

    expect(invalidateCalls).toContainEqual({ queryKey: ["my-bookings-all"] });
    expect(invalidateCalls).toContainEqual({ queryKey: ["member-home"] });

    const scheduleInvalidation = invalidateCalls.find(
      (call) => typeof call?.predicate === "function",
    );

    expect(scheduleInvalidation).toBeDefined();
    expect(
      scheduleInvalidation.predicate({ queryKey: ["member-schedule", "member:member-1"] }),
    ).toBe(true);
    expect(scheduleInvalidation.predicate({ queryKey: ["member-schedule", "guest"] })).toBe(false);
  });
});
