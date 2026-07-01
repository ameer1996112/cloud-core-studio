import { fileURLToPath } from "node:url";
import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

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
  useServerFn: () => () => Promise.resolve(null),
}));

mock.module("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }) => ({
    data: {
      cls: classesById[queryKey[1]],
      myBooking: null,
      myWaitlist: null,
      member: null,
      hasActivePackage: null,
    },
    isLoading: false,
  }),
  useMutation: () => ({ mutate() {}, isPending: false }),
  useQueryClient: () => ({ invalidateQueries() {} }),
}));

mock.module("@tanstack/react-router", () => ({
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
  deriveClassState: () => ({ kind: "waitlist_available" }),
  formatTime: () => "09:00",
  formatDate: () => "Thu, Jul 3",
};

mock.module("@/components/member/PremiumClassCard", () => premiumCardMock);
mock.module(premiumClassCardPath, () => premiumCardMock);

mock.module("@/lib/i18n", () => ({
  t: (key, params) => {
    const map = {
      "booking.details": "Booking details",
      "booking.bring": "Bring water",
      "common.close": "Close",
      "common.when": "When",
      "common.with": "With",
      "common.where": "Where",
      "common.spots": "Spots",
      "common.credits": "Credits",
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
  useI18n: () => ({ lang: "en", dir: "ltr" }),
}));

mock.module("@/lib/localized-content", () => ({
  localizedClassMetadataChips: () => ["Flow", "Studio"],
  localizedClassTitle: (cls) => cls.title,
  localizedClassTitleParts: (cls) => ({ brand: "Cloud & Core", program: cls.title }),
  localizedOptionalInstructorName: (name) => name ?? null,
  localizedProgramDescription: () => "Program description",
}));

mock.module("@/components/ui/bidi", () => ({
  LtrInline: ({ children }) => React.createElement(React.Fragment, {}, children),
  MixedLessonTitle: ({ program, ...props }) => React.createElement("h2", props, program),
}));

mock.module("@/lib/messageTemplate", () => ({
  buildIcs: () => "",
  downloadIcs: () => Promise.resolve(),
}));

mock.module("@/components/visual/VisualClassCard", () => ({
  ClassArtTile: () => React.createElement("div", { "data-testid": "art-tile" }),
  LessonAvailabilityMeter: () =>
    React.createElement("div", { "data-testid": "availability-meter" }, "Availability"),
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

describe("guest detail CTA branch", () => {
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
});
