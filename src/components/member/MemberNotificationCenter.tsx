import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClientOnlyFn, useServerFn } from "@tanstack/react-start";
import { Bell, CheckCheck, ChevronRight, Settings2, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useI18n, type Lang } from "@/lib/i18n";
import {
  getMemberNotificationCenter,
  markAllMemberNotificationsRead,
  markMemberNotificationRead,
  updateMemberNotificationPreferences,
} from "@/lib/memberNotifications.functions";
import {
  optimisticallyMarkAllNotificationsRead,
  safeNotificationActionUrl,
} from "@/lib/memberNotificationsApi";

type MemberNotificationItem = {
  id: string;
  category: string;
  title: string;
  body: string;
  action_url: string;
  sound: boolean;
  campaign_id: string | null;
  delivery_status: string;
  read_at: string | null;
  opened_at: string | null;
  created_at: string;
};

type NotificationCenterData = {
  preferences: {
    lessonReminders: boolean;
    scheduleUpdates: boolean;
    packageReminders: boolean;
    marketing: boolean;
    sound: boolean;
    whatsappEnabled: boolean;
    emailEnabled: boolean;
  };
  hasActiveDevice: boolean;
  unreadCount: number;
  notifications: MemberNotificationItem[];
};
type PreferenceKey = keyof NotificationCenterData["preferences"];

const COPY: Record<Lang, Record<string, string>> = {
  en: {
    title: "Notifications",
    unread: "unread",
    empty: "Your reminders and studio updates will appear here.",
    markAll: "Mark all read",
    markAllFailed: "Could not mark notifications as read. Please try again.",
    enableTitle: "Stay connected to your practice",
    enableBody: "Get lesson reminders, schedule openings, and package updates on your iPhone.",
    enable: "Enable iPhone reminders",
    denied: "Notifications are disabled. You can enable them in iPhone Settings.",
    enabled: "iPhone reminders are being enabled.",
    settings: "Notification choices",
    lessonReminders: "Upcoming lesson reminders",
    scheduleUpdates: "New schedules and lesson openings",
    packageReminders: "Credits, packages, and payment reminders",
    marketing: "Offers and studio news",
    sound: "Sound for important reminders",
    whatsappEnabled: "WhatsApp transactional updates",
    emailEnabled: "Email transactional updates",
    preferencesSaved: "Notification choices saved.",
    unavailable: "Open the Cloud & Core iPhone app to enable phone notifications.",
  },
  he: {
    title: "התראות",
    unread: "לא נקראו",
    empty: "תזכורות ועדכוני הסטודיו יופיעו כאן.",
    markAll: "סימון הכול כנקרא",
    markAllFailed: "לא הצלחנו לסמן את ההתראות כנקראו. אפשר לנסות שוב.",
    enableTitle: "להישאר מחוברת לאימונים",
    enableBody: "לקבלת תזכורות לשיעורים, פתיחת מערכת ועדכוני חבילה ב-iPhone.",
    enable: "הפעלת תזכורות ב-iPhone",
    denied: "ההתראות כבויות. אפשר להפעיל אותן בהגדרות ה-iPhone.",
    enabled: "הפעלת ההתראות התחילה.",
    settings: "בחירת התראות",
    lessonReminders: "תזכורות לשיעורים שנרשמת אליהם",
    scheduleUpdates: "מערכת חדשה ושיעורים שנפתחו",
    packageReminders: "קרדיטים, חבילות ותשלומים",
    marketing: "הטבות וחדשות מהסטודיו",
    sound: "צליל לתזכורות חשובות",
    whatsappEnabled: "עדכונים תפעוליים ב-WhatsApp",
    emailEnabled: "עדכונים תפעוליים באימייל",
    preferencesSaved: "בחירת ההתראות נשמרה.",
    unavailable: "יש לפתוח את אפליקציית Cloud & Core ב-iPhone כדי להפעיל התראות.",
  },
  ar: {
    title: "الإشعارات",
    unread: "غير مقروءة",
    empty: "ستظهر تذكيراتك وتحديثات الاستوديو هنا.",
    markAll: "تحديد الكل كمقروء",
    markAllFailed: "تعذر تحديد الإشعارات كمقروءة. حاولي مرة أخرى.",
    enableTitle: "ابقَي على تواصل مع تمارينك",
    enableBody: "احصلي على تذكيرات الحصص وفتح الجدول وتحديثات الباقة على iPhone.",
    enable: "تفعيل تذكيرات iPhone",
    denied: "الإشعارات متوقفة. يمكنك تفعيلها من إعدادات iPhone.",
    enabled: "بدأ تفعيل إشعارات iPhone.",
    settings: "اختيارات الإشعارات",
    lessonReminders: "تذكيرات الحصص القادمة",
    scheduleUpdates: "الجداول الجديدة والحصص المفتوحة",
    packageReminders: "الأرصدة والباقات والمدفوعات",
    marketing: "العروض وأخبار الاستوديو",
    sound: "صوت للتذكيرات المهمة",
    whatsappEnabled: "تحديثات المعاملات عبر WhatsApp",
    emailEnabled: "تحديثات المعاملات عبر البريد الإلكتروني",
    preferencesSaved: "تم حفظ اختيارات الإشعارات.",
    unavailable: "افتحي تطبيق Cloud & Core على iPhone لتفعيل إشعارات الهاتف.",
  },
};

