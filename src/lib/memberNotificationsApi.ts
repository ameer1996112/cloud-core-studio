import { z } from "zod";

export const memberNotificationPreferencesSchema = z.object({
  lessonReminders: z.boolean(),
  scheduleUpdates: z.boolean(),
  packageReminders: z.boolean(),
  marketing: z.boolean(),
  sound: z.boolean(),
  whatsappEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  classOperationsEnabled: z.boolean().optional(),
  classRemindersEnabled: z.boolean().optional(),
  scheduleOpeningsEnabled: z.boolean().optional(),
  waitlistEnabled: z.boolean().optional(),
  paymentsEnabled: z.boolean().optional(),
  membershipEnabled: z.boolean().optional(),
  staffRepliesEnabled: z.boolean().optional(),
  recommendationsEnabled: z.boolean().optional(),
  marketingAnalyticsEnabled: z.boolean().optional(),
  timeSensitiveEnabled: z.boolean().optional(),
});

export const memberPushTokenSchema = z.object({
  token: z.string().trim().min(32).max(1000),
  platform: z.literal("ios"),
  installationId: z.string().uuid().optional(),
  appVersion: z.string().trim().min(1).max(64).optional(),
  buildNumber: z.string().trim().min(1).max(64).optional(),
  locale: z.string().trim().min(2).max(35).optional(),
  environment: z.enum(["sandbox", "production"]).optional(),
  permissionStatus: z.enum(["prompt", "prompt-with-rationale", "granted", "denied"]).optional(),
  capabilities: z
    .object({
      richMedia: z.boolean(),
      actions: z.boolean(),
      timeSensitive: z.boolean(),
    })
    .optional(),
});

export const memberNotificationEngagementSchema = z.object({
  notificationId: z.string().uuid(),
  installationId: z.string().uuid().optional(),
  eventType: z.enum([
    "device_received",
    "opened",
    "actioned",
    "converted",
    "archived",
    "dismissed",
  ]),
  actionId: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_:-]+$/)
    .optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
  metadata: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .refine((value) => JSON.stringify(value).length <= 2048, "engagement metadata is too large")
    .optional(),
});

export const memberNotificationIdSchema = z.object({
  notificationId: z.string().uuid(),
});

export function optimisticallyMarkAllNotificationsRead<
  T extends { unreadCount: number; notifications: Array<{ read_at: string | null }> },
>(center: T, readAt = new Date().toISOString()): T {
  if (center.unreadCount === 0) return center;

  return {
    ...center,
    unreadCount: 0,
    notifications: center.notifications.map((notification) =>
      notification.read_at ? notification : { ...notification, read_at: readAt },
    ),
  };
}

const ALLOWED_MEMBER_PATHS = [
  "/member",
  "/member/schedule",
  "/member/bookings",
  "/member/packages",
  "/member/account",
  "/receipts",
] as const;

export function safeNotificationActionUrl(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/member";
  }

  let url: URL;
  try {
    url = new URL(value, "https://cloudandcore.local");
  } catch {
    return "/member";
  }

  if (url.origin !== "https://cloudandcore.local") return "/member";
  if (
    !ALLOWED_MEMBER_PATHS.some(
      (path) =>
        url.pathname === path ||
        (path === "/receipts" && /^\/receipts\/[0-9a-f-]{36}$/i.test(url.pathname)),
    )
  )
    return "/member";
  return `${url.pathname}${url.search}${url.hash}`;
}

export function safeNotificationActionUrlForAction(actionId: unknown, fallbackUrl: unknown) {
  if (typeof actionId !== "string") return safeNotificationActionUrl(fallbackUrl);
  if (["choose_package", "fix_payment", "view_membership"].includes(actionId)) {
    return "/member/packages";
  }
  if (actionId === "cancel_booking") return "/member/bookings";
  if (actionId === "view_schedule") return "/member/schedule";
  if (["contact_studio", "reply"].includes(actionId)) return "/member";
  return safeNotificationActionUrl(fallbackUrl);
}

export type MemberNotificationPreferencesInput = z.infer<
  typeof memberNotificationPreferencesSchema
>;

const campaignAttributionSchema = z.object({
  campaignId: z.string().uuid(),
  expiresAt: z.number().finite().positive(),
});

export function readCampaignAttribution(raw: string | null, now = Date.now()) {
  if (!raw) return null;
  try {
    const parsed = campaignAttributionSchema.parse(JSON.parse(raw));
    return parsed.expiresAt >= now ? parsed : null;
  } catch {
    return null;
  }
}
