export const DEFAULT_MEMBER_NOTIFICATION_PREFERENCES = {
  lessonReminders: true,
  scheduleUpdates: true,
  packageReminders: true,
  marketing: false,
  sound: true,
  whatsappEnabled: false,
  emailEnabled: false,
};

const BASE_PREFERENCE_COLUMNS =
  "lesson_reminders,schedule_updates,package_reminders,marketing,sound";
const EXTERNAL_PREFERENCE_COLUMNS = `${BASE_PREFERENCE_COLUMNS},whatsapp_enabled,email_enabled`;

type PreferenceError = {
  code?: string;
  message?: string;
} | null;

type PreferenceQueryResult = {
  data: Record<string, unknown> | null;
  error: PreferenceError;
};

type PreferenceDatabase = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        maybeSingle: () => Promise<PreferenceQueryResult>;
      };
    };
  };
};

function isMissingExternalPreferenceColumn(error: PreferenceError) {
  return (
    error?.code === "42703" &&
    /member_notification_preferences\.(?:whatsapp_enabled|email_enabled)/.test(error.message ?? "")
  );
}

export async function readMemberNotificationPreferences(db: PreferenceDatabase, memberId: string) {
  const query = (columns: string) =>
    db
      .from("member_notification_preferences")
      .select(columns)
      .eq("member_id", memberId)
      .maybeSingle();

  const expandedResult = await query(EXTERNAL_PREFERENCE_COLUMNS);
  if (!isMissingExternalPreferenceColumn(expandedResult.error)) return expandedResult;
  return query(BASE_PREFERENCE_COLUMNS);
}

export function mapMemberNotificationPreferences(row: unknown) {
  if (!row || typeof row !== "object") return DEFAULT_MEMBER_NOTIFICATION_PREFERENCES;
  const values = row as Record<string, unknown>;
  return {
    lessonReminders: Boolean(values.lesson_reminders),
    scheduleUpdates: Boolean(values.schedule_updates),
    packageReminders: Boolean(values.package_reminders),
    marketing: Boolean(values.marketing),
    sound: Boolean(values.sound),
    whatsappEnabled: Boolean(values.whatsapp_enabled),
    emailEnabled: Boolean(values.email_enabled),
  };
}
