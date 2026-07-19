import { describe, expect, test } from "bun:test";
import { buildApnsAlertBody } from "../../src/lib/apns.server.ts";

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
    });
  });

  test("adds sound only for important operational notifications", () => {
    expect(
      buildApnsAlertBody({ title: "Lesson reminder", body: "Class starts soon.", sound: true }),
    ).toMatchObject({ aps: { sound: "default" } });
  });
});
