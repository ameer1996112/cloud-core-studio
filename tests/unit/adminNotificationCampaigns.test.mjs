import { describe, expect, test } from "bun:test";
import {
  adminNotificationCampaignSchema,
  selectCampaignAudience,
} from "../../src/lib/adminNotificationCampaigns.ts";

const members = [
  { id: "new", remainingCredits: 0, lastVisitAt: null },
  { id: "inactive", remainingCredits: 4, lastVisitAt: "2026-06-01T08:00:00.000Z" },
  { id: "active", remainingCredits: 1, lastVisitAt: "2026-07-18T08:00:00.000Z" },
];

describe("admin notification campaign contract", () => {
  test("requires reviewed copy in all three member languages", () => {
    const valid = {
      name: "Weekly schedule",
      category: "schedule",
      localizedContent: {
        he: { title: "המערכת פתוחה", body: "בחרי שיעור" },
        ar: { title: "الجدول مفتوح", body: "اختاري حصة" },
        en: { title: "Schedule open", body: "Choose a class" },
      },
      actionUrl: "/member/schedule",
      audience: { kind: "all_marketing" },
      sendAt: null,
    };

    expect(adminNotificationCampaignSchema.parse(valid)).toEqual(valid);
    expect(() =>
      adminNotificationCampaignSchema.parse({
        ...valid,
        localizedContent: { ...valid.localizedContent, ar: { title: "", body: "" } },
      }),
    ).toThrow();
  });

  test("selects never-booked and inactive audiences from real member evidence", () => {
    expect(
      selectCampaignAudience({
        members,
        audience: { kind: "never_booked" },
        bookedMemberIds: new Set(["active", "inactive"]),
        upcomingMemberIds: new Set(),
        expiringMemberIds: new Set(),
        now: new Date("2026-07-19T08:00:00.000Z"),
      }).map((member) => member.id),
    ).toEqual(["new"]);

    expect(
      selectCampaignAudience({
        members,
        audience: { kind: "inactive_14d" },
        bookedMemberIds: new Set(),
        upcomingMemberIds: new Set(),
        expiringMemberIds: new Set(),
        now: new Date("2026-07-19T08:00:00.000Z"),
      }).map((member) => member.id),
    ).toEqual(["new", "inactive"]);
  });

  test("selects low-credit, expiring, no-upcoming, and explicit audiences", () => {
    const base = {
      members,
      bookedMemberIds: new Set(["active"]),
      upcomingMemberIds: new Set(["active"]),
      expiringMemberIds: new Set(["inactive"]),
      now: new Date("2026-07-19T08:00:00.000Z"),
    };
    expect(
      selectCampaignAudience({ ...base, audience: { kind: "low_credits" } }).map((m) => m.id),
    ).toEqual(["new", "active"]);
    expect(
      selectCampaignAudience({ ...base, audience: { kind: "expiring_7d" } }).map((m) => m.id),
    ).toEqual(["inactive"]);
    expect(
      selectCampaignAudience({ ...base, audience: { kind: "no_upcoming" } }).map((m) => m.id),
    ).toEqual(["new", "inactive"]);
    expect(
      selectCampaignAudience({
        ...base,
        audience: { kind: "specific", memberIds: ["active"] },
      }).map((m) => m.id),
    ).toEqual(["active"]);
  });
});
