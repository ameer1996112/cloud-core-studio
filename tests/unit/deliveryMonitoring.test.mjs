import { describe, expect, test } from "bun:test";
import {
  buildDeliveryMonitorPage,
  classifyDeliveryTraffic,
  deliveryFailureReason,
  deliveryEventLabel,
  deliveryOutcomeKind,
  deliveryPolicyReason,
  deliveryRangeForPreset,
  filterDeliveryRows,
  groupDeliveryMoments,
  isDeliveryRetryCandidate,
  paginateDeliveryMoments,
  summarizeDeliveries,
  summarizeDeliveriesByTraffic,
} from "../../src/lib/deliveryMonitoring.ts";

function delivery(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    message_id: crypto.randomUUID(),
    channel: "push",
    provider: "apns",
    status: "sent",
    provider_status: null,
    attempt_count: 1,
    failure_class: null,
    error_code: null,
    error_message: null,
    scheduled_for: "2026-07-22T09:00:00.000Z",
    next_attempt_at: null,
    expires_at: null,
    accepted_at: null,
    sent_at: "2026-07-22T09:00:01.000Z",
    delivered_at: null,
    read_at: null,
    failed_at: null,
    created_at: "2026-07-22T09:00:00.000Z",
    updated_at: "2026-07-22T09:00:01.000Z",
    traffic_kind: "live",
    recipient_contact: "••• 0001",
    attempts: [],
    targets: [],
    message: {
      id: crypto.randomUUID(),
      event_type: "booking_confirmed",
      subject: "Booking confirmed",
      member_id: "member-1",
      language: "en",
      template_key: "booking_confirmed",
      template_version: "v2",
      created_at: "2026-07-22T09:00:00.000Z",
      recipient_name: "Noa Levy",
      member: {
        id: "member-1",
        name: "Noa Levy",
        phone: "+972500000001",
        email: "noa@example.com",
        preferred_language: "he",
        status: "active",
      },
    },
    ...overrides,
  };
}

