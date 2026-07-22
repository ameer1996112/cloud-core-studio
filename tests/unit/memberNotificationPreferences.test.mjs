import { describe, expect, test } from "bun:test";
import {
  mapMemberNotificationPreferences,
  readMemberNotificationPreferences,
} from "../../src/lib/memberNotificationPreferences.ts";

function createPreferencesDb(results) {
  const selectedColumns = [];
  return {
    selectedColumns,
    db: {
      from: () => ({
        select: (columns) => {
          selectedColumns.push(columns);
          return {
            eq: () => ({
              maybeSingle: async () => results.shift(),
            }),
          };
        },
      }),
    },
  };
}

describe("member notification preference compatibility", () => {
  test("falls back to the legacy preference columns when external channel columns are absent", async () => {
    const legacyRow = {
      lesson_reminders: true,
      schedule_updates: true,
      package_reminders: true,
      marketing: false,
      sound: true,
    };
    const { db, selectedColumns } = createPreferencesDb([
      {
        data: null,
        error: {
          code: "42703",
          message: "column member_notification_preferences.time_sensitive_enabled does not exist",
        },
      },
      {
        data: null,
        error: {
          code: "42703",
          message: "column member_notification_preferences.whatsapp_enabled does not exist",
        },
      },
      { data: legacyRow, error: null },
    ]);

    const result = await readMemberNotificationPreferences(db, "member-1");

    expect(result).toEqual({ data: legacyRow, error: null });
    expect(selectedColumns).toHaveLength(3);
    expect(selectedColumns[0]).toContain("whatsapp_enabled");
    expect(selectedColumns[0]).toContain("time_sensitive_enabled");
    expect(selectedColumns[1]).toContain("whatsapp_enabled");
    expect(selectedColumns[2]).not.toContain("whatsapp_enabled");
    expect(mapMemberNotificationPreferences(result.data)).toMatchObject({
      lessonReminders: true,
      whatsappEnabled: false,
      emailEnabled: false,
    });
  });

  test("does not hide unrelated database errors", async () => {
    const failure = { data: null, error: { code: "42501", message: "permission denied" } };
    const { db, selectedColumns } = createPreferencesDb([failure]);

    expect(await readMemberNotificationPreferences(db, "member-1")).toBe(failure);
    expect(selectedColumns).toHaveLength(1);
  });

  test("maps the granular premium preferences and keeps conservative marketing defaults", async () => {
    const row = {
      lesson_reminders: true,
      schedule_updates: true,
      package_reminders: true,
      marketing: false,
      sound: true,
      whatsapp_enabled: true,
      email_enabled: true,
      class_operations_enabled: true,
      class_reminders_enabled: false,
      schedule_openings_enabled: true,
      waitlist_enabled: true,
      payments_enabled: true,
      membership_enabled: false,
      staff_replies_enabled: true,
      recommendations_enabled: false,
      marketing_analytics_enabled: false,
      time_sensitive_enabled: true,
    };
    const { db, selectedColumns } = createPreferencesDb([{ data: row, error: null }]);

    const result = await readMemberNotificationPreferences(db, "member-1");

    expect(selectedColumns[0]).toContain("time_sensitive_enabled");
    expect(mapMemberNotificationPreferences(result.data)).toMatchObject({
      classOperationsEnabled: true,
      classRemindersEnabled: false,
      membershipEnabled: false,
      recommendationsEnabled: false,
      marketingAnalyticsEnabled: false,
      timeSensitiveEnabled: true,
    });
  });
});
