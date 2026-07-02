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

const baseClass = {
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
  program_type: { name_en: "Flow" },
};

const classesById = {
  "open-class": baseClass,
  "full-class": {
    ...baseClass,
    id: "full-class",
    title: "Full Class",
    booked_count: 10,
  },
};

const observedQueryKeys = [];
const observedQueryOptions = [];
const invalidateCalls = [];
const mutationConfigs = [];

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

mock.module("@tanstack/react-start", () => ({
  ...actualReactStart,
  useServerFn: () => () => Promise.resolve(null),
}));

mock.module("@tanstack/react-query", () => ({
  useQuery: (options) => {
    observedQueryOptions.push(options);
    const { queryKey } = options;
    observedQueryKeys.push(queryKey);
    const classId = queryKey.length >= 3 ? queryKey[2] : queryKey[1];

    return {
      data: {
        cls: classesById[classId],
        myBooking: null,
        myWaitlist: null,
        member: null,
        hasActivePackage: null,
      },
      isLoading: false,
    };
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

mock.module("@tanstack/react-router", () => ({
  ...actualRouter,
  Link: ({ to, children, ...props }) =>
    React.createElement("a", { href: String(to), ...props }, children),
  useNavigate: () => () => {},
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
  deriveClassState: () => ({ kind: "waitlist_available" }),
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

mock.module("@/lib/i18n", () => ({
  t: (key, params) => {
    const map = {
      "nav.schedule": "Schedule",
      "legal.support": "Support",
      "member.filter.level": "Level",
      "member.filter.energy": "Energy",
      "booking.details": "Booking details",
      "booking.bring": "Bring water",
      "common.close": "Close",
      "common.when": "When",
      "common.with": "With",
      "common.where": "Where",
      "common.room": "Room",
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
      "booking.notes": "Notes",
      "booking.registrationClosed": "Registration closed",
      "booking.viewMine": "View my bookings",
      "booking.leaveWaitlist": "Leave waitlist",
      "booking.joinWaitlist": "Join waitlist",
      "booking.choosePackage": "Choose package",
      "class.cta.topUpCredits": "Top up credits",
      "booking.bookCredit": "Book with credit",
      "booking.saving": "Saving",
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

mock.module("@/components/visual/VisualClassCard", () => ({
  LessonReservationCard: ({ title }) => React.createElement("div", {}, title ?? "reservation"),
  VisualClassCard: ({ cls, onOpen }) =>
    React.createElement("button", { type: "button", onClick: onOpen }, cls?.title ?? "Open"),
  ScheduleDaySection: ({ children }) => React.createElement("section", {}, children),
  ClassArtTile: () => React.createElement("div", { "data-testid": "art-tile" }),
  LessonAvailabilityMeter: () =>
    React.createElement("div", { "data-testid": "availability-meter" }, "Availability"),
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

describe("guest detail CTA branch", () => {
  test("keeps explicit guest detail scope guest-safe even if auth cache data exists", async () => {
    const detailModule = await import("../../src/components/member/ClassDetailSheet.tsx");

    expect(
      detailModule.resolveDetailViewerState({
        viewerContext: "guest",
        authViewerCacheKey: "member:member-1",
      }),
    ).toEqual({
      isGuestView: true,
      resolvedViewerCacheKey: "guest",
    });
  });

  test("renders the guest CTA branch for an open class", async () => {
    const detailModule = await import("../../src/components/member/ClassDetailSheet.tsx");
    const html = renderToStaticMarkup(
      React.createElement(detailModule.ClassDetailSheet, {
        classId: "open-class",
        open: true,
        onOpenChange: () => {},
        viewerContext: "guest",
      }),
    );

    expect(html).toContain("Sign in to book");
    expect(html).toContain("Guest browsing stays open");
    expect(html).not.toContain("Join waitlist");
    expect(html).not.toContain("Choose package");
    expect(html).not.toContain("Top up credits");
  });

  test("renders the guest full-class CTA without waitlist framing", async () => {
    const detailModule = await import("../../src/components/member/ClassDetailSheet.tsx");
    const html = renderToStaticMarkup(
      React.createElement(detailModule.ClassDetailSheet, {
        classId: "full-class",
        open: true,
        onOpenChange: () => {},
        viewerContext: "guest",
      }),
    );

    expect(html).toContain("Sign in for booking options");
    expect(html).toContain("This class is currently full");
    expect(html).not.toContain("Join waitlist");
    expect(html).not.toContain("Choose package");
    expect(html).not.toContain("Top up credits");
  });

  test("member booking invalidation does not miss the schedule when no explicit cache key exists", async () => {
    const detailModule = await import("../../src/components/member/ClassDetailSheet.tsx");

    invalidateCalls.length = 0;
    mutationConfigs.length = 0;

    renderToStaticMarkup(
      React.createElement(detailModule.ClassDetailSheet, {
        classId: "open-class",
        open: true,
        onOpenChange: () => {},
      }),
    );

    const bookMutation = mutationConfigs.find(
      (config) => typeof config?.onError === "function" && typeof config?.onSuccess === "function",
    );

    expect(bookMutation).toBeDefined();

    bookMutation.onSuccess({
      status: "booked",
      booking_id: "booking-1",
      remaining_credits: 4,
    });

    const scheduleInvalidation = invalidateCalls.find(
      (call) => call?.queryKey?.[0] === "member-schedule" || typeof call?.predicate === "function",
    );

    expect(scheduleInvalidation).toBeDefined();
    expect(scheduleInvalidation.queryKey).toBeUndefined();
    expect(
      scheduleInvalidation.predicate({ queryKey: ["member-schedule", "member:member-1"] }),
    ).toBe(true);
    expect(scheduleInvalidation.predicate({ queryKey: ["member-schedule", "guest"] })).toBe(false);
  });

  test("authenticated detail keeps the shared member pending key disabled", async () => {
    const detailModule = await import("../../src/components/member/ClassDetailSheet.tsx");

    observedQueryKeys.length = 0;
    observedQueryOptions.length = 0;

    renderToStaticMarkup(
      React.createElement(detailModule.ClassDetailSheet, {
        classId: "open-class",
        open: true,
        onOpenChange: () => {},
        viewerContext: "member",
      }),
    );

    expect(observedQueryKeys).toContainEqual(["class-detail", "member:pending", "open-class"]);
    expect(
      observedQueryOptions.find(
        (options) =>
          JSON.stringify(options?.queryKey) ===
          JSON.stringify(["class-detail", "member:pending", "open-class"]),
      )?.enabled,
    ).toBe(false);
  });
});
