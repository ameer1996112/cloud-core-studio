import { describe, expect, test } from "bun:test";
import {
  memberNotificationPreferencesSchema,
  memberPushTokenSchema,
  readCampaignAttribution,
  safeNotificationActionUrl,
} from "../../src/lib/memberNotificationsApi.ts";

describe("member notification API contract", () => {
  test("accepts the complete member preference contract", () => {
    expect(
      memberNotificationPreferencesSchema.parse({
        lessonReminders: true,
        scheduleUpdates: false,
        packageReminders: true,
        marketing: false,
        sound: true,
      }),
    ).toEqual({
      lessonReminders: true,
      scheduleUpdates: false,
      packageReminders: true,
      marketing: false,
      sound: true,
    });
  });

  test("only accepts an iPhone APNs token with a plausible length", () => {
    expect(memberPushTokenSchema.parse({ token: "a".repeat(64), platform: "ios" })).toEqual({
      token: "a".repeat(64),
      platform: "ios",
    });
    expect(() => memberPushTokenSchema.parse({ token: "short", platform: "ios" })).toThrow();
    expect(() =>
      memberPushTokenSchema.parse({ token: "a".repeat(64), platform: "android" }),
    ).toThrow();
  });

  test("allows only authenticated in-app deep links", () => {
    expect(safeNotificationActionUrl("/member/schedule?class=class-1")).toBe(
      "/member/schedule?class=class-1",
    );
    expect(safeNotificationActionUrl("/member/packages")).toBe("/member/packages");
    expect(safeNotificationActionUrl("https://attacker.example/member")).toBe("/member");
    expect(safeNotificationActionUrl("//attacker.example/member")).toBe("/member");
    expect(safeNotificationActionUrl("/admin/members")).toBe("/member");
  });

  test("accepts campaign attribution only within its conversion window", () => {
    const active = JSON.stringify({
      campaignId: "11111111-1111-4111-8111-111111111111",
      expiresAt: 2_000,
    });
    expect(readCampaignAttribution(active, 1_000)).toEqual({
      campaignId: "11111111-1111-4111-8111-111111111111",
      expiresAt: 2_000,
    });
    expect(readCampaignAttribution(active, 2_001)).toBeNull();
    expect(readCampaignAttribution("not-json", 1_000)).toBeNull();
  });
});
