import { fileURLToPath } from "node:url";
import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as actualReact from "../../node_modules/react/index.js";
import * as actualRouter from "../../node_modules/@tanstack/react-router/dist/cjs/index.cjs";
import * as actualReactStart from "../../node_modules/@tanstack/react-start/dist/esm/index.js";

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

const classesById = {
  "open-class": openClass,
  "full-class": fullClass,
};

let selectedGuestClassId = null;
let useStateCallIndex = 0;
const detailQueryClassIds = [];
const renderedCardOpeners = [];

mock.module("react", () => ({
  ...actualReact,
  useEffect: () => {},
  useState: (initialValue) => {
    const callIndex = useStateCallIndex++;

    if (callIndex === 3) {
      return [
        selectedGuestClassId,
        (nextValue) => {
          selectedGuestClassId =
            typeof nextValue === "function" ? nextValue(selectedGuestClassId) : nextValue;
        },
      ];
    }

    return [typeof initialValue === "function" ? initialValue() : initialValue, () => {}];
  },
}));

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

    if (queryKey[0] === "class-detail") {
      detailQueryClassIds.push(queryKey[1] ?? null);

      return {
        data: queryKey[1]
          ? {
              cls: classesById[queryKey[1]],
              myBooking: null,
              myWaitlist: null,
              member: null,
              hasActivePackage: null,
            }
          : null,
        isLoading: false,
      };
    }

    return { data: null, isLoading: false };
  },
  useMutation: () => ({ mutate() {}, isPending: false }),
  useQueryClient: () => ({ invalidateQueries() {} }),
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
  getClassDetail: {},
  joinWaitlist: {},
  leaveWaitlist: {},
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
  VisualClassCard: ({ cls, onOpen }) => {
    renderedCardOpeners.push({ classId: cls.id, onOpen });
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
      "member.oneCredit": "1 credit",
    };

    if (key === "booking.cancelWindow") return `Cancel ${String(params?.hours ?? "")}`;
    return map[key] ?? key;
  },
  useI18n: () => ({ lang: "en", dir: "ltr" }),
}));

mock.module("@/lib/localized-content", () => ({
  localizedClassMetadataChips: () => ["Flow", "Studio"],
  localizedClassTitle: (cls) => cls.title,
  localizedClassTitleParts: (cls) => ({ brand: "Cloud & Core", program: cls.title }),
  localizedFilterLabel: (value) => value,
  localizedInstructorName: (value) => value,
  localizedOptionalInstructorName: (name) => name ?? null,
  localizedProgramDescription: () => "Program description",
  localizedRoomName: ({ name }) => name,
  localizedToneName: (value) => value,
}));

mock.module("@/components/ui/bidi", () => ({
  LtrInline: ({ children }) => React.createElement(React.Fragment, {}, children),
  MixedLessonTitle: ({ program, ...props }) => React.createElement("h2", props, program),
}));

mock.module("@/lib/messageTemplate", () => ({
  buildIcs: () => "",
  downloadIcs: () => Promise.resolve(),
}));

mock.module("@/lib/lesson-card-variants", () => ({
  formatDuration: () => "50 min",
  formatSpots: (spotsLeft, capacity) => `${spotsLeft}/${capacity} spots`,
  getArtTileVariant: () => "a",
  getFriendlyStudioLocation: () => "Cloud & Core Studio",
  getLessonVisualMode: () => "artTile",
}));

mock.module("@/lib/image-assets", () => ({
  resolveClassImagePosition: () => "center center",
}));

function renderGuestSchedule(routeModule) {
  useStateCallIndex = 0;
  return renderToStaticMarkup(
    React.createElement(routeModule.MemberScheduleContent, { session: null }),
  );
}

describe("guest schedule handoff", () => {
  test("connects a signed-out schedule card open to the real guest-safe detail CTA", async () => {
    const routeModule = await import("../../src/routes/member.schedule.tsx");

    selectedGuestClassId = null;
    detailQueryClassIds.length = 0;
    renderedCardOpeners.length = 0;

    const initialHtml = renderGuestSchedule(routeModule);

    expect(initialHtml).toContain("Open classes");
    expect(initialHtml).toContain(">1<");
    expect(renderedCardOpeners.map((card) => card.classId)).toEqual(["open-class", "full-class"]);

    renderedCardOpeners[0].onOpen();
    expect(selectedGuestClassId).toBe("open-class");

    detailQueryClassIds.length = 0;
    const rerenderedHtml = renderGuestSchedule(routeModule);

    expect(detailQueryClassIds).toEqual(["open-class"]);
    expect(rerenderedHtml).toContain("Open Class");
    expect(rerenderedHtml).toContain("Sign in to book");
    expect(rerenderedHtml).toContain("Guest browsing stays open");
    expect(rerenderedHtml).not.toContain("Join waitlist");
    expect(rerenderedHtml).not.toContain("Choose package");
    expect(rerenderedHtml).not.toContain("Top up credits");
  });
});