const startMemberPushRegistration = createClientOnlyFn(async () => {
  const memberPush = await import("@/lib/memberPush.client");
  return memberPush.startMemberPushRegistration();
});

const bootstrapMemberPushRegistration = createClientOnlyFn(async () => {
  const memberPush = await import("@/lib/memberPush.client");
  return memberPush.bootstrapMemberPushRegistration();
});

const NOTIFICATION_CENTER_QUERY_KEY = ["member-notification-center"] as const;

export function MemberNotificationCenter({
  inviteAfterScheduleView = false,
  className = "",
  viewport,
}: {
  inviteAfterScheduleView?: boolean;
  className?: string;
  viewport: "mobile" | "desktop";
}) {
  const { lang } = useI18n();
  const copy = COPY[lang];
  const queryClient = useQueryClient();
  const getCenter = useServerFn(getMemberNotificationCenter);
  const markRead = useServerFn(markMemberNotificationRead);
  const markAllRead = useServerFn(markAllMemberNotificationsRead);
  const updatePreferences = useServerFn(updateMemberNotificationPreferences);
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState("");
  const [inviteDismissed, setInviteDismissed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem("cc-member-push-invite-dismissed") === "1",
  );
  const query = useQuery<NotificationCenterData>({
    queryKey: NOTIFICATION_CENTER_QUERY_KEY,
    queryFn: () => getCenter(),
    staleTime: 30_000,
  });

  useEffect(() => {
    void bootstrapMemberPushRegistration().catch((error) =>
      console.warn("member_push_bootstrap_failed", error),
    );
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATION_CENTER_QUERY_KEY });
    };
    const foreground = (event: Event) => {
      const isDesktop = window.matchMedia("(min-width: 768px)").matches;
      if ((viewport === "desktop") !== isDesktop) return;
      const detail = (event as CustomEvent<{ title?: string; body?: string }>).detail;
      if (detail?.title) toast(detail.title, { description: detail.body });
      refresh();
    };
    window.addEventListener("cc:member-notifications-changed", refresh);
    window.addEventListener("cc:member-push-received", foreground);
    return () => {
      window.removeEventListener("cc:member-notifications-changed", refresh);
      window.removeEventListener("cc:member-push-received", foreground);
    };
  }, [queryClient, viewport]);

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => markRead({ data: { notificationId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATION_CENTER_QUERY_KEY }),
  });
  const markAllMutation = useMutation({
    mutationFn: () => markAllRead({ data: {} }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATION_CENTER_QUERY_KEY });
      const previous = queryClient.getQueryData<NotificationCenterData>(
        NOTIFICATION_CENTER_QUERY_KEY,
      );
      if (previous) {
        queryClient.setQueryData<NotificationCenterData>(
          NOTIFICATION_CENTER_QUERY_KEY,
          optimisticallyMarkAllNotificationsRead(previous),
        );
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(NOTIFICATION_CENTER_QUERY_KEY, context.previous);
      }
      toast.error(copy.markAllFailed);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATION_CENTER_QUERY_KEY });
    },
  });
  const preferencesMutation = useMutation({
    mutationFn: (preferences: NotificationCenterData["preferences"]) =>
      updatePreferences({ data: preferences }),
    onSuccess: () => {
      toast.success(copy.preferencesSaved);
      void queryClient.invalidateQueries({ queryKey: NOTIFICATION_CENTER_QUERY_KEY });
    },
  });

  const data = query.data;
  const shouldInvite =
    inviteAfterScheduleView && !query.isLoading && !data?.hasActiveDevice && !inviteDismissed;

  async function enablePush() {
    setPermissionMessage("");
    try {
      const result = await startMemberPushRegistration();
      if (result.ok || result.skipped === "already_started") {
        setPermissionMessage(copy.enabled);
        return;
      }
      setPermissionMessage(result.skipped === "permission_denied" ? copy.denied : copy.unavailable);
    } catch (error) {
      console.warn("member_push_enable_failed", error);
      setPermissionMessage(copy.unavailable);
    }
  }

  function dismissInvite() {
    window.localStorage.setItem("cc-member-push-invite-dismissed", "1");
    setInviteDismissed(true);
    setPermissionMessage("");
  }

  async function openNotification(notification: NotificationCenterData["notifications"][number]) {
    if (!notification.read_at) {
      try {
        await markReadMutation.mutateAsync(notification.id);
      } catch (error) {
        console.warn("member_notification_open_tracking_failed", error);
      }
    }
    if (notification.campaign_id) {
      window.localStorage.setItem(
        "cc-member-campaign-attribution",
        JSON.stringify({
          campaignId: notification.campaign_id,
          expiresAt: Date.now() + 72 * 60 * 60_000,
        }),
      );
    }
    window.location.assign(safeNotificationActionUrl(notification.action_url));
  }

  return (
    <div className={className}>
      <button
        type="button"
        aria-label={copy.title}
        onClick={() => setOpen(true)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-slate transition-colors hover:bg-gold/10 hover:text-navy"
      >
        <Bell className="h-[19px] w-[19px]" />
        {(data?.unreadCount ?? 0) > 0 && (
          <span className="absolute end-0.5 top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-navy px-1 text-[9px] font-semibold text-white">
            {Math.min(data?.unreadCount ?? 0, 99)}
          </span>
        )}
      </button>

      {shouldInvite && (
        <div className="fixed inset-x-4 bottom-[calc(var(--member-bottom-nav-height)+env(safe-area-inset-bottom)+1rem)] z-40 mx-auto max-w-md rounded-[var(--radius-lg)] border border-gold/30 bg-ivory p-4 shadow-[var(--shadow-elevated)] md:bottom-6">
          <button
            type="button"
            aria-label="Close"
            onClick={dismissInvite}
            className="absolute end-3 top-3 rounded-full p-1 text-slate hover:bg-white"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex gap-3 pe-7 text-start">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/12 text-navy">
              <Smartphone className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-navy">{copy.enableTitle}</p>
              <p className="mt-1 text-sm leading-6 text-slate">{copy.enableBody}</p>
              <button
                type="button"
                onClick={enablePush}
                className="cta-navy mt-3 px-4 py-2 text-xs"
              >
                {copy.enable}
              </button>
              {permissionMessage && <p className="mt-2 text-xs text-slate">{permissionMessage}</p>}
            </div>
          </div>
        </div>
      )}

      {open && (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-50 bg-navy/25 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={copy.title}
            className="fixed inset-y-0 end-0 z-[60] flex w-full max-w-md flex-col border-s border-gold/20 bg-ivory shadow-[var(--shadow-elevated)]"
          >
            <div className="flex items-center justify-between border-b border-gold/20 px-5 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
              <div className="text-start">
                <h2 className="text-xl font-semibold text-navy">{copy.title}</h2>
                <p className="mt-1 text-xs text-slate">
                  {data?.unreadCount ?? 0} {copy.unread}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={copy.settings}
                  onClick={() => setShowSettings((value) => !value)}
                  className="rounded-full p-2.5 text-slate hover:bg-white hover:text-navy"
                >
                  <Settings2 className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-2.5 text-slate hover:bg-white hover:text-navy"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {showSettings && data && (
              <div className="space-y-3 border-b border-gold/20 bg-white/50 px-5 py-4">
                <p className="text-sm font-semibold text-navy">{copy.settings}</p>
                {(
                  [
                    "lessonReminders",
                    "scheduleUpdates",
                    "packageReminders",
                    "marketing",
                    "sound",
                    "whatsappEnabled",
                    "emailEnabled",
                  ] as PreferenceKey[]
                ).map((key) => (
                  <label
                    key={key}
                    className="flex min-h-10 items-center justify-between gap-4 text-start text-sm text-slate"
                  >
                    <span>{copy[key]}</span>
                    <input
                      type="checkbox"
                      checked={data.preferences[key]}
                      onChange={(event) =>
                        preferencesMutation.mutate({
                          ...data.preferences,
                          [key]: event.target.checked,
                        })
                      }
                      className="h-5 w-5 accent-navy"
                    />
                  </label>
                ))}
                {!data.hasActiveDevice && (
                  <button
                    type="button"
                    onClick={enablePush}
                    className="cta-navy mt-2 w-full px-4 py-2 text-xs"
                  >
                    {copy.enable}
                  </button>
                )}
                {permissionMessage && <p className="text-xs text-slate">{permissionMessage}</p>}
              </div>
            )}

            <div className="flex items-center justify-end px-5 py-3">
              {(data?.unreadCount ?? 0) > 0 && (
                <button
                  type="button"
                  disabled={markAllMutation.isPending}
                  aria-busy={markAllMutation.isPending}
                  onClick={() => markAllMutation.mutate()}
                  className="inline-flex items-center gap-2 text-xs font-medium text-slate hover:text-navy disabled:pointer-events-none disabled:opacity-50"
                >
                  <CheckCheck className="h-4 w-4" />
                  {copy.markAll}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
              {!data?.notifications.length ? (
                <div className="mx-1 mt-8 rounded-[var(--radius-lg)] border border-gold/20 bg-white/60 p-6 text-center text-sm leading-6 text-slate">
                  {copy.empty}
                </div>
              ) : (
                <div className="space-y-2">
                  {data.notifications.map((notification) => (
                    <button
                      type="button"
                      key={notification.id}
                      onClick={() => void openNotification(notification)}
                      className={`flex w-full items-start gap-3 rounded-[var(--radius-lg)] border p-4 text-start transition-colors ${
                        notification.read_at
                          ? "border-transparent bg-white/42"
                          : "border-gold/25 bg-white shadow-[var(--shadow-card)]"
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.read_at ? "bg-sand" : "bg-gold"}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-navy">{notification.title}</span>
                        <span className="mt-1 block text-sm leading-6 text-slate">
                          {notification.body}
                        </span>
                        <span className="mt-2 block text-[11px] text-slate/80">
                          {new Date(notification.created_at).toLocaleString(
                            lang === "he" ? "he-IL" : lang === "ar" ? "ar" : "en-GB",
                          )}
                        </span>
                      </span>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gold rtl:rotate-180" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
