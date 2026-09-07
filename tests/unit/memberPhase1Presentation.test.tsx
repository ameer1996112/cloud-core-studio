import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  nextHomeBooking,
  sourceTextAttributes,
  membershipPresentation,
} from "../../src/lib/member-home-presentation";
import {
  MemberHomeContent,
  type MemberHomeData,
} from "../../src/components/member/MemberHomeContent";

describe("Phase 1 member presentation", () => {
  test("selects the earliest class without mutating the server's booking list", () => {
    const bookings = [
      { id: "later", class: { starts_at: "2026-09-10T12:00:00Z" } },
      { id: "sooner", class: { starts_at: "2026-09-08T12:00:00Z" } },
    ] as MemberHomeData["upcoming"];
    expect(nextHomeBooking(bookings)?.id).toBe("sooner");
    expect(bookings[0].id).toBe("later");
    expect(nextHomeBooking([])).toBeNull();
  });
  test("keeps Hebrew and Arabic source announcements readable in other interface locales", () => {
    expect(sourceTextAttributes("השבוע בסטודיו Cloud & Core")).toEqual({ lang: "he", dir: "rtl" });
    expect(sourceTextAttributes("أهلاً في Cloud & Core")).toEqual({ lang: "ar", dir: "rtl" });
    expect(sourceTextAttributes("Cloud & Core studio update")).toEqual({ dir: "auto" });
  });
  test("loading never presents balances or an empty account", () => {
    const html = renderToStaticMarkup(
      <MemberHomeContent isLoading isError={false} onRetry={() => {}} onOpenClass={() => {}} />,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("home-membership");
    expect(html).not.toContain("home-choose");
    expect(html).not.toContain(">0<");
  });
  test("failed and missing member data present a retry state, not zero credits", () => {
    for (const isError of [true, false]) {
      const html = renderToStaticMarkup(
        <MemberHomeContent
          isLoading={false}
          isError={isError}
          onRetry={() => {}}
          onOpenClass={() => {}}
        />,
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain("<button");
      expect(html).not.toContain("home-membership");
      expect(html).not.toContain(">0<");
    }
  });
});

describe("Studio Editorial entitlement presentation", () => {
  test("uses the existing unlimited convention, never null or zero balances", () => {
    const plan = (credits: number, name = "Studio") =>
      ({ plan: { credits, name } }) as MemberHomeData["activePlan"];
    expect(membershipPresentation(plan(999)).unlimited).toBe(true);
    expect(membershipPresentation(plan(20, "Unlimited month")).unlimited).toBe(true);
    expect(membershipPresentation(plan(0)).unlimited).toBe(false);
    expect(membershipPresentation(null).unlimited).toBe(false);
  });
  test("exposes a past validity date without changing the supplied data", () => {
    const plan = { expires_at: "2026-09-01T00:00:00Z" } as MemberHomeData["activePlan"];
    expect(membershipPresentation(plan, Date.parse("2026-09-06T00:00:00Z")).expired).toBe(true);
    expect(membershipPresentation(plan, Date.parse("2026-08-31T00:00:00Z")).expired).toBe(false);
    expect(plan?.expires_at).toBe("2026-09-01T00:00:00Z");
  });
});

describe("BookingPass status semantics", () => {
  test("a waitlisted pass never presents a confirmed badge", async () => {
    const { BookingPass } = await import("../../src/components/member/StudioClassItem");
    const { t } = await import("../../src/lib/i18n");
    const html = renderToStaticMarkup(
      <BookingPass
        cls={{
          id: "fixture",
          title: "Aerial",
          starts_at: "2026-09-08T15:30:00Z",
          duration_minutes: 55,
        }}
        state={{ kind: "waiting" }}
        action={<button>Details</button>}
      />,
    );
    expect(html).toContain(t("bookings.waitlisted"));
    expect(html).not.toContain(t("bookings.confirmed"));
  });
  test("cancelled and completed classes retain the existing non-confirmed state", async () => {
    const { deriveClassState } = await import("../../src/components/member/PremiumClassCard");
    const cls = { starts_at: "2026-09-08T15:30:00Z", duration_minutes: 55 };
    const context = { booked: true, waiting: false, remainingCredits: 8 };
    expect(deriveClassState({ ...cls, status: "cancelled" }, context).kind).toBe("cancelled");
    expect(deriveClassState({ ...cls, status: "completed" }, context).kind).toBe("closed");
  });
});
