import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createClientOnlyFn, useServerFn } from "@tanstack/react-start";
import {
  Bell,
  Archive,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  MessageCircle,
  Settings2,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useI18n, type Lang } from "@/lib/i18n";
import {
  getMemberNotificationCenter,
  markAllMemberNotificationsRead,
  markMemberNotificationRead,
  recordMemberNotificationEngagement,
  updateMemberNotificationPreferences,
} from "@/lib/memberNotifications.functions";
import {
  optimisticallyMarkAllNotificationsRead,
  safeNotificationActionUrl,
} from "@/lib/memberNotificationsApi";

type MemberNotificationItem = {
  id: string;
  category: string;
  family: string | null;
  tier: string | null;
  title: string;
  body: string;
  action_url: string;
  sound: boolean;
  campaign_id: string | null;
  delivery_status: string;
  read_at: string | null;
  opened_at: string | null;
  created_at: string;
  actions: string[];
  pinned_until: string | null;
  expires_at: string | null;
};

type NotificationCenterData = {
  canonical: boolean;
  preferences: {
    lessonReminders: boolean;
    scheduleUpdates: boolean;
    packageReminders: boolean;
    marketing: boolean;
    sound: boolean;
    pushEnabled: boolean;
    whatsappEnabled: boolean;
    emailEnabled: boolean;
    classOperationsEnabled: boolean;
    classRemindersEnabled: boolean;
    scheduleOpeningsEnabled: boolean;
    waitlistEnabled: boolean;
    paymentsEnabled: boolean;
    membershipEnabled: boolean;
    staffRepliesEnabled: boolean;
    recommendationsEnabled: boolean;
    marketingAnalyticsEnabled: boolean;
    timeSensitiveEnabled: boolean;
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
    denied: "Notifications are disabled. You can enable them in iPhone Settings.",
    settings: "Notification choices",
    lessonReminders: "Upcoming lesson reminders",
    scheduleUpdates: "New schedules and lesson openings",
    packageReminders: "Credits, packages, and payment reminders",
    marketing: "Offers and studio news",
    sound: "Sound for important reminders",
    pushEnabled: "iPhone push notifications",
    whatsappEnabled: "WhatsApp transactional updates",
    emailEnabled: "Email transactional updates",
    preferencesSaved: "Notification choices saved.",
    all: "All",
    unreadOnly: "Unread",
    today: "Today",
    thisWeek: "This week",
    earlier: "Earlier",
    expired: "Expired",
    archive: "Archive",
    classes: "Classes",
    waitlist: "Waitlist",
    payments: "Payments",
    membership: "Membership",
    studio: "Studio",
    critical: "Important",
    practiceUpdates: "Practice & schedule",
    accountUpdates: "Account & payments",
    communicationUpdates: "Studio communication",
    classOperationsEnabled: "Class cancellations, time and location changes",
    classRemindersEnabled: "Planning and final class reminders",
    scheduleOpeningsEnabled: "New schedules and open places",
    waitlistEnabled: "Waitlist progress and available places",
    paymentsEnabled: "Payments, receipts and payment issues",
    membershipEnabled: "Membership, credits and renewals",
    staffRepliesEnabled: "Replies from the studio team",
    recommendationsEnabled: "Personal class recommendations",
    marketingAnalyticsEnabled: "Measure whether recommendations are useful",
    timeSensitiveEnabled: "Time Sensitive alerts for urgent updates",
  },
  he: {
    title: "התראות",
    unread: "לא נקראו",
    empty: "תזכורות ועדכוני הסטודיו יופיעו כאן.",
    markAll: "סימון הכול כנקרא",
    markAllFailed: "לא הצלחנו לסמן את ההתראות כנקראו. אפשר לנסות שוב.",
    denied: "ההתראות כבויות. אפשר להפעיל אותן בהגדרות ה-iPhone.",
    settings: "בחירת התראות",
    lessonReminders: "תזכורות לשיעורים שנרשמת אליהם",
    scheduleUpdates: "מערכת חדשה ושיעורים שנפתחו",
    packageReminders: "קרדיטים, חבילות ותשלומים",
    marketing: "הטבות וחדשות מהסטודיו",
    sound: "צליל לתזכורות חשובות",
    pushEnabled: "התראות Push ב‑iPhone",
    whatsappEnabled: "עדכונים תפעוליים ב-WhatsApp",
    emailEnabled: "עדכונים תפעוליים באימייל",
    preferencesSaved: "בחירת ההתראות נשמרה.",
    all: "הכול",
    unreadOnly: "לא נקראו",
    today: "היום",
    thisWeek: "השבוע",
    earlier: "מוקדם יותר",
    expired: "פג תוקף",
    archive: "ארכוב",
    classes: "שיעורים",
    waitlist: "רשימת המתנה",
    payments: "תשלומים",
    membership: "מנוי",
    studio: "סטודיו",
    critical: "חשוב",
    practiceUpdates: "אימונים ומערכת",
    accountUpdates: "חשבון ותשלומים",
    communicationUpdates: "תקשורת עם הסטודיו",
    classOperationsEnabled: "ביטולי שיעור ושינויי שעה או מיקום",
    classRemindersEnabled: "תזכורות תכנון ותזכורת אחרונה",
    scheduleOpeningsEnabled: "מערכת חדשה ומקומות פנויים",
    waitlistEnabled: "התקדמות ברשימת המתנה ומקום שהתפנה",
    paymentsEnabled: "תשלומים, קבלות ובעיות תשלום",
    membershipEnabled: "מנוי, קרדיטים וחידושים",
    staffRepliesEnabled: "מענה מצוות הסטודיו",
    recommendationsEnabled: "המלצות אישיות לשיעורים",
    marketingAnalyticsEnabled: "מדידה אם ההמלצות מועילות",
    timeSensitiveEnabled: "התראות דחופות מסוג Time Sensitive",
  },
  ar: {
    title: "الإشعارات",
    unread: "غير مقروءة",
    empty: "ستظهر تذكيراتك وتحديثات الاستوديو هنا.",
    markAll: "تحديد الكل كمقروء",
    markAllFailed: "تعذر تحديد الإشعارات كمقروءة. حاولي مرة أخرى.",
    denied: "الإشعارات متوقفة. يمكنك تفعيلها من إعدادات iPhone.",
    settings: "اختيارات الإشعارات",
    lessonReminders: "تذكيرات الحصص القادمة",
    scheduleUpdates: "الجداول الجديدة والحصص المفتوحة",
    packageReminders: "الأرصدة والباقات والمدفوعات",
    marketing: "العروض وأخبار الاستوديو",
    sound: "صوت للتذكيرات المهمة",
    pushEnabled: "إشعارات Push على iPhone",
    whatsappEnabled: "تحديثات المعاملات عبر WhatsApp",
    emailEnabled: "تحديثات المعاملات عبر البريد الإلكتروني",
    preferencesSaved: "تم حفظ اختيارات الإشعارات.",
    all: "الكل",
    unreadOnly: "غير مقروءة",
    today: "اليوم",
    thisWeek: "هذا الأسبوع",
    earlier: "سابقاً",
    expired: "انتهت الصلاحية",
    archive: "أرشفة",
    classes: "الحصص",
    waitlist: "قائمة الانتظار",
    payments: "المدفوعات",
    membership: "الاشتراك",
    studio: "الاستوديو",
    critical: "مهم",
    practiceUpdates: "التمارين والجدول",
    accountUpdates: "الحساب والمدفوعات",
    communicationUpdates: "التواصل مع الاستوديو",
    classOperationsEnabled: "إلغاء الحصص وتغيير الوقت أو المكان",
    classRemindersEnabled: "تذكيرات التخطيط والتذكير الأخير",
    scheduleOpeningsEnabled: "الجداول الجديدة والأماكن المتاحة",
    waitlistEnabled: "تقدم قائمة الانتظار وتوفر مكان",
    paymentsEnabled: "المدفوعات والإيصالات ومشاكل الدفع",
    membershipEnabled: "الاشتراك والأرصدة والتجديد",
    staffRepliesEnabled: "ردود فريق الاستوديو",
    recommendationsEnabled: "اقتراحات حصص شخصية",
    marketingAnalyticsEnabled: "قياس مدى فائدة الاقتراحات",
    timeSensitiveEnabled: "تنبيهات عاجلة من نوع Time Sensitive",
  },
};

