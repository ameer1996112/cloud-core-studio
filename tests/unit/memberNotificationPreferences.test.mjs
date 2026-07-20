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
          message: "column member_notification_preferences.whatsapp_enabled does not exist",
        },
      },
      { data: legacyRow, error: null },
    ]);

    const result = await readMemberNotificationPreferences(db, "member-1");

    expect(result).toEqual({ data: legacyRow, error: null });
    expect(selectedColumns).toHaveLength(2);
    expect(selectedColumns[0]).toContain("whatsapp_enabled");
    expect(selectedColumns[1]).not.toContain("whatsapp_enabled");
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
});
