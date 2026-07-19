import { describe, expect, test } from "bun:test";
import { buildMemberNotificationCopy } from "../../src/lib/memberNotificationCopy.ts";

describe("member notification copy", () => {
  test("localizes activation copy and links directly to the schedule", () => {
    expect(buildMemberNotificationCopy("registered_no_action", "he", {})).toEqual({
      category: "activation",
      title: "השיעור הראשון שלך מחכה",
      body: "פתחי את המערכת ובחרי את השיעור שמתאים לשבוע שלך.",
      actionUrl: "/member/schedule",
    });
    expect(buildMemberNotificationCopy("registered_no_action", "ar", {}).title).toBe(
      "حصتك الأولى بانتظارك",
    );
  });

  test("creates a lesson reminder without exposing private account data", () => {
    expect(
      buildMemberNotificationCopy("class_reminder_2h", "en", {
        class_name: "Core Balance",
        class_time: "18:00",
        class_id: "class-1",
      }),
    ).toEqual({
      category: "lesson_reminder",
      title: "Core Balance starts soon",
      body: "Your lesson begins at 18:00. See you at the studio.",
      actionUrl: "/member/schedule?class=class-1",
    });
  });

  test("uses private lock-screen wording for failed payments", () => {
    const copy = buildMemberNotificationCopy("payment_failed", "en", { amount: "999" });
    expect(copy.body).toBe("Open the app to review your payment and keep your package active.");
    expect(copy.body).not.toContain("999");
  });

  test("makes cancelled and rescheduled lessons unmistakably operational", () => {
    expect(
      buildMemberNotificationCopy("class_cancelled_by_admin", "en", {
        class_name: "Core Balance",
        class_id: "class-1",
      }),
    ).toMatchObject({
      category: "urgent_class_change",
      title: "Core Balance was cancelled",
      actionUrl: "/member/schedule?class=class-1",
    });
    expect(
      buildMemberNotificationCopy("class_time_changed", "he", {
        class_name: "Core Balance",
        class_time: "19:30",
      }).body,
    ).toContain("19:30");
  });

  test("opens an available waitlist place with an audible operational alert", () => {
    expect(
      buildMemberNotificationCopy("waitlist_spot_available", "en", {
        class_name: "Pilates Sculpt",
        class_id: "class-2",
      }),
    ).toEqual({
      category: "waitlist",
      title: "A place opened in Pilates Sculpt",
      body: "Open the app now to claim it before the offer expires.",
      actionUrl: "/member/schedule?class=class-2",
    });
  });
});