const startMemberPushRegistration = createClientOnlyFn(async () => {
  const memberPush = await import("@/lib/memberPush.client");
  return memberPush.startMemberPushRegistration();
});

const NOTIFICATION_CENTER_QUERY_KEY = ["member-notification-center"] as const;

function NotificationFamilyIcon({ family }: { family: string | null }) {
  const iconClass = "h-4 w-4";
  if (family === "payment") return <CircleDollarSign className={iconClass} />;
  if (family === "membership") return <Sparkles className={iconClass} />;
  if (family === "waitlist") return <Users className={iconClass} />;
  if (family === "communication") return <MessageCircle className={iconClass} />;
  if (family === "class" || family === "booking") return <CalendarDays className={iconClass} />;
  return <Bell className={iconClass} />;
}

export function MemberNotificationCenter({
  className = "",
  viewport,
}: {
  className?: string;
  viewport: "mobile" | "desktop";
}) {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const copy = COPY[lang];
  const queryClient = useQueryClient();
  const getCenter = useServerFn(getMemberNotificationCenter);
  const markRead = useServerFn(markMemberNotificationRead);
  const markAllRead = useServerFn(markAllMemberNotificationsRead);
  const updatePreferences = useServerFn(updateMemberNotificationPreferences);
  const recordEngagement = useServerFn(recordMemberNotificationEngagement);
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [inboxFilter, setInboxFilter] = useState<"all" | "unread">("all");
  const [familyFilter, setFamilyFilter] = useState<
    "all" | "classes" | "waitlist" | "payments" | "membership" | "studio"
  >("all");
  const [permissionMessage, setPermissionMessage] = useState("");
  const query = useQuery<NotificationCenterData>({
    queryKey: NOTIFICATION_CENTER_QUERY_KEY,
    queryFn: () => getCenter(),
    staleTime: 30_000,
  });

  useEffect(() => {
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

  useEffect(() => {
    if (query.isLoading || query.data?.preferences.pushEnabled !== true) return;
    void startMemberPushRegistration()
      .then((result) => {
        if (!result.ok && result.skipped === "permission_denied") {
          setPermissionMessage(copy.denied);
        }
      })
      .catch((error) => console.warn("member_push_automatic_permission_failed", error));
  }, [copy.denied, query.data?.preferences.pushEnabled, query.isLoading]);

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
  const groupedNotifications = useMemo(() => {
    const familyMatches = (notification: MemberNotificationItem) => {
      if (familyFilter === "all") return true;
      if (familyFilter === "classes")
        return ["class", "booking"].includes(notification.family ?? "");
      if (familyFilter === "studio")
        return ["communication", "engagement"].includes(notification.family ?? "");
      return notification.family === familyFilter.replace(/s$/, "");
    };
    const visible = (data?.notifications ?? [])
      .filter(
        (notification) =>
          (inboxFilter === "all" || !notification.read_at) && familyMatches(notification),
      )
      .sort((left, right) => {
        const leftPinned = left.pinned_until && new Date(left.pinned_until) > new Date() ? 1 : 0;
        const rightPinned = right.pinned_until && new Date(right.pinned_until) > new Date() ? 1 : 0;
        return (
          rightPinned - leftPinned ||
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
        );
      });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const week = new Date(today);
    week.setDate(week.getDate() - 6);
    return [
      { key: "today", items: visible.filter((item) => new Date(item.created_at) >= today) },
      {
        key: "thisWeek",
        items: visible.filter(
          (item) => new Date(item.created_at) < today && new Date(item.created_at) >= week,
        ),
      },
      { key: "earlier", items: visible.filter((item) => new Date(item.created_at) < week) },
    ].filter((group) => group.items.length);
  }, [data?.notifications, familyFilter, inboxFilter]);
  const preferenceGroups = [
    {
      title: copy.practiceUpdates,
      keys: [
        "classOperationsEnabled",
        "classRemindersEnabled",
        "scheduleOpeningsEnabled",
        "waitlistEnabled",
        "recommendationsEnabled",
      ] as PreferenceKey[],
    },
    {
      title: copy.accountUpdates,
      keys: ["paymentsEnabled", "membershipEnabled"] as PreferenceKey[],
    },
    {
      title: copy.communicationUpdates,
      keys: [
        "staffRepliesEnabled",
        "timeSensitiveEnabled",
        "sound",
        "pushEnabled",
        "whatsappEnabled",
        "emailEnabled",
      ] as PreferenceKey[],
    },
  ];
  async function openNotification(notification: NotificationCenterData["notifications"][number]) {
    void recordEngagement({
      data: {
        notificationId: notification.id,
        eventType: "opened",
        occurredAt: new Date().toISOString(),
      },
    }).catch(() => {
      // Legacy notification IDs intentionally remain outside the canonical engagement ledger.
    });
    if (!notification.read_at) {
      void markReadMutation.mutateAsync(notification.id).catch((error) => {
        console.warn("member_notification_open_tracking_failed", error);
      });
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
    setOpen(false);
    if (notification.expires_at && new Date(notification.expires_at) <= new Date()) return;
    try {
      await navigate({ href: safeNotificationActionUrl(notification.action_url) });
    } catch (error) {
      console.warn("member_notification_navigation_failed", error);
    }
  }

  function archiveNotification(notificationId: string) {
    void recordEngagement({
      data: {
        notificationId,
        eventType: "archived",
        occurredAt: new Date().toISOString(),
      },
    }).then(() => queryClient.invalidateQueries({ queryKey: NOTIFICATION_CENTER_QUERY_KEY }));
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
              <div className="max-h-[55vh] space-y-5 overflow-y-auto border-b border-gold/20 bg-white/50 px-5 py-4">
                <p className="text-sm font-semibold text-navy">{copy.settings}</p>
                {preferenceGroups.map((group) => (
                  <fieldset key={group.title} className="space-y-2.5">
                    <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate/70">
                      {group.title}
                    </legend>
                    {group.keys.map((key) => (
                      <label
                        key={key}
                        className="flex min-h-11 items-center justify-between gap-4 rounded-xl bg-white/55 px-3 text-start text-sm text-slate"
                      >
                        <span>{copy[key]}</span>
                        <input
                          type="checkbox"
                          checked={data.preferences[key]}
                          disabled={preferencesMutation.isPending}
                          onChange={(event) =>
                            preferencesMutation.mutate({
                              ...data.preferences,
                              [key]: event.target.checked,
                            })
                          }
                          className="h-5 w-5 shrink-0 accent-navy"
                        />
                      </label>
                    ))}
                  </fieldset>
                ))}
                {permissionMessage && <p className="text-xs text-slate">{permissionMessage}</p>}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="inline-flex rounded-full bg-white/70 p-1 text-xs text-slate">
                {(["all", "unread"] as const).map((filter) => (
                  <button
                    type="button"
                    key={filter}
                    aria-pressed={inboxFilter === filter}
                    onClick={() => setInboxFilter(filter)}
                    className={`rounded-full px-3 py-1.5 transition-colors ${
                      inboxFilter === filter ? "bg-navy text-white" : "hover:text-navy"
                    }`}
                  >
                    {filter === "all" ? copy.all : copy.unreadOnly}
                  </button>
                ))}
              </div>
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

            <div className="flex gap-1.5 overflow-x-auto px-5 pb-3 text-[11px] text-slate">
              {(["all", "classes", "waitlist", "payments", "membership", "studio"] as const).map(
                (filter) => (
                  <button
                    type="button"
                    key={filter}
                    aria-pressed={familyFilter === filter}
                    onClick={() => setFamilyFilter(filter)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 transition-colors ${
                      familyFilter === filter
                        ? "border-navy bg-navy text-white"
                        : "border-gold/20 bg-white/50 hover:text-navy"
                    }`}
                  >
                    {copy[filter]}
                  </button>
                ),
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
              {!groupedNotifications.length ? (
                <div className="mx-1 mt-8 rounded-[var(--radius-lg)] border border-gold/20 bg-white/60 p-6 text-center text-sm leading-6 text-slate">
                  {copy.empty}
                </div>
              ) : (
                <div className="space-y-5">
                  {groupedNotifications.map((group) => (
                    <section key={group.key}>
                      <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate/70">
                        {copy[group.key]}
                      </h3>
                      <div className="space-y-2">
                        {group.items.map((notification) => {
                          const expired = Boolean(
                            notification.expires_at &&
                            new Date(notification.expires_at) <= new Date(),
                          );
                          return (
                            <article
                              key={notification.id}
                              className={`relative flex items-start overflow-hidden rounded-[var(--radius-lg)] border transition-all hover:-translate-y-px hover:shadow-[var(--shadow-card)] ${
                                notification.read_at
                                  ? "border-transparent bg-white/42"
                                  : "border-gold/25 bg-white shadow-[var(--shadow-card)]"
                              }`}
                            >
                              {notification.tier === "critical" && (
                                <span className="absolute inset-y-0 start-0 w-1 bg-gold" />
                              )}
                              <button
                                type="button"
                                onClick={() => void openNotification(notification)}
                                className="flex min-w-0 flex-1 items-start gap-3 p-4 text-start"
                              >
                                <span
                                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                                    notification.read_at
                                      ? "bg-sand/35 text-slate"
                                      : "bg-gold/15 text-navy"
                                  }`}
                                >
                                  <NotificationFamilyIcon family={notification.family} />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex flex-wrap items-center gap-2">
                                    <span className="block font-semibold text-navy">
                                      {notification.title}
                                    </span>
                                    {notification.tier === "critical" && (
                                      <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-navy">
                                        {copy.critical}
                                      </span>
                                    )}
                                    {expired && (
                                      <span className="rounded-full bg-sand px-2 py-0.5 text-[9px] font-semibold uppercase text-slate">
                                        {copy.expired}
                                      </span>
                                    )}
                                  </span>
                                  <span className="mt-1 block text-sm leading-6 text-slate">
                                    {notification.body}
                                  </span>
                                  <span className="mt-2 flex items-center gap-1 text-[11px] text-slate/80">
                                    <Clock3 className="h-3 w-3" />
                                    {new Date(notification.created_at).toLocaleString(
                                      lang === "he" ? "he-IL" : lang === "ar" ? "ar" : "en-GB",
                                    )}
                                  </span>
                                </span>
                                {!expired && (
                                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gold rtl:rotate-180" />
                                )}
                              </button>
                              {data?.canonical && (
                                <button
                                  type="button"
                                  aria-label={copy.archive}
                                  onClick={() => archiveNotification(notification.id)}
                                  className="m-2 rounded-full p-2 text-slate/60 hover:bg-sand/50 hover:text-navy"
                                >
                                  <Archive className="h-4 w-4" />
                                </button>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </section>
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
