import { z } from "zod";

export const memberNotificationPreferencesSchema = z.object({
  lessonReminders: z.boolean(),
  scheduleUpdates: z.boolean(),
  packageReminders: z.boolean(),
  marketing: z.boolean(),
  sound: z.boolean(),
  whatsappEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
});

export const memberPushTokenSchema = z.object({
  token: z.string().trim().min(32).max(1000),
  platform: z.literal("ios"),
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