describe("delivery monitoring", () => {
  test("presents reminder events as customer-facing reminders, not internal planning", () => {
    expect(deliveryEventLabel("class_reminder_planning", "he")).toBe("תזכורת לשיעור");
    expect(deliveryEventLabel("class_reminder_planning", "ar")).toBe("تذكير بالحصة");
    expect(deliveryEventLabel("class_reminder_planning", "en")).toBe("Class reminder");
  });

  test("explains why a fallback channel was intentionally skipped", () => {
    expect(deliveryPolicyReason("push_preferred_for_fallback_channel", "he")).toBe(
      "WhatsApp גיבוי לא נדרש · Push פעיל",
    );
    expect(deliveryPolicyReason("no_active_push_device", "he")).toBe("אין מכשיר פעיל");
    expect(deliveryPolicyReason("whatsapp_opted_out", "he")).toBe("WhatsApp כבוי ללקוחה");
  });

  test("separates provider handoff from provider-confirmed delivery", () => {
    const rows = [
      delivery({ status: "sent" }),
      delivery({ status: "delivered" }),
      delivery({ status: "read" }),
      delivery({ status: "suppressed" }),
      delivery({ status: "dead_letter" }),
    ];
    expect(summarizeDeliveries(rows)).toEqual({
      total: 5,
      successfulHandoffs: 3,
      providerConfirmed: 2,
      needsAttention: 1,
      inFlight: 0,
      policySkipped: 1,
      membersReached: 1,
    });
  });

  test("searches member identity, contact, subject and event", () => {
    const rows = [delivery(), delivery({ id: "other", message: null, recipient_contact: null })];
    for (const query of ["noa", "0001", "example.com", "confirmed", "booking_"]) {
      expect(
        filterDeliveryRows(rows, {
          query,
          traffic: "all",
          channel: "all",
          status: "all",
          memberId: null,
        }),
      ).toHaveLength(1);
    }
  });

  test("keeps a masked recipient snapshot searchable after the member record is gone", () => {
    const rows = [
      delivery({
        recipient_contact: "n•••@example.com",
        message: {
          ...delivery().message,
          member: null,
          recipient_name: "Noa Levy",
        },
      }),
    ];
    for (const query of ["noa", "example.com"]) {
      expect(
        filterDeliveryRows(rows, {
          query,
          traffic: "all",
          channel: "all",
          status: "all",
          memberId: null,
        }),
      ).toHaveLength(1);
    }
  });

  test("combines member, channel and attention filters", () => {
    const rows = [
      delivery({ status: "failed", channel: "email" }),
      delivery({ status: "sent", channel: "push" }),
      delivery({
        status: "dead_letter",
        channel: "email",
        message: {
          ...delivery().message,
          member_id: "member-2",
          member: { ...delivery().message.member, id: "member-2" },
        },
      }),
    ];
    expect(
      filterDeliveryRows(rows, {
        query: "",
        traffic: "all",
        channel: "email",
        status: "attention",
        memberId: "member-1",
      }),
    ).toHaveLength(1);
  });

  test("classifies live, staff-test, system and historical traffic without exposing message content", () => {
    expect(classifyDeliveryTraffic({ aggregateType: "notification_staff_test" })).toBe("test");
    expect(classifyDeliveryTraffic({ staffTest: true, audience: "admin" })).toBe("test");
    expect(classifyDeliveryTraffic({ audience: "admin" })).toBe("system");
    expect(classifyDeliveryTraffic({ eventType: "delivery_failure" })).toBe("system");
    expect(classifyDeliveryTraffic({ templateVersion: "legacy" })).toBe("historical");
    expect(classifyDeliveryTraffic({ legacySourceTable: "member_notifications" })).toBe(
      "historical",
    );
    expect(classifyDeliveryTraffic({ eventType: "booking_confirmed" })).toBe("live");
  });

  test("keeps test and system activity out of live KPIs and live filtering", () => {
    const rows = [
      delivery({ status: "delivered", traffic_kind: "live" }),
      delivery({ status: "dead_letter", traffic_kind: "test" }),
      delivery({ status: "delivered", traffic_kind: "system" }),
      delivery({ status: "queued", traffic_kind: "historical" }),
    ];
    const summaries = summarizeDeliveriesByTraffic(rows);
    expect(summaries.live.total).toBe(1);
    expect(summaries.live.needsAttention).toBe(0);
    expect(summaries.test.needsAttention).toBe(1);
    expect(summaries.system.total).toBe(1);
    expect(summaries.historical.total).toBe(1);
    expect(summaries.all.total).toBe(4);
    expect(
      filterDeliveryRows(rows, {
        query: "",
        traffic: "live",
        channel: "all",
        status: "all",
        memberId: null,
      }),
    ).toHaveLength(1);
  });

  test("never presents ambiguous, suppressed, permanent or expired deliveries as retryable", () => {
    const now = new Date("2026-07-22T10:00:00.000Z");
    expect(
      isDeliveryRetryCandidate(delivery({ status: "failed", failure_class: "transient" }), now),
    ).toBe(true);
    expect(
      isDeliveryRetryCandidate(
        delivery({ status: "delivery_unknown", failure_class: "ambiguous" }),
        now,
      ),
    ).toBe(false);
    expect(isDeliveryRetryCandidate(delivery({ status: "suppressed" }), now)).toBe(false);
    expect(
      isDeliveryRetryCandidate(
        delivery({ status: "dead_letter", failure_class: "permanent" }),
        now,
      ),
    ).toBe(false);
    expect(
      isDeliveryRetryCandidate(
        delivery({ status: "failed", expires_at: "2026-07-22T09:59:00.000Z" }),
        now,
      ),
    ).toBe(false);
  });

  test("builds rolling and Jerusalem calendar ranges without losing the DST boundary", () => {
    expect(deliveryRangeForPreset({ preset: "24h" }, new Date("2026-08-08T12:00:00.000Z"))).toEqual(
      {
        from: "2026-08-07T12:00:00.000Z",
        to: "2026-08-08T12:00:00.000Z",
      },
    );
    expect(deliveryRangeForPreset({ preset: "7d" }, new Date("2026-08-08T12:00:00.000Z"))).toEqual({
      from: "2026-08-01T21:00:00.000Z",
      to: "2026-08-08T12:00:00.000Z",
    });
    expect(
      deliveryRangeForPreset(
        { preset: "custom", customFrom: "2026-03-27", customTo: "2026-03-27" },
        new Date("2026-04-01T00:00:00.000Z"),
      ),
    ).toEqual({
      from: "2026-03-26T22:00:00.000Z",
      to: "2026-03-27T21:00:00.000Z",
    });
  });

  test("keeps event creation separate from a later provider status update", () => {
    const messageId = crypto.randomUUID();
    const moments = groupDeliveryMoments([
      delivery({
        id: "email",
        message_id: messageId,
        channel: "email",
        updated_at: "2026-07-28T20:41:19.556Z",
        message: {
          ...delivery().message,
          id: messageId,
          created_at: "2026-07-28T13:25:12.234Z",
        },
      }),
      delivery({
        id: "in-app",
        message_id: messageId,
        channel: "in_app",
        updated_at: "2026-07-28T13:25:21.795Z",
        message: {
          ...delivery().message,
          id: messageId,
          created_at: "2026-07-28T13:25:12.234Z",
        },
      }),
    ]);

    expect(moments).toHaveLength(1);
    expect(moments[0].eventAt).toBe("2026-07-28T13:25:12.234Z");
    expect(moments[0].latestAt).toBe("2026-07-28T20:41:19.556Z");
  });

  test("paginates customer moments by stable message cursor without duplicates", () => {
    const rows = Array.from({ length: 27 }, (_, index) =>
      delivery({
        id: `delivery-${index}`,
        message_id: `message-${String(index).padStart(2, "0")}`,
        created_at: new Date(Date.UTC(2026, 6, 27, 12, 0, 27 - index)).toISOString(),
        updated_at: new Date(Date.UTC(2026, 6, 27, 12, 0, 27 - index)).toISOString(),
        message: {
          ...delivery().message,
          id: `message-${String(index).padStart(2, "0")}`,
          created_at: new Date(Date.UTC(2026, 6, 27, 12, 0, 27 - index)).toISOString(),
        },
      }),
    );
    const moments = groupDeliveryMoments(rows);
    const first = paginateDeliveryMoments(moments, null, 25);
    const second = paginateDeliveryMoments(moments, first.nextCursor, 25);

    expect(first.items).toHaveLength(25);
    expect(second.items).toHaveLength(2);
    expect(new Set([...first.items, ...second.items].map((moment) => moment.messageId)).size).toBe(
      27,
    );
    expect(second.nextCursor).toBeNull();
  });

  test("continues from cursor ordering keys when the cursor row leaves a live filter", () => {
    const moments = groupDeliveryMoments([
      delivery({
        message_id: "message-new",
        message: {
          ...delivery().message,
          id: "message-new",
          created_at: "2026-07-27T12:00:03.000Z",
        },
      }),
      delivery({
        message_id: "message-middle",
        message: {
          ...delivery().message,
          id: "message-middle",
          created_at: "2026-07-27T12:00:02.000Z",
        },
      }),
      delivery({
        message_id: "message-old",
        message: {
          ...delivery().message,
          id: "message-old",
          created_at: "2026-07-27T12:00:01.000Z",
        },
      }),
    ]);
    const first = paginateDeliveryMoments(moments, null, 2);
    const withoutCursorRow = moments.filter((moment) => moment.messageId !== "message-middle");
    const second = paginateDeliveryMoments(withoutCursorRow, first.nextCursor, 2);

    expect(second.items.map((moment) => moment.messageId)).toEqual(["message-old"]);
  });

  test("separates expected policy skips from actionable provider failures", () => {
    expect(deliveryOutcomeKind(delivery({ status: "suppressed" }))).toBe("expected_skip");
    expect(deliveryOutcomeKind(delivery({ status: "expired" }))).toBe("expected_skip");
    expect(deliveryOutcomeKind(delivery({ status: "expired", failure_class: "transient" }))).toBe(
      "failure",
    );
    expect(deliveryOutcomeKind(delivery({ status: "dead_letter" }))).toBe("failure");
    expect(deliveryOutcomeKind(delivery({ status: "delivery_unknown" }))).toBe("failure");
    expect(deliveryOutcomeKind(delivery({ status: "delivered" }))).toBe("successful");
  });

  test("counts a provider failure that expired as attention, not a policy skip", () => {
    expect(
      summarizeDeliveries([
        delivery({ status: "expired", failure_class: "transient" }),
        delivery({ status: "expired", failure_class: null }),
      ]),
    ).toMatchObject({ needsAttention: 1, policySkipped: 1 });
  });

  test("translates known permanent provider failures into actionable reasons", () => {
    expect(
      deliveryFailureReason(
        delivery({
          channel: "whatsapp",
          status: "dead_letter",
          failure_class: "permanent",
          error_message: "(#132018) There’s an issue with the parameters in your template",
        }),
      ),
    ).toBe("whatsapp_template_parameter_mismatch");
    expect(
      deliveryFailureReason(
        delivery({
          channel: "email",
          status: "dead_letter",
          failure_class: "permanent",
          error_message: "resend_bounced",
        }),
      ),
    ).toBe("email_bounced");
  });

  test("builds exact server pages from the selected range and filter set", () => {
    const rows = Array.from({ length: 27 }, (_, index) => {
      const messageId = `message-${String(index).padStart(2, "0")}`;
      const eventAt = new Date(Date.UTC(2026, 6, 27, 12, 0, 27 - index)).toISOString();
      return [
        delivery({
          id: `in-app-${index}`,
          message_id: messageId,
          channel: "in_app",
          status: "delivered",
          created_at: eventAt,
          updated_at: eventAt,
          message: { ...delivery().message, id: messageId, created_at: eventAt },
        }),
        delivery({
          id: `push-${index}`,
          message_id: messageId,
          channel: "push",
          status: index === 0 ? "dead_letter" : "sent",
          failure_class: index === 0 ? "permanent" : null,
          created_at: eventAt,
          updated_at: eventAt,
          message: { ...delivery().message, id: messageId, created_at: eventAt },
        }),
      ];
    }).flat();
    const first = buildDeliveryMonitorPage({
      deliveries: rows,
      filters: {
        query: "",
        traffic: "live",
        channel: "all",
        status: "all",
        memberId: null,
      },
      cursor: null,
      pageSize: 25,
    });
    const second = buildDeliveryMonitorPage({
      deliveries: rows,
      filters: {
        query: "",
        traffic: "live",
        channel: "all",
        status: "all",
        memberId: null,
      },
      cursor: first.nextCursor,
      pageSize: 25,
    });

    expect(first.totalMoments).toBe(27);
    expect(first.deliveries).toHaveLength(50);
    expect(first.summaries.live.total).toBe(54);
    expect(first.summaries.live.needsAttention).toBe(1);
    expect(second.deliveries).toHaveLength(4);
    expect(second.nextCursor).toBeNull();
  });
});
