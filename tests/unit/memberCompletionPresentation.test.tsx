import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemberPageState } from "../../src/components/member/MemberPageState";
import { ReservationRow } from "../../src/components/member/ReservationRow";
import { t } from "../../src/lib/i18n";

describe("member completion presentation boundaries", () => {
  test("query failures offer retry without rendering a fake empty member", () => {
    const html = renderToStaticMarkup(<MemberPageState title="Profile" error onRetry={() => {}} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain(t("common.retry"));
    expect(html).not.toContain("<input");
    expect(html).not.toContain(">0<");
  });
  test("loading exposes a status instead of editable empty fields", () => {
    const html = renderToStaticMarkup(
      <MemberPageState title="Profile" error={false} onRetry={() => {}} />,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("<input");
  });
  test("reservation row preserves explicit attendance and caller-owned policy/actions", () => {
    const html = renderToStaticMarkup(
      <ReservationRow
        cls={{
          id: "fixture",
          title: "Mixed תרגול تدريب",
          starts_at: "2026-09-08T15:30:00Z",
          duration_minutes: 55,
          capacity: 8,
          booked_count: 1,
          credit_cost: 2,
          instructor: { name: "Lina نور" },
        }}
        state={{ kind: "closed" }}
        statusLabel={t("bookings.noShow")}
        onOpen={() => {}}
        muted
      >
        <button disabled>Caller action pending</button>
        <p>Caller cancellation policy</p>
      </ReservationRow>,
    );
    expect(html).toContain(t("bookings.noShow"));
    expect(html).not.toContain(t("bookings.confirmed"));
    expect(html).toContain('disabled=""');
    expect(html).toContain("Caller cancellation policy");
    expect(html).toContain("Lina نور");
  });
});
