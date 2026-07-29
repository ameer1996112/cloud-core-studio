export const DEFAULT_MEMBER_NOTIFICATION_PREFERENCES = {
  lessonReminders: true,
  scheduleUpdates: true,
  packageReminders: true,
  marketing: false,
  sound: true,
  pushEnabled: true,
  whatsappEnabled: false,
  emailEnabled: false,
  classOperationsEnabled: true,
  classRemindersEnabled: true,
  scheduleOpeningsEnabled: true,
  waitlistEnabled: true,
  paymentsEnabled: true,
  membershipEnabled: true,
  staffRepliesEnabled: true,
  recommendationsEnabled: false,
  marketingAnalyticsEnabled: false,
  timeSensitiveEnabled: true,
};

const BASE_PREFERENCE_COLUMNS =
  "lesson_reminders,schedule_updates,package_reminders,marketing,sound";
const EXTERNAL_PREFERENCE_COLUMNS = `${BASE_PREFERENCE_COLUMNS},push_enabled,whatsapp_enabled,email_enabled`;
const PREMIUM_PREFERENCE_COLUMNS = `${EXTERNAL_PREFERENCE_COLUMNS},class_operations_enabled,class_reminders_enabled,schedule_openings_enabled,waitlist_enabled,payments_enabled,membership_enabled,staff_replies_enabled,recommendations_enabled,marketing_analytics_enabled,time_sensitive_enabled`;

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

function isMissingPreferenceColumn(error: PreferenceError, columns: readonly string[]) {
  return (
    error?.code === "42703" && columns.some((column) => (error.message ?? "").includes(column))
  );
}

export async function readMemberNotificationPreferences(db: PreferenceDatabase, memberId: string) {
  const query = (columns: string) =>
    db
      .from("member_notification_preferences")
      .select(columns)
      .eq("member_id", memberId)
      .maybeSingle();

  const premiumResult = await query(PREMIUM_PREFERENCE_COLUMNS);
  if (!isMissingPreferenceColumn(premiumResult.error, PREMIUM_PREFERENCE_COLUMNS.split(","))) {
    return premiumResult;
  }
  const externalResult = await query(EXTERNAL_PREFERENCE_COLUMNS);
  if (
    !isMissingPreferenceColumn(externalResult.error, [
      "push_enabled",
      "whatsapp_enabled",
      "email_enabled",
    ])
  ) {
    return externalResult;
  }
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
    pushEnabled: values.push_enabled !== false,
    whatsappEnabled: Boolean(values.whatsapp_enabled),
    emailEnabled: Boolean(values.email_enabled),
    classOperationsEnabled: values.class_operations_enabled !== false,
    classRemindersEnabled:
      values.class_reminders_enabled == null
        ? Boolean(values.lesson_reminders)
        : Boolean(values.class_reminders_enabled),
    scheduleOpeningsEnabled:
      values.schedule_openings_enabled == null
        ? Boolean(values.schedule_updates)
        : Boolean(values.schedule_openings_enabled),
    waitlistEnabled:
      values.waitlist_enabled == null
        ? Boolean(values.lesson_reminders)
        : Boolean(values.waitlist_enabled),
    paymentsEnabled:
      values.payments_enabled == null
        ? Boolean(values.package_reminders)
        : Boolean(values.payments_enabled),
    membershipEnabled:
      values.membership_enabled == null
        ? Boolean(values.package_reminders)
        : Boolean(values.membership_enabled),
    staffRepliesEnabled: values.staff_replies_enabled !== false,
    recommendationsEnabled:
      values.recommendations_enabled == null
        ? Boolean(values.marketing)
        : Boolean(values.recommendations_enabled),
    marketingAnalyticsEnabled: Boolean(values.marketing_analytics_enabled),
    timeSensitiveEnabled: values.time_sensitive_enabled !== false,
  };
}
