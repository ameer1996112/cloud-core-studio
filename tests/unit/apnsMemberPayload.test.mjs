import { describe, expect, test } from "bun:test";
import { buildApnsAlertBody, buildApnsRequestHeaders } from "../../src/lib/apns.server.ts";

describe("APNs member payload", () => {
  test("builds a silent marketing banner with a safe deep link and inbox identifier", () => {
    expect(
      buildApnsAlertBody({
        title: "Next week's schedule is open",
        body: "Choose the lesson that fits your week.",
        url: "/member/schedule",
        sound: false,
        badge: 2,
        notificationId: "notification-1",
        campaignId: "campaign-1",
      }),
    ).toEqual({
      aps: {
        alert: {
          title: "Next week's schedule is open",
          body: "Choose the lesson that fits your week.",
        },
        badge: 2,
      },
      url: "/member/schedule",
      notificationId: "notification-1",
      campaignId: "campaign-1",
    });
  });

  test("adds sound only for important operational notifications", () => {
    expect(
      buildApnsAlertBody({ title: "Lesson reminder", body: "Class starts soon.", sound: true }),
    ).toMatchObject({ aps: { sound: "default" } });
  });

  test("builds a branded time-sensitive payload with grouping, actions, and rich fallback", () => {
    expect(
      buildApnsAlertBody({
        title: "Class time changed",
        subtitle: "Core Pilates · Today at 19:00",
        body: "Your class now starts at 19:00.",
        url: "/member/schedule?class=11111111-1111-4111-8111-111111111111",
        sound: "cloud_core_important.caf",
        badge: 3,
        notificationId: "22222222-2222-4222-8222-222222222222",
        category: "CC_CLASS_UPDATE",
        threadId: "class:11111111-1111-4111-8111-111111111111",
        interruptionLevel: "time-sensitive",
        relevanceScore: 0.9,
        mutableContent: true,
        imageUrl: "https://cloudandcorestudio.com/notification-media/class.jpg",
        actions: ["view_class", "contact_studio"],
      }),
    ).toEqual({
      aps: {
        alert: {
          title: "Class time changed",
          subtitle: "Core Pilates · Today at 19:00",
          body: "Your class now starts at 19:00.",
        },
        sound: "cloud_core_important.caf",
        badge: 3,
        category: "CC_CLASS_UPDATE",
        "thread-id": "class:11111111-1111-4111-8111-111111111111",
        "interruption-level": "time-sensitive",
        "relevance-score": 0.9,
        "mutable-content": 1,
      },
      url: "/member/schedule?class=11111111-1111-4111-8111-111111111111",
      notificationId: "22222222-2222-4222-8222-222222222222",
      imageUrl: "https://cloudandcorestudio.com/notification-media/class.jpg",
      actions: ["view_class", "contact_studio"],
    });
  });

  test("builds APNs headers with collapse, expiry, and passive priority", () => {
    expect(
      buildApnsRequestHeaders({
        bundleId: "com.cloudandcore.studio",
        authorization: "bearer test-jwt",
        deviceToken: "device-token",
        payload: {
          title: "New class",
          body: "A class may fit your week.",
          interruptionLevel: "passive",
          collapseId: "recommendation:member-1",
          expiresAt: new Date("2026-07-22T10:00:00.000Z"),
        },
      }),
    ).toMatchObject({
      ":method": "POST",
      ":path": "/3/device/device-token",
      "apns-topic": "com.cloudandcore.studio",
      "apns-push-type": "alert",
      "apns-priority": "5",
      "apns-collapse-id": "recommendation:member-1",
      "apns-expiration": "1784714400",
    });
  });
});
