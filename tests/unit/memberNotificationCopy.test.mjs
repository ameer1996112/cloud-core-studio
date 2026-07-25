import { describe, expect, test } from "bun:test";
import { buildMemberNotificationCopy } from "../../src/lib/memberNotificationCopy.ts";

describe("member notification copy", () => {
  test("localizes activation copy and links directly to the schedule", () => {
    expect(buildMemberNotificationCopy("registered_no_action", "he", {})).toEqual({
      category: "activation",
      title: "רגע קטן לעצמך מחכה ✨",
      body: "השיעורים הקרובים כבר פתוחים. לחצי לבחור את הרגע שלך השבוע.",
      actionUrl: "/member/schedule",
    });
    expect(buildMemberNotificationCopy("registered_no_action", "ar", {}).title).toBe(
      "لحظة جميلة لنفسك بانتظارك ✨",
    );
    expect(
      buildMemberNotificationCopy("registered_no_action", "en", { notification_stage: "day3" })
        .body,
    ).not.toBe(
      buildMemberNotificationCopy("registered_no_action", "en", { notification_stage: "day1" })
        .body,
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
      title: "Starting soon — Core Balance",
      body: "18:00 · Everything is ready for you. Tap for class details.",
      actionUrl: "/member/schedule?class=class-1",
    });
  });

  test("announces a newly opened schedule with one consolidated message", () => {
    expect(
      buildMemberNotificationCopy("schedule_opened", "en", {
        class_id: "class-1",
        class_name: "Aerial Flow",
        class_time: "18:00",
      }),
    ).toEqual({
      category: "schedule",
      title: "The new schedule is open ✨",
      body: "New classes are open for booking. Tap to choose yours and save a spot.",
      actionUrl: "/member/schedule",
    });
  });

  test("uses private lock-screen wording for failed payments", () => {
    const copy = buildMemberNotificationCopy("payment_failed", "en", { amount: "999" });
    expect(copy.body).toBe(
      "Your package is still waiting. Tap for a quick review or to try again.",
    );
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
      title: "Important update: Core Balance was cancelled",
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
      title: "Your spot opened in Pilates Sculpt 🤍",
      body: "It’s held for a limited time. Tap now to claim it.",
      actionUrl: "/member/schedule?class=class-2",
    });
  });
});
