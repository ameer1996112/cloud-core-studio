import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemberScheduleView } from "../../src/components/member/MemberScheduleView";
import { ClassDetailContent } from "../../src/components/member/ClassDetailContent";
import { t } from "../../src/lib/i18n";

describe("Aura presentation data boundaries", () => {
  test("schedule loading has no fabricated balance or availability count", () => {
    const html = renderToStaticMarkup(
      <MemberScheduleView session isLoading openClass={null} setOpenClass={() => {}} />,
    );
    expect(html).toContain("skeleton-brand");
    expect(html).not.toContain("aura-schedule-totals");
    expect(html).not.toContain(">0<");
  });
  test("schedule errors expose retry instead of the no-classes message", () => {
    const html = renderToStaticMarkup(
      <MemberScheduleView
        session
        isLoading={false}
        isError
        onRetry={() => {}}
        openClass={null}
        setOpenClass={() => {}}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain(t("common.retry"));
    expect(html).not.toContain(t("member.empty.schedule.title"));
    expect(html).not.toContain("aura-schedule-totals");
  });
  test("detail keeps supplied policy, facts and caller action together", () => {
    const html = renderToStaticMarkup(
      <ClassDetailContent
        cls={{
          id: "fixture",
          title: "Long studio class",
          starts_at: "2026-09-08T15:30:00Z",
          duration_minutes: 55,
          capacity: 8,
          booked_count: 3,
          cancellation_window_hours: 7,
          credit_cost: 2,
          instructor: { name: "Lina نور" },
        }}
        state={{ kind: "waiting" }}
        action={<button disabled>Caller-owned pending action</button>}
      />,
    );
    expect(html).toContain(t("booking.cancelWindow", { hours: 7 }));
    expect(html).toContain("Lina نور");
    expect(html).toContain(t("bookings.waitlisted"));
    expect(html).not.toContain(t("bookings.confirmed"));
    expect(html).toContain('disabled=""');
    expect(html).toContain("Caller-owned pending action");
  });
});
