import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminPageShell, AdminPageHeader } from "@/components/admin-shared";
import { AdminPushCampaigns } from "@/components/admin/AdminPushCampaigns";
import {
  listMessageTemplates,
  upsertMessageTemplate,
  duplicateMessageTemplate,
  setTemplateActive,
  buildAudience,
  searchMembersBasic,
  logNotification,
  listNotificationLogs,
  markNotificationSent,
  listPackageRequests,
  updatePackageRequest,
} from "@/lib/messages.functions";
import { getPublicStudioSettings } from "@/lib/studioSettings.functions";
import {
  claimCanonicalConversation,
  getCanonicalConversation,
  listCanonicalConversations,
  listCanonicalDeliveries,
  listNotificationEventRollouts,
  listWhatsappTemplateDeployments,
  releaseCanonicalConversation,
  replyCanonicalConversation,
  resolveCanonicalConversation,
  retryCanonicalDeliveryAction,
  updateNotificationEventRollout,
} from "@/lib/unifiedMessages.functions";
import { listClasses, prepareClassReminderDrafts } from "@/lib/admin.functions";
import { useI18n, type Lang } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { localizedClassTitle, localizedInstructorName } from "@/lib/localized-content";
import {
  CHANNELS,
  LANGUAGES,
  TRIGGER_TYPES,
  SUPPORTED_VARIABLES,
  renderTemplate,
  waUrl,
  formatClassDate,
  formatClassTime,
} from "@/lib/messageTemplate";
import {
  Plus,
  Copy,
  Send,
  MessageCircle,
  Mail,
  Check,
  X,
  Sparkles,
  Pencil,
  Power,
  ChevronRight,
  ListChecks,
  Users,
  Phone,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/messages")({
  component: Page,
});

type Tab =
  | "inbox"
  | "deliveries"
  | "events"
  | "push"
  | "templates"
  | "composer"
  | "logs"
  | "requests";

type LogStatusSummary = {
  status?: string | null;
  error_message?: string | null;
};

function getLogStatusLabel(log: LogStatusSummary) {
  if (log.status === "failed" && log.error_message === "openwa_delivery_unconfirmed") {
    return "Delivery unconfirmed";
  }
  return String(log.status ?? "unknown").replaceAll("_", " ");
}

function getLogStatusClass(log: LogStatusSummary) {
  if (log.status === "manually_sent" || log.status === "sent") {
    return "bg-navy text-ivory";
  }
  if (log.status === "draft" || log.status === "queued" || log.status === "sending") {
    return "bg-powder text-navy";
  }
  if (log.status === "failed" && log.error_message === "openwa_delivery_unconfirmed") {
    return "bg-amber-100 text-amber-900";
  }
  if (log.status === "failed") {
    return "bg-destructive/10 text-destructive";
  }
  if (log.status === "skipped") {
    return "bg-sand text-slate";
  }
  return "bg-sand text-slate";
}

const PAGE_COPY: Record<Lang, Record<string, string>> = {
  en: {
    title: "Messages center",
    intro:
      "Prepare WhatsApp- and email-ready messages from real studio data. Every message you generate is logged for the studio record.",
    composer: "Compose",
    templates: "Templates",
    requests: "Package requests",
    logs: "Activity log",
    push: "iPhone campaigns",
    inbox: "Inbox",
    deliveries: "Deliveries",
    events: "Event matrix",
    audience: "Audience",
    specificMembers: "Specific member(s)",
    searchMember: "Search member by name...",
    noContact: "No contact saved",
    searching: "Searching...",
    recipients: "recipient(s)",
    template: "Template",
    appLanguageTemplate: "Use current app language",
    memberLanguageTemplate: "Auto-match member language",
    appLanguageHelp: "Auto: messages use the current app language.",
    selectedTrigger: "Trigger",
    chooseClass: "Choose a class...",
    chooseMember: "Search and choose at least one member.",
    chooseClassEmpty: "Select a class to build the audience.",
    noMembers: "No members match this audience right now.",
    messagesReady: "messages ready",
    copyAll: "Copy all to clipboard",
    prepareReminderDrafts: "Prepare reminder drafts",
    markAllSent: "Mark all manually sent",
    working: "Working...",
    credits: "credits",
    subject: "Subject",
    noPhone: "No phone on file",
    reset: "Reset to template",
    copy: "Copy",
    sendWhatsApp: "Send WhatsApp",
    sending: "Sending...",
    openWhatsApp: "Open WhatsApp",
    openEmail: "Open email",
    markSent: "Mark manually sent",
    audienceClassRoster: "Class roster",
    audienceClassWaitlist: "Class waitlist",
    audienceLowCredits: "Low credits (<=2)",
    audiencePackageExpiring: "Package expiring (7d)",
    audienceFirstTimers: "First-time visitors",
    audienceNoShow: "Recent no-shows",
    audienceInactive: "Inactive 60+ days",
    audienceNoBooking: "No upcoming booking",
  },
  he: {
    title: "מרכז הודעות",
    intro: "הכינו הודעות WhatsApp ואימייל מנתוני הסטודיו. כל הודעה שנוצרת נשמרת ביומן הסטודיו.",
    composer: "כתיבה",
    templates: "תבניות",
    requests: "בקשות חבילה",
    logs: "יומן פעילות",
    push: "קמפיינים ל-iPhone",
    inbox: "תיבת שיחות",
    deliveries: "מסירות",
    events: "מפת אירועים",
    audience: "קהל יעד",
    specificMembers: "חבר/ה מסוימים",
    searchMember: "חיפוש חבר/ה לפי שם...",
    noContact: "אין פרטי קשר",
    searching: "מחפש...",
    recipients: "נמענים",
    template: "תבנית",
    appLanguageTemplate: "שימוש בשפת האפליקציה",
    memberLanguageTemplate: "התאמה לשפת החבר/ה",
    appLanguageHelp: "אוטומטי: ההודעות נוצרות בשפת האפליקציה הנוכחית.",
    selectedTrigger: "טריגר",
    chooseClass: "בחרו שיעור...",
    chooseMember: "חפשו ובחרו לפחות חבר/ה אחד/ת.",
    chooseClassEmpty: "בחרו שיעור כדי לבנות קהל יעד.",
    noMembers: "אין חברים שתואמים לקהל הזה כרגע.",
    messagesReady: "הודעות מוכנות",
    copyAll: "העתקת הכל",
    prepareReminderDrafts: "הכנת טיוטות תזכורת",
    markAllSent: "סימון הכל כנשלח ידנית",
    working: "עובד...",
    credits: "קרדיטים",
    subject: "נושא",
    noPhone: "אין טלפון שמור",
    reset: "איפוס לתבנית",
    copy: "העתקה",
    sendWhatsApp: "שליחת WhatsApp",
    sending: "שולח...",
    openWhatsApp: "פתיחת WhatsApp",
    openEmail: "פתיחת אימייל",
    markSent: "סימון כנשלח ידנית",
    audienceClassRoster: "רשימת שיעור",
    audienceClassWaitlist: "רשימת המתנה",
    audienceLowCredits: "קרדיטים נמוכים (2 ומטה)",
    audiencePackageExpiring: "חבילה מסתיימת (7 ימים)",
    audienceFirstTimers: "מבקרים חדשים",
    audienceNoShow: "אי-הגעות אחרונות",
    audienceInactive: "לא פעילים 60+ ימים",
    audienceNoBooking: "ללא הזמנה קרובה",
  },
  ar: {
    title: "مركز الرسائل",
    intro:
      "حضّر رسائل واتساب وبريد إلكتروني من بيانات الاستوديو الحقيقية. كل رسالة يتم إنشاؤها تُسجّل في سجل الاستوديو.",
    composer: "إنشاء",
    templates: "القوالب",
    requests: "طلبات الباقات",
    logs: "سجل النشاط",
    push: "حملات iPhone",
    inbox: "صندوق المحادثات",
    deliveries: "عمليات التسليم",
    events: "مصفوفة الأحداث",
    audience: "الجمهور",
    specificMembers: "أعضاء محددون",
    searchMember: "ابحثي عن عضو بالاسم...",
    noContact: "لا توجد بيانات تواصل",
    searching: "جار البحث...",
    recipients: "مستلمون",
    template: "القالب",
    appLanguageTemplate: "استخدام لغة التطبيق الحالية",
    memberLanguageTemplate: "مطابقة لغة العضو",
    appLanguageHelp: "تلقائي: الرسائل تُنشأ بلغة التطبيق الحالية.",
    selectedTrigger: "المحفّز",
    chooseClass: "اختاري حصة...",
    chooseMember: "ابحثي واختاري عضواً واحداً على الأقل.",
    chooseClassEmpty: "اختاري حصة لبناء الجمهور.",
    noMembers: "لا يوجد أعضاء مطابقون لهذا الجمهور الآن.",
    messagesReady: "رسائل جاهزة",
    copyAll: "نسخ الكل",
    prepareReminderDrafts: "تحضير مسودات التذكير",
    markAllSent: "تحديد الكل كمرسل يدوياً",
    working: "جار العمل...",
    credits: "أرصدة",
    subject: "الموضوع",
    noPhone: "لا يوجد رقم هاتف محفوظ",
    reset: "إعادة إلى القالب",
    copy: "نسخ",
    sendWhatsApp: "إرسال واتساب",
    sending: "جار الإرسال...",
    openWhatsApp: "فتح واتساب",
    openEmail: "فتح البريد",
    markSent: "تحديد كمرسل يدوياً",
    audienceClassRoster: "قائمة الحصة",
    audienceClassWaitlist: "قائمة الانتظار",
    audienceLowCredits: "رصيد منخفض (2 أو أقل)",
    audiencePackageExpiring: "باقة تنتهي خلال 7 أيام",
    audienceFirstTimers: "زوار لأول مرة",
    audienceNoShow: "غيابات حديثة",
    audienceInactive: "غير نشطين 60+ يوم",
    audienceNoBooking: "لا يوجد حجز قادم",
  },
};

const MEMBER_LANGUAGE_TEMPLATE = "__member_language";
const CLASS_CONTEXT_TRIGGERS = new Set([
  "booking_confirmation",
  "cancellation_confirmation",
  "class_reminder",
  "waitlist_spot",
  "no_show_followup",
]);

const MESSAGE_FALLBACKS: Record<
  Lang,
  {
    memberName: string;
    studioName: string;
    className: string;
    roomName: string;
    instructorName: string;
    packageName: string;
    cancellationUnit: string;
  }
> = {
  en: {
    memberName: "there",
    studioName: "the studio",
    className: "your class",
    roomName: "the studio",
    instructorName: "your instructor",
    packageName: "your package",
    cancellationUnit: "h",
  },
  he: {
    memberName: "שם",
    studioName: "הסטודיו",
    className: "השיעור שלך",
    roomName: "הסטודיו",
    instructorName: "המדריכה",
    packageName: "החבילה שלך",
    cancellationUnit: " שעות",
  },
  ar: {
    memberName: "عزيزتنا",
    studioName: "الاستوديو",
    className: "حصتك",
    roomName: "الاستوديو",
    instructorName: "المدربة",
    packageName: "باقتك",
    cancellationUnit: " ساعات",
  },
};

const MESSAGE_LOCALES: Record<Lang, string> = {
  en: "en-GB",
  he: "he-IL",
  ar: "ar",
};

function pageCopy(lang: Lang) {
  return PAGE_COPY[lang] ?? PAGE_COPY.en;
}

function audienceLabel(kind: AudienceKind, copy: Record<string, string>) {
  const labels: Record<AudienceKind, string> = {
    class_roster: copy.audienceClassRoster,
    class_waitlist: copy.audienceClassWaitlist,
    low_credits: copy.audienceLowCredits,
    package_expiring: copy.audiencePackageExpiring,
    first_timers: copy.audienceFirstTimers,
    no_show_recent: copy.audienceNoShow,
    inactive_60d: copy.audienceInactive,
    no_upcoming_booking: copy.audienceNoBooking,
    specific: copy.specificMembers,
  };
  return labels[kind] ?? kind;
}

function Page() {
  const { lang, t } = useI18n();
  useDocumentTitle("page.messages.title");
  const copy = pageCopy(lang);
  const [tab, setTab] = useState<Tab>("composer");
  return (
    <AdminPageShell>
      <AdminPageHeader title={t("messages.center")} description={copy.intro} />

      <div className="flex gap-2 border-b border-gold/30 overflow-x-auto">
        {(
          [
            { k: "inbox", l: "Inbox" },
            { k: "deliveries", l: "Deliveries" },
            { k: "events", l: "Event matrix" },
            { k: "composer", l: "Compose" },
            { k: "push", l: "iPhone campaigns" },
            { k: "templates", l: "Templates" },
            { k: "requests", l: "Package requests" },
            { k: "logs", l: "Activity log" },
          ] as { k: Tab; l: string }[]
        ).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`-mb-px border-b-2 px-4 py-2 text-xs font-medium transition ${
              tab === t.k
                ? "border-gold text-navy"
                : "border-transparent text-slate hover:text-navy/85"
            }`}
          >
            {copy[t.k] ?? t.l}
          </button>
        ))}
      </div>

      {tab === "composer" && <ComposerTab />}
      {tab === "inbox" && <CanonicalInboxTab />}
      {tab === "deliveries" && <CanonicalDeliveriesTab />}
      {tab === "events" && <NotificationEventRolloutsTab />}
      {tab === "push" && <AdminPushCampaigns />}
      {tab === "templates" && (
        <div className="space-y-6">
          <TemplateDeploymentStatus />
          <TemplatesTab />
        </div>
      )}
      {tab === "requests" && <RequestsTab />}
      {tab === "logs" && <LogsTab />}
    </AdminPageShell>
  );
}

function CanonicalInboxTab() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listCanonicalConversations);
  const detailFn = useServerFn(getCanonicalConversation);
  const claimFn = useServerFn(claimCanonicalConversation);
  const releaseFn = useServerFn(releaseCanonicalConversation);
  const resolveFn = useServerFn(resolveCanonicalConversation);
  const replyFn = useServerFn(replyCanonicalConversation);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const conversations = useQuery({
    queryKey: ["canonical-conversations"],
    queryFn: () => listFn(),
  });
  const detail = useQuery({
    queryKey: ["canonical-conversation", selectedId],
    queryFn: () => detailFn({ data: { conversationId: selectedId! } }),
    enabled: Boolean(selectedId),
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["canonical-conversations"] }),
      queryClient.invalidateQueries({ queryKey: ["canonical-conversation", selectedId] }),
    ]);
  };
  const action = useMutation({
    mutationFn: async (kind: "claim" | "release" | "resolve") => {
      if (!selectedId) return;
      if (kind === "claim") return claimFn({ data: { conversationId: selectedId } });
      if (kind === "release") return releaseFn({ data: { conversationId: selectedId } });
      return resolveFn({ data: { conversationId: selectedId } });
    },
    onSuccess: refresh,
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Conversation action failed"),
  });
  const sendReply = useMutation({
    mutationFn: async (useHandoffTemplate: boolean) => {
      if (!selectedId) return;
      return replyFn({
        data: {
          conversationId: selectedId,
          ...(useHandoffTemplate ? { useHandoffTemplate: true } : { text: reply }),
        },
      });
    },
    onSuccess: async () => {
      setReply("");
      await refresh();
      toast.success("Reply queued");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Reply failed"),
  });
  const selectedConversation = detail.data?.conversation;
  const windowOpen = Boolean(
    selectedConversation?.service_window_expires_at &&
    new Date(selectedConversation.service_window_expires_at) > new Date(),
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <section className="editorial-panel divide-y divide-gold/15 overflow-hidden">
        {(conversations.data ?? []).map((conversation: any) => {
          const member = Array.isArray(conversation.member)
            ? conversation.member[0]
            : conversation.member;
          return (
            <button
              key={conversation.id}
              type="button"
              onClick={() => setSelectedId(conversation.id)}
              className={`w-full p-4 text-start ${selectedId === conversation.id ? "bg-powder/50" : "hover:bg-sand/35"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-navy">
                  {member?.name ?? "Guest conversation"}
                </span>
                <span className="rounded-full bg-sand px-2 py-1 text-[10px] uppercase text-slate">
                  {conversation.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate">
                {conversation.last_inbound_at
                  ? new Date(conversation.last_inbound_at).toLocaleString()
                  : "No inbound timestamp"}
              </p>
            </button>
          );
        })}
        {!conversations.isLoading && !conversations.data?.length && (
          <p className="p-6 text-sm text-slate">No WhatsApp handoffs.</p>
        )}
      </section>

      <section className="editorial-panel flex min-h-[520px] flex-col p-5">
        {!selectedId ? (
          <p className="m-auto text-sm text-slate">Choose a conversation.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/15 pb-4">
              <div>
                <p className="font-semibold text-navy">WhatsApp handoff</p>
                <p className="text-xs text-slate">
                  {windowOpen ? "24-hour service window open" : "Service window closed"}
                </p>
              </div>
              <div className="flex gap-2">
                {selectedConversation?.status === "unassigned" && (
                  <button
                    className="btn-outline px-3 py-2 text-xs"
                    onClick={() => action.mutate("claim")}
                  >
                    Claim
                  </button>
                )}
                {selectedConversation?.status === "claimed" && (
                  <button
                    className="btn-outline px-3 py-2 text-xs"
                    onClick={() => action.mutate("release")}
                  >
                    Release
                  </button>
                )}
                {selectedConversation?.status !== "resolved" && (
                  <button
                    className="btn-outline px-3 py-2 text-xs"
                    onClick={() => action.mutate("resolve")}
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto py-4">
              {(detail.data?.messages ?? []).map((message: any) => (
                <div
                  key={message.id}
                  className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${
                    message.direction === "inbound"
                      ? "bg-sand text-navy"
                      : "ms-auto bg-navy text-ivory"
                  }`}
                >
                  <p className="whitespace-pre-wrap">
                    {message.body || `[${message.content?.message_type ?? "message"}]`}
                  </p>
                  <p className="mt-1 text-[10px] opacity-60">
                    {new Date(message.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
            <div className="border-t border-gold/15 pt-4">
              {windowOpen ? (
                <div className="flex gap-2">
                  <textarea
                    className="editorial-input min-h-20 flex-1"
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="Reply within the customer-service window"
                  />
                  <button
                    className="cta-navy self-end px-4 py-2 text-xs"
                    disabled={!reply.trim() || sendReply.isPending}
                    onClick={() => sendReply.mutate(false)}
                  >
                    Queue reply
                  </button>
                </div>
              ) : (
                <button
                  className="cta-navy px-4 py-2 text-xs"
                  disabled={sendReply.isPending}
                  onClick={() => sendReply.mutate(true)}
                >
                  Queue approved handoff template
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function CanonicalDeliveriesTab() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listCanonicalDeliveries);
  const retryFn = useServerFn(retryCanonicalDeliveryAction);
  const deliveries = useQuery({ queryKey: ["canonical-deliveries"], queryFn: () => listFn() });
  const retry = useMutation({
    mutationFn: (deliveryId: string) => retryFn({ data: { deliveryId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["canonical-deliveries"] }),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Retry failed"),
  });
  return (
    <div className="editorial-panel overflow-x-auto">
      <table className="w-full min-w-[760px] text-start text-sm">
        <thead className="border-b border-gold/20 text-xs uppercase text-slate">
          <tr>
            <th className="p-4">Message</th>
            <th className="p-4">Channel</th>
            <th className="p-4">Status</th>
            <th className="p-4">Attempts</th>
            <th className="p-4">Devices</th>
            <th className="p-4">Error</th>
            <th className="p-4" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gold/15">
          {(deliveries.data ?? []).map((delivery: any) => {
            const message = Array.isArray(delivery.message)
              ? delivery.message[0]
              : delivery.message;
            const retryable = ["failed", "dead_letter", "suppressed"].includes(delivery.status);
            return (
              <tr key={delivery.id}>
                <td className="p-4 text-navy">
                  {message?.subject ?? message?.event_type ?? delivery.message_id}
                </td>
                <td className="p-4 text-slate">{delivery.channel}</td>
                <td className="p-4">
                  <span className="rounded-full bg-sand px-2 py-1 text-xs">{delivery.status}</span>
                </td>
                <td className="p-4 text-slate">{delivery.attempt_count}</td>
                <td className="p-4 text-slate">
                  {delivery.channel === "push"
                    ? `${(delivery.targets ?? []).filter((target: any) => ["sent", "device_received"].includes(target.status)).length}/${(delivery.targets ?? []).length}`
                    : "—"}
                </td>
                <td className="max-w-xs truncate p-4 text-slate">
                  {delivery.error_code ?? delivery.error_message ?? "—"}
                </td>
                <td className="p-4 text-end">
                  {retryable && (
                    <button
                      className="btn-outline px-3 py-1.5 text-xs"
                      onClick={() => retry.mutate(delivery.id)}
                    >
                      Retry
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NotificationEventRolloutsTab() {
  const listFn = useServerFn(listNotificationEventRollouts);
  const updateFn = useServerFn(updateNotificationEventRollout);
  const queryClient = useQueryClient();
  const events = useQuery({ queryKey: ["notification-event-rollouts"], queryFn: () => listFn() });
  const updateRollout = useMutation({
    mutationFn: (input: {
      eventType: string;
      enabled: boolean;
      copyReviewed: boolean;
      allowlistOnly: boolean;
      enabledChannels: Array<"in_app" | "push" | "email" | "whatsapp">;
    }) => updateFn({ data: input }),
    onSuccess: () => {
      toast.success("Notification rollout updated");
      void queryClient.invalidateQueries({ queryKey: ["notification-event-rollouts"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed"),
  });
  const grouped = useMemo(() => {
    const values = new Map<string, any[]>();
    for (const event of events.data ?? []) {
      values.set(event.family, [...(values.get(event.family) ?? []), event]);
    }
    return [...values.entries()];
  }, [events.data]);

  return (
    <div className="space-y-5">
      <section className="editorial-panel p-5">
        <p className="eyebrow">Safe rollout control</p>
        <h3 className="text-lg font-semibold text-navy">Premium notification event matrix</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate">
          New event families remain dark until localized copy is reviewed and the database rollout
          is enabled. Global disabled/allowlist mode and channel kill switches still apply.
        </p>
      </section>
      {grouped.map(([family, familyEvents]) => (
        <section key={family} className="editorial-panel overflow-hidden">
          <div className="border-b border-gold/15 px-5 py-4">
            <h3 className="font-semibold capitalize text-navy">{family}</h3>
          </div>
          <div className="divide-y divide-gold/10">
            {familyEvents.map((event: any) => {
              const enabled = event.rollout?.enabled ?? event.defaultEnabled;
              const reviewed = event.rollout?.copy_reviewed ?? event.copyStatus === "approved";
              const allowlistOnly = event.rollout?.allowlist_only ?? !event.defaultEnabled;
              const enabledChannels = (event.rollout?.enabled_channels ?? event.channels) as Array<
                "in_app" | "push" | "email" | "whatsapp"
              >;
              const save = (
                changes: Partial<{
                  enabled: boolean;
                  copyReviewed: boolean;
                  allowlistOnly: boolean;
                  enabledChannels: typeof enabledChannels;
                }>,
              ) =>
                updateRollout.mutate({
                  eventType: event.eventType,
                  enabled,
                  copyReviewed: reviewed,
                  allowlistOnly,
                  enabledChannels,
                  ...changes,
                });
              return (
                <div
                  key={event.eventType}
                  className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(220px,1fr)_minmax(220px,auto)_auto] md:items-center"
                >
                  <div>
                    <p className="font-medium text-navy">{event.eventType.replaceAll("_", " ")}</p>
                    <p className="mt-1 text-xs text-slate">
                      {event.tier} · {event.channels.join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {event.channels.map((channel: "in_app" | "push" | "email" | "whatsapp") => (
                      <label
                        key={channel}
                        className="flex items-center gap-1.5 rounded-full bg-white/60 px-2.5 py-1 text-[10px] uppercase text-slate"
                      >
                        <input
                          type="checkbox"
                          checked={enabledChannels.includes(channel)}
                          disabled={channel === "in_app" || updateRollout.isPending}
                          onChange={(input) =>
                            save({
                              enabledChannels: input.target.checked
                                ? [...enabledChannels, channel]
                                : enabledChannels.filter((value) => value !== channel),
                            })
                          }
                          className="accent-navy"
                        />
                        {channel}
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {enabled && reviewed && (
                      <button
                        type="button"
                        disabled={updateRollout.isPending}
                        onClick={() => save({ allowlistOnly: !allowlistOnly })}
                        className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase ${
                          allowlistOnly
                            ? "border-amber-300 bg-amber-50 text-amber-800"
                            : "border-emerald-300 bg-emerald-50 text-emerald-800"
                        }`}
                      >
                        {allowlistOnly ? "Allowlist only" : "Live eligible"}
                      </button>
                    )}
                    {!reviewed && (
                      <button
                        type="button"
                        disabled={updateRollout.isPending}
                        onClick={() => save({ copyReviewed: true })}
                        className="rounded-full border border-gold/30 px-3 py-1.5 text-[10px] font-semibold uppercase text-navy"
                      >
                        Mark copy reviewed
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!reviewed || updateRollout.isPending}
                      onClick={() => save({ enabled: !enabled })}
                      className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase ${
                        enabled ? "bg-navy text-white" : "bg-sand text-slate"
                      }`}
                    >
                      {enabled ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function TemplateDeploymentStatus() {
  const listFn = useServerFn(listWhatsappTemplateDeployments);
  const deployments = useQuery({
    queryKey: ["whatsapp-template-deployments"],
    queryFn: () => listFn(),
  });
  return (
    <section className="editorial-panel p-5">
      <div className="mb-4">
        <p className="eyebrow">WhatsApp Cloud API</p>
        <h3 className="text-lg font-semibold text-navy">Versioned deployment status</h3>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {(deployments.data ?? []).map((deployment: any) => (
          <div key={deployment.id} className="rounded-xl border border-gold/15 bg-white/60 p-3">
            <p className="truncate text-sm font-medium text-navy">{deployment.template_name}</p>
            <div className="mt-1 flex items-center justify-between text-xs text-slate">
              <span>{deployment.language}</span>
              <span>{deployment.approval_status}</span>
            </div>
          </div>
        ))}
        {!deployments.data?.length && (
          <p className="text-sm text-slate">
            No v2 deployment status synced yet. Run plan mode first; apply remains explicit.
          </p>
        )}
      </div>
    </section>
  );
}

/* ---------------- Composer ---------------- */

type AudienceKind =
  | "class_roster"
  | "class_waitlist"
  | "low_credits"
  | "package_expiring"
  | "first_timers"
  | "no_show_recent"
  | "inactive_60d"
  | "no_upcoming_booking"
  | "specific";

const AUDIENCE_OPTIONS: { k: AudienceKind; l: string; needsClass?: boolean; trigger?: string }[] = [
  { k: "class_roster", l: "Class roster", needsClass: true, trigger: "class_reminder" },
  { k: "class_waitlist", l: "Class waitlist", needsClass: true, trigger: "waitlist_spot" },
  { k: "low_credits", l: "Low credits (≤2)", trigger: "low_credits" },
  { k: "package_expiring", l: "Package expiring (7d)", trigger: "package_expiring" },
  { k: "first_timers", l: "First-time visitors", trigger: "trial_followup" },
  { k: "no_show_recent", l: "Recent no-shows", trigger: "no_show_followup" },
  { k: "inactive_60d", l: "Inactive 60+ days", trigger: "manual" },
  { k: "no_upcoming_booking", l: "No upcoming booking", trigger: "manual" },
  { k: "specific", l: "Specific member(s)", trigger: "manual" },
];

const LANGUAGE_FLAGS: Record<string, string> = { en: "🇬🇧", he: "🇮🇱", ar: "🇸🇦" };
const DEFAULT_LOCALIZED_TEMPLATES = [
  {
    id: "default_class_reminder_en",
    key: "default_class_reminder_en",
    label: "Class reminder · English",
    channel: "whatsapp",
    language: "en",
    trigger_type: "class_reminder",
    subject: null,
    active: true,
    body: "Hi {{member_name}}, this is a gentle reminder for {{class_name}} on {{class_date}} at {{class_time}} with {{instructor_name}} in {{room_name}}. See you at the studio. — {{studio_name}}",
  },
  {
    id: "default_class_reminder_he",
    key: "default_class_reminder_he",
    label: "תזכורת לשיעור · עברית",
    channel: "whatsapp",
    language: "he",
    trigger_type: "class_reminder",
    subject: null,
    active: true,
    body: "היי {{member_name}}, תזכורת נעימה לשיעור {{class_name}} ביום {{class_date}} בשעה {{class_time}} עם {{instructor_name}} ב{{room_name}}. מחכים לך בסטודיו. — {{studio_name}}",
  },
  {
    id: "default_class_reminder_ar",
    key: "default_class_reminder_ar",
    label: "تذكير بالحصة · العربية",
    channel: "whatsapp",
    language: "ar",
    trigger_type: "class_reminder",
    subject: null,
    active: true,
    body: "مرحباً {{member_name}}، تذكير لطيف بحصة {{class_name}} يوم {{class_date}} الساعة {{class_time}} مع {{instructor_name}} في {{room_name}}. نراك في الاستوديو. — {{studio_name}}",
  },
  {
    id: "default_booking_confirmation_en",
    key: "default_booking_confirmation_en",
    label: "Booking confirmation · English",
    channel: "whatsapp",
    language: "en",
    trigger_type: "booking_confirmation",
    subject: null,
    active: true,
    body: "Hi {{member_name}}, your spot is confirmed for {{class_name}} on {{class_date}} at {{class_time}}. Cancel up to {{cancellation_deadline}} before class. — {{studio_name}}",
  },
  {
    id: "default_booking_confirmation_he",
    key: "default_booking_confirmation_he",
    label: "אישור הזמנה · עברית",
    channel: "whatsapp",
    language: "he",
    trigger_type: "booking_confirmation",
    subject: null,
    active: true,
    body: "היי {{member_name}}, המקום שלך אושר לשיעור {{class_name}} ביום {{class_date}} בשעה {{class_time}}. ניתן לבטל עד {{cancellation_deadline}} לפני השיעור. — {{studio_name}}",
  },
  {
    id: "default_booking_confirmation_ar",
    key: "default_booking_confirmation_ar",
    label: "تأكيد الحجز · العربية",
    channel: "whatsapp",
    language: "ar",
    trigger_type: "booking_confirmation",
    subject: null,
    active: true,
    body: "مرحباً {{member_name}}، تم تأكيد مكانك في حصة {{class_name}} يوم {{class_date}} الساعة {{class_time}}. يمكن الإلغاء حتى {{cancellation_deadline}} قبل الحصة. — {{studio_name}}",
  },
  {
    id: "default_cancellation_confirmation_en",
    key: "default_cancellation_confirmation_en",
    label: "Cancellation confirmation · English",
    channel: "whatsapp",
    language: "en",
    trigger_type: "cancellation_confirmation",
    subject: null,
    active: true,
    body: "Hi {{member_name}}, your booking for {{class_name}} on {{class_date}} has been cancelled. Your credit is back in your account. — {{studio_name}}",
  },
  {
    id: "default_cancellation_confirmation_he",
    key: "default_cancellation_confirmation_he",
    label: "אישור ביטול · עברית",
    channel: "whatsapp",
    language: "he",
    trigger_type: "cancellation_confirmation",
    subject: null,
    active: true,
    body: "היי {{member_name}}, ההזמנה שלך לשיעור {{class_name}} ביום {{class_date}} בוטלה. הקרדיט חזר לחשבון שלך. — {{studio_name}}",
  },
  {
    id: "default_cancellation_confirmation_ar",
    key: "default_cancellation_confirmation_ar",
    label: "تأكيد الإلغاء · العربية",
    channel: "whatsapp",
    language: "ar",
    trigger_type: "cancellation_confirmation",
    subject: null,
    active: true,
    body: "مرحباً {{member_name}}، تم إلغاء حجزك لحصة {{class_name}} يوم {{class_date}}. تمت إعادة الرصيد إلى حسابك. — {{studio_name}}",
  },
  {
    id: "default_waitlist_spot_en",
    key: "default_waitlist_spot_en",
    label: "Waitlist spot · English",
    channel: "whatsapp",
    language: "en",
    trigger_type: "waitlist_spot",
    subject: null,
    active: true,
    body: "Hi {{member_name}}, a spot opened for {{class_name}} on {{class_date}} at {{class_time}}. Reply to claim it, or open your Cloud Card. — {{studio_name}}",
  },
  {
    id: "default_waitlist_spot_he",
    key: "default_waitlist_spot_he",
    label: "מקום מרשימת המתנה · עברית",
    channel: "whatsapp",
    language: "he",
    trigger_type: "waitlist_spot",
    subject: null,
    active: true,
    body: "היי {{member_name}}, התפנה מקום לשיעור {{class_name}} ביום {{class_date}} בשעה {{class_time}}. אפשר להשיב להודעה כדי לתפוס את המקום. — {{studio_name}}",
  },
  {
    id: "default_waitlist_spot_ar",
    key: "default_waitlist_spot_ar",
    label: "مكان من قائمة الانتظار · العربية",
    channel: "whatsapp",
    language: "ar",
    trigger_type: "waitlist_spot",
    subject: null,
    active: true,
    body: "مرحباً {{member_name}}، أصبح هناك مكان متاح في حصة {{class_name}} يوم {{class_date}} الساعة {{class_time}}. ردي على الرسالة لحجزه. — {{studio_name}}",
  },
  {
    id: "default_low_credits_en",
    key: "default_low_credits_en",
    label: "Low credits · English",
    channel: "whatsapp",
    language: "en",
    trigger_type: "low_credits",
    subject: null,
    active: true,
    body: "Hi {{member_name}}, you have {{credits_remaining}} credits left. Want us to help renew your package? Just reply here. — {{studio_name}}",
  },
  {
    id: "default_low_credits_he",
    key: "default_low_credits_he",
    label: "קרדיטים נמוכים · עברית",
    channel: "whatsapp",
    language: "he",
    trigger_type: "low_credits",
    subject: null,
    active: true,
    body: "היי {{member_name}}, נשארו לך {{credits_remaining}} קרדיטים. רוצה שנעזור לחדש את החבילה? אפשר פשוט להשיב כאן. — {{studio_name}}",
  },
  {
    id: "default_low_credits_ar",
    key: "default_low_credits_ar",
    label: "رصيد منخفض · العربية",
    channel: "whatsapp",
    language: "ar",
    trigger_type: "low_credits",
    subject: null,
    active: true,
    body: "مرحباً {{member_name}}، تبقى لديك {{credits_remaining}} أرصدة. هل ترغبين بمساعدتنا لتجديد الباقة؟ ردي هنا فقط. — {{studio_name}}",
  },
  {
    id: "default_package_expiring_en",
    key: "default_package_expiring_en",
    label: "Package expiring · English",
    channel: "whatsapp",
    language: "en",
    trigger_type: "package_expiring",
    subject: null,
    active: true,
    body: "Hi {{member_name}}, your {{package_name}} package expires on {{package_expiry}}. Reply here if you want help renewing it. — {{studio_name}}",
  },
  {
    id: "default_package_expiring_he",
    key: "default_package_expiring_he",
    label: "חבילה עומדת להסתיים · עברית",
    channel: "whatsapp",
    language: "he",
    trigger_type: "package_expiring",
    subject: null,
    active: true,
    body: "היי {{member_name}}, חבילת {{package_name}} שלך מסתיימת בתאריך {{package_expiry}}. אפשר להשיב כאן אם תרצה עזרה בחידוש. — {{studio_name}}",
  },
  {
    id: "default_package_expiring_ar",
    key: "default_package_expiring_ar",
    label: "انتهاء الباقة · العربية",
    channel: "whatsapp",
    language: "ar",
    trigger_type: "package_expiring",
    subject: null,
    active: true,
    body: "مرحباً {{member_name}}، باقة {{package_name}} الخاصة بك تنتهي بتاريخ {{package_expiry}}. ردي هنا إذا أردت المساعدة في التجديد. — {{studio_name}}",
  },
  {
    id: "default_trial_followup_en",
    key: "default_trial_followup_en",
    label: "Trial follow-up · English",
    channel: "whatsapp",
    language: "en",
    trigger_type: "trial_followup",
    subject: null,
    active: true,
    body: "Hi {{member_name}}, thank you for visiting {{studio_name}}. We hope the class felt good. Reply here and we will help you choose your next session.",
  },
  {
    id: "default_trial_followup_he",
    key: "default_trial_followup_he",
    label: "מעקב אחרי ניסיון · עברית",
    channel: "whatsapp",
    language: "he",
    trigger_type: "trial_followup",
    subject: null,
    active: true,
    body: "היי {{member_name}}, תודה שביקרת ב{{studio_name}}. מקווים שהשיעור הרגיש טוב. אפשר להשיב כאן ונעזור לבחור את השיעור הבא.",
  },
  {
    id: "default_trial_followup_ar",
    key: "default_trial_followup_ar",
    label: "متابعة بعد التجربة · العربية",
    channel: "whatsapp",
    language: "ar",
    trigger_type: "trial_followup",
    subject: null,
    active: true,
    body: "مرحباً {{member_name}}، شكراً لزيارتك {{studio_name}}. نأمل أن تكون الحصة مريحة ومناسبة. ردي هنا وسنساعدك في اختيار الحصة القادمة.",
  },
  {
    id: "default_no_show_followup_en",
    key: "default_no_show_followup_en",
    label: "No-show follow-up · English",
    channel: "whatsapp",
    language: "en",
    trigger_type: "no_show_followup",
    subject: null,
    active: true,
    body: "Hi {{member_name}}, we missed you at {{class_name}} on {{class_date}}. Is everything okay? Reply here and we will help. — {{studio_name}}",
  },
  {
    id: "default_no_show_followup_he",
    key: "default_no_show_followup_he",
    label: "מעקב אחרי אי-הגעה · עברית",
    channel: "whatsapp",
    language: "he",
    trigger_type: "no_show_followup",
    subject: null,
    active: true,
    body: "היי {{member_name}}, התגעגענו אליך בשיעור {{class_name}} ביום {{class_date}}. הכול בסדר? אפשר להשיב כאן ונעזור. — {{studio_name}}",
  },
  {
    id: "default_no_show_followup_ar",
    key: "default_no_show_followup_ar",
    label: "متابعة عدم الحضور · العربية",
    channel: "whatsapp",
    language: "ar",
    trigger_type: "no_show_followup",
    subject: null,
    active: true,
    body: "مرحباً {{member_name}}، افتقدناك في حصة {{class_name}} يوم {{class_date}}. هل كل شيء بخير؟ ردي هنا وسنساعدك. — {{studio_name}}",
  },
  {
    id: "default_manual_en",
    key: "default_manual_en",
    label: "Manual message · English",
    channel: "whatsapp",
    language: "en",
    trigger_type: "manual",
    subject: null,
    active: true,
    body: "Hi {{member_name}}, this is {{studio_name}}. We wanted to check in and help you choose your next practice. Reply here whenever it is convenient.",
  },
  {
    id: "default_manual_he",
    key: "default_manual_he",
    label: "הודעה ידנית · עברית",
    channel: "whatsapp",
    language: "he",
    trigger_type: "manual",
    subject: null,
    active: true,
    body: "היי {{member_name}}, זה {{studio_name}}. רצינו לבדוק מה שלומך ולעזור לבחור את התרגול הבא שלך. אפשר להשיב כאן מתי שנוח.",
  },
  {
    id: "default_manual_ar",
    key: "default_manual_ar",
    label: "رسالة يدوية · العربية",
    channel: "whatsapp",
    language: "ar",
    trigger_type: "manual",
    subject: null,
    active: true,
    body: "مرحباً {{member_name}}، معك {{studio_name}}. أردنا الاطمئنان عليك ومساعدتك في اختيار التمرين القادم. يمكنك الرد هنا في أي وقت مناسب.",
  },
];
const PREVIEW_VARS = {
  member_name: "Rima",
  class_name: "Morning Flow",
  class_date: "Mon, Jun 23",
  class_time: "08:00",
  room_name: "Studio A",
  instructor_name: "Lena",
  studio_name: "Cloud & Core Studio",
  studio_phone: "+972-50-000-0000",
  studio_whatsapp: "+972-50-000-0000",
  credits_remaining: 4,
  package_name: "Monthly",
  package_expiry: "30/07/2026",
  waitlist_position: 1,
  cancellation_deadline: "2h",
};

function mergeTemplatesWithLocalizedDefaults(templates: any[]) {
  const existing = new Set(
    templates
      .filter((t) => t.active !== false)
      .map((t) => `${t.trigger_type}:${t.language}:${t.channel}`),
  );
  return [
    ...templates,
    ...DEFAULT_LOCALIZED_TEMPLATES.filter(
      (t) => !existing.has(`${t.trigger_type}:${t.language}:${t.channel}`),
    ),
  ];
}

function templateDbId(template: any): string | null {
  return typeof template?.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(template.id)
    ? template.id
    : null;
}

function normalizeMessageLang(lang?: string | null): Lang {
  return lang === "he" || lang === "ar" || lang === "en" ? lang : "en";
}

function templateNeedsClass(template: any) {
  return CLASS_CONTEXT_TRIGGERS.has(template?.trigger_type);
}

function templateFitsContext(template: any, trigger: string | undefined, cls: any) {
  if (!template?.active) return false;
  if (trigger && template.trigger_type !== trigger) return false;
  if (templateNeedsClass(template) && !cls) return false;
  return true;
}

function pickBestTemplate(
  templates: any[],
  member: any,
  preferredTrigger: string | undefined,
  preferredLanguage?: Lang | null,
  cls?: any,
): any {
  const lang = normalizeMessageLang(preferredLanguage ?? member.preferred_language ?? "en");
  const candidates = templates.filter((t) => t.active);
  const triggerMatch = candidates.filter((t) => templateFitsContext(t, preferredTrigger, cls));
  const scoped = triggerMatch.length
    ? triggerMatch
    : candidates.filter((t) => templateFitsContext(t, "manual", cls));
  return (
    scoped.find((t) => t.language === lang) ?? scoped.find((t) => t.language === "en") ?? scoped[0]
  );
}

function renderMemberMessage({
  member,
  templates,
  preferredTrigger,
  selectedTemplate,
  preferredLanguage,
  settings,
  cls,
}: {
  member: any;
  templates: any[];
  preferredTrigger: string | undefined;
  selectedTemplate?: any | null;
  preferredLanguage?: Lang | null;
  settings: any;
  cls: any;
}) {
  const ctxCls = cls ?? member.context?.class;
  const safeSelectedTemplate =
    selectedTemplate && templateFitsContext(selectedTemplate, preferredTrigger, ctxCls)
      ? selectedTemplate
      : null;
  const template =
    safeSelectedTemplate ??
    pickBestTemplate(templates, member, preferredTrigger, preferredLanguage, ctxCls);
  const messageLang = normalizeMessageLang(
    template?.language ?? preferredLanguage ?? member.preferred_language,
  );
  const vars = buildVars(member, settings, ctxCls, messageLang);
  const text = template ? renderTemplate(template.body ?? "", vars) : "";
  const subject = template?.subject ? renderTemplate(template.subject, vars) : null;
  return { template, ctxCls, text, subject };
}

function ComposerTab() {
  const { lang, t } = useI18n();
  const copy: Record<string, string> = {
    ...pageCopy(lang),
    chooseClass: t("messages.chooseClass"),
    chooseClassEmpty: t("messages.selectClass"),
    noMembers: t("messages.noAudience"),
  };
  const tplFn = useServerFn(listMessageTemplates);
  const audFn = useServerFn(buildAudience);
  const searchFn = useServerFn(searchMembersBasic);
  const classesFn = useServerFn(listClasses);
  const prepareReminderFn = useServerFn(prepareClassReminderDrafts);
  const settingsFn = useServerFn(getPublicStudioSettings);
  const logFn = useServerFn(logNotification);

  const { data: templates } = useQuery({ queryKey: ["msg-templates"], queryFn: () => tplFn() });
  const { data: classes } = useQuery({
    queryKey: ["admin-classes-min"],
    queryFn: () => classesFn(),
  });
  const { data: settings } = useQuery({
    queryKey: ["public-studio-settings"],
    queryFn: () => settingsFn(),
  });

  const [audienceKind, setAudienceKind] = useState<AudienceKind>("class_roster");
  const [classId, setClassId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);
  const [markingAll, setMarkingAll] = useState(false);
  const [preparingReminders, setPreparingReminders] = useState(false);
  const [editedMessages, setEditedMessages] = useState<Record<string, string>>({});

  const needsClass = AUDIENCE_OPTIONS.find((a) => a.k === audienceKind)?.needsClass;
  const isSpecificAudience = audienceKind === "specific";
  const canBuild = isSpecificAudience ? selectedMemberIds.length > 0 : !needsClass || !!classId;

  const memberResults = useQuery({
    queryKey: ["message-member-search", memberSearch],
    queryFn: () => searchFn({ data: { q: memberSearch } }),
    enabled: isSpecificAudience,
  });

  const audience = useQuery({
    queryKey: ["audience", audienceKind, classId, selectedMemberIds],
    queryFn: () =>
      audFn({
        data: isSpecificAudience
          ? { kind: "specific", memberIds: selectedMemberIds }
          : { kind: audienceKind, classId: classId || undefined },
      }),
    enabled: canBuild,
  });

  // Auto-pick template that matches audience trigger and active
  const matchingTriggerType = AUDIENCE_OPTIONS.find((a) => a.k === audienceKind)?.trigger;
  const templatesWithDefaults = useMemo(
    () => mergeTemplatesWithLocalizedDefaults(templates ?? []),
    [templates],
  );
  const sortedTemplates = useMemo(() => {
    const list = templatesWithDefaults.filter((t: any) => t.active && t.language === lang);
    const matching = list.filter((t: any) => t.trigger_type === matchingTriggerType);
    return matching.length ? matching : list.filter((t: any) => t.trigger_type === "manual");
  }, [templatesWithDefaults, matchingTriggerType, lang]);

  const activeTemplates = templatesWithDefaults.filter((t: any) => t.active);
  const selectedTemplate = templateId
    ? (activeTemplates.find((t: any) => t.id === templateId) ?? null)
    : null;
  const autoTemplateUsesMemberLanguage = templateId === MEMBER_LANGUAGE_TEMPLATE;
  const preferredTrigger = matchingTriggerType;
  const preferredLanguage = autoTemplateUsesMemberLanguage ? null : lang;
  const audienceMembers = audience.data?.members ?? [];
  const canPrepareClassReminders =
    audienceKind === "class_roster" && matchingTriggerType === "class_reminder" && !!classId;

  useEffect(() => {
    setTemplateId("");
  }, [lang, audienceKind]);

  function addMember(member: any) {
    if (selectedMemberIds.includes(member.id)) return;
    setSelectedMemberIds((ids) => [...ids, member.id]);
    setSelectedMembers((members) => [...members, member]);
    setMemberSearch("");
  }

  function removeMember(memberId: string) {
    setSelectedMemberIds((ids) => ids.filter((id) => id !== memberId));
    setSelectedMembers((members) => members.filter((m) => m.id !== memberId));
  }

  async function logForMember(member: any, status: "draft" | "manually_sent", text: string) {
    const rendered = renderMemberMessage({
      member,
      templates: activeTemplates,
      preferredTrigger,
      selectedTemplate,
      preferredLanguage,
      settings: settings ?? null,
      cls: audience.data?.cls,
    });
    if (!rendered.template) return;
    await logFn({
      data: {
        templateId: templateDbId(rendered.template),
        templateKey: rendered.template.key,
        triggerType: rendered.template.trigger_type,
        channel: rendered.template.channel,
        recipientMemberId: member.id,
        generatedText: text,
        subject: rendered.subject,
        status,
        relatedClassId: rendered.ctxCls?.id ?? null,
        relatedBookingId: null,
        relatedMemberPlanId: null,
      },
    });
  }

  async function handleCopyAll() {
    if (!audienceMembers.length) return;
    setMarkingAll(true);
    try {
      const messages = audienceMembers
        .map((member: any) => ({
          member,
          ...renderMemberMessage({
            member,
            templates: activeTemplates,
            preferredTrigger,
            selectedTemplate,
            preferredLanguage,
            settings: settings ?? null,
            cls: audience.data?.cls,
          }),
        }))
        .map((message) => ({ ...message, text: editedMessages[message.member.id] ?? message.text }))
        .filter((message) => message.template && message.text);
      await navigator.clipboard.writeText(
        messages.map((message) => message.text).join("\n\n---\n\n"),
      );
      await Promise.all(
        messages.map((message) => logForMember(message.member, "draft", message.text)),
      );
      toast.success(`Copied ${messages.length} messages to clipboard`);
    } catch {
      toast.error("Copy all failed");
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleMarkAllSent() {
    if (!audienceMembers.length) return;
    setMarkingAll(true);
    try {
      const messages = audienceMembers
        .map((member: any) => ({
          member,
          ...renderMemberMessage({
            member,
            templates: activeTemplates,
            preferredTrigger,
            selectedTemplate,
            preferredLanguage,
            settings: settings ?? null,
            cls: audience.data?.cls,
          }),
        }))
        .map((message) => ({ ...message, text: editedMessages[message.member.id] ?? message.text }))
        .filter((message) => message.template && message.text);
      await Promise.all(
        messages.map((message) => logForMember(message.member, "manually_sent", message.text)),
      );
      toast.success(`All ${messages.length} messages marked sent`);
    } catch {
      toast.error("Mark all failed");
    } finally {
      setMarkingAll(false);
    }
  }

  async function handlePrepareReminderDrafts() {
    if (!canPrepareClassReminders) return;
    setPreparingReminders(true);
    try {
      const result = await prepareReminderFn({ data: { classId } });
      toast.success(`Prepared ${result.prepared} reminder drafts`);
    } catch {
      toast.error("Prepare reminder drafts failed");
    } finally {
      setPreparingReminders(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-6">
      <aside className="space-y-5">
        <div className="editorial-panel p-5 space-y-3">
          <p className="eyebrow">{copy.audience}</p>
          <select
            className="editorial-input"
            value={audienceKind}
            onChange={(e) => {
              setAudienceKind(e.target.value as AudienceKind);
              setTemplateId("");
              setClassId("");
            }}
          >
            {AUDIENCE_OPTIONS.map((o) => (
              <option key={o.k} value={o.k}>
                {audienceLabel(o.k, copy)}
              </option>
            ))}
          </select>
          {needsClass && (
            <select
              className="editorial-input"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="">{copy.chooseClass}</option>
              {(classes ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {new Date(c.starts_at).toLocaleDateString()}{" "}
                  {new Date(c.starts_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {c.title}
                </option>
              ))}
            </select>
          )}
          {isSpecificAudience && (
            <div className="space-y-2">
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => removeMember(member.id)}
                      className="btn-outline inline-flex items-center gap-1.5 px-2 py-1 text-xs hover:btn-outline-hover"
                    >
                      {member.name}
                      <X className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              )}
              <input
                className="editorial-input"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder={copy.searchMember}
              />
              <div className="max-h-48 overflow-y-auto border border-gold/15 bg-ivory">
                {(memberResults.data ?? [])
                  .filter((member: any) => !selectedMemberIds.includes(member.id))
                  .map((member: any) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => addMember(member)}
                      className="w-full border-b border-gold/10 px-3 py-2 text-start last:border-b-0 hover:bg-gold/8"
                    >
                      <span className="block text-sm text-navy">{member.name}</span>
                      <span className="block text-xs text-slate">
                        {member.phone ?? member.email ?? copy.noContact}
                      </span>
                    </button>
                  ))}
                {memberResults.isLoading && (
                  <p className="px-3 py-2 text-xs font-medium text-slate">{copy.searching}</p>
                )}
              </div>
            </div>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate">
            <Users className="h-3 w-3 text-gold" /> {audience.data?.members.length ?? 0}{" "}
            {copy.recipients}
          </p>
        </div>

        <div className="editorial-panel p-5 space-y-3">
          <p className="eyebrow">{copy.template}</p>
          <select
            className="editorial-input"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">{copy.appLanguageTemplate}</option>
            <option value={MEMBER_LANGUAGE_TEMPLATE}>{copy.memberLanguageTemplate}</option>
            {sortedTemplates.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.channel === "whatsapp" ? "WA" : t.channel === "email" ? "Email" : "App"} ·{" "}
                {t.label} ({t.language})
              </option>
            ))}
          </select>
          {selectedTemplate ? (
            <p className="text-xs font-medium text-slate">
              {copy.selectedTrigger}:{" "}
              {TRIGGER_TYPES.find((x) => x.key === selectedTemplate.trigger_type)?.label ??
                selectedTemplate.trigger_type}
            </p>
          ) : (
            <p className="text-xs font-medium text-slate">
              {autoTemplateUsesMemberLanguage ? copy.memberLanguageTemplate : copy.appLanguageHelp}
            </p>
          )}
        </div>

        <VariableHelp />
      </aside>

      <main className="space-y-4">
        {!canBuild && (
          <Empty>{isSpecificAudience ? copy.chooseMember : copy.chooseClassEmpty}</Empty>
        )}
        {canBuild && audience.isLoading && <div className="skeleton-brand h-32 rounded-[8px]" />}
        {canBuild && audience.data && audience.data.members.length === 0 && (
          <Empty>{copy.noMembers}</Empty>
        )}
        {canBuild && audienceMembers.length > 1 && (
          <div className="sticky top-0 z-10 bg-ivory/90 backdrop-blur-sm border border-gold/20 rounded-[4px] px-5 py-3 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs font-medium text-slate">
              {audienceMembers.length} {copy.messagesReady}
            </p>
            <div className="flex flex-wrap gap-2">
              {canPrepareClassReminders && (
                <button
                  onClick={handlePrepareReminderDrafts}
                  disabled={preparingReminders}
                  className="btn-outline inline-flex items-center gap-1.5 px-3 py-2 text-xs hover:btn-outline-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-3 w-3" />{" "}
                  {preparingReminders ? copy.working : copy.prepareReminderDrafts}
                </button>
              )}
              <button
                onClick={handleCopyAll}
                disabled={markingAll}
                className="btn-outline inline-flex items-center gap-1.5 px-3 py-2 text-xs hover:btn-outline-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Copy className="h-3 w-3" /> {markingAll ? copy.working : copy.copyAll}
              </button>
              <button
                onClick={handleMarkAllSent}
                disabled={markingAll}
                className="btn-navy inline-flex items-center gap-1.5 px-3 py-2 text-xs hover:btn-navy-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-3 w-3" /> {markingAll ? copy.working : copy.markAllSent}
              </button>
            </div>
          </div>
        )}
        {canBuild &&
          activeTemplates.length > 0 &&
          audienceMembers.map((m: any) => (
            <PreviewRow
              key={m.id}
              member={m}
              allTemplates={activeTemplates}
              preferredTrigger={preferredTrigger}
              selectedTemplate={selectedTemplate}
              preferredLanguage={preferredLanguage}
              uiCopy={copy}
              settings={settings ?? null}
              cls={audience.data?.cls}
              onLogged={async (status, text) => logForMember(m, status, text)}
              onTextChange={(text) =>
                setEditedMessages((current) => {
                  if (!text) {
                    const { [m.id]: _, ...rest } = current;
                    return rest;
                  }
                  return { ...current, [m.id]: text };
                })
              }
            />
          ))}
      </main>
    </div>
  );
}

function VariableHelp() {
  return (
    <details className="editorial-panel p-5">
      <summary className="cursor-pointer text-xs font-medium text-slate">
        Available variables
      </summary>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUPPORTED_VARIABLES.map((v) => (
          <code
            key={v}
            className="inline-flex min-h-7 items-center rounded-full border border-gold/20 bg-sand/60 px-1.5 py-0.5 text-xs font-medium text-navy"
          >{`{{${v}}}`}</code>
        ))}
      </div>
    </details>
  );
}

function localizedStudioName(settings: any, lang: Lang, fallback: string) {
  const direct = settings?.[`studio_name_${lang}`];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const configured = typeof settings?.studio_name === "string" ? settings.studio_name.trim() : "";
  if (!configured) return fallback;
  if (lang === "en") return configured;
  return configured.replace(/\s+Studio$/i, "").trim() || fallback;
}

function formatMessageDate(iso: string, tz: string, lang: Lang) {
  try {
    return new Intl.DateTimeFormat(MESSAGE_LOCALES[lang], {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: tz,
    }).format(new Date(iso));
  } catch {
    return formatClassDate(iso, tz);
  }
}

function formatMessageTime(iso: string, tz: string, lang: Lang) {
  try {
    return new Intl.DateTimeFormat(MESSAGE_LOCALES[lang], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(new Date(iso));
  } catch {
    return formatClassTime(iso, tz);
  }
}

function buildVars(member: any, settings: any, cls: any, lang: Lang): Record<string, any> {
  const safeLang = normalizeMessageLang(lang);
  const fallback = MESSAGE_FALLBACKS[safeLang];
  const tz = settings?.timezone ?? "Asia/Jerusalem";
  const cancellationHours = cls?.cancellation_window_hours ?? 4;
  const classDate = cls ? formatMessageDate(cls.starts_at, tz, safeLang) : "";
  const classTime = cls ? formatMessageTime(cls.starts_at, tz, safeLang) : "";
  const firstName = member.name?.split(" ")[0] ?? member.name ?? fallback.memberName;
  const packageExpiry = member.context?.package_expiry
    ? new Date(member.context.package_expiry).toLocaleDateString(MESSAGE_LOCALES[safeLang])
    : "";
  const className = cls ? localizedClassTitle(cls, safeLang) : fallback.className;
  const instructorName = cls?.instructor?.name
    ? localizedInstructorName(cls.instructor.name, safeLang)
    : fallback.instructorName;
  const roomName = cls?.room_ref?.name ?? cls?.room ?? fallback.roomName;
  const packageName = member.context?.package_name ?? fallback.packageName;
  return {
    member_name: firstName,
    studio_name: localizedStudioName(settings, safeLang, fallback.studioName),
    studio_phone: settings?.public_phone ?? "",
    studio_whatsapp: settings?.whatsapp_number ?? "",
    credits_remaining: member.remaining_credits ?? 0,
    class_name: className,
    class_date: classDate,
    class_time: classTime,
    room_name: roomName,
    instructor_name: instructorName,
    cancellation_deadline:
      safeLang === "en"
        ? `${cancellationHours}h`
        : `${cancellationHours}${fallback.cancellationUnit}`,
    package_name: packageName,
    package_expiry: packageExpiry,
    waitlist_position: member.context?.waitlist_position ?? "",
    name: firstName,
    class_title: className,
    date: classDate,
    time: classTime,
    instructor: instructorName,
    plan_name: packageName,
    expires_on: packageExpiry,
  };
}

function PreviewRow({
  member,
  allTemplates,
  preferredTrigger,
  selectedTemplate,
  preferredLanguage,
  uiCopy,
  settings,
  cls,
  onLogged,
  onTextChange,
}: {
  member: any;
  allTemplates: any[];
  preferredTrigger: string | undefined;
  selectedTemplate?: any | null;
  preferredLanguage?: Lang | null;
  uiCopy: Record<string, string>;
  settings: any;
  cls: any;
  onLogged: (status: "draft" | "manually_sent", text: string) => Promise<void>;
  onTextChange?: (text: string | null) => void;
}) {
  const { template, ctxCls, text, subject } = renderMemberMessage({
    member,
    templates: allTemplates,
    preferredTrigger,
    selectedTemplate,
    preferredLanguage,
    settings,
    cls,
  });
  const [edited, setEdited] = useState<string | null>(null);
  const displayText = edited ?? text;

  useEffect(() => {
    setEdited(null);
    onTextChange?.(null);
  }, [member.id, onTextChange, template?.id, text]);

  const channel = template.channel as "whatsapp" | "email" | "in_app";
  async function copy(kind: "draft" | "manually_sent") {
    try {
      await navigator.clipboard.writeText(displayText);
      toast.success(kind === "manually_sent" ? "Copied. Marked manually sent." : "Copied draft");
      await onLogged(kind, displayText);
    } catch {
      toast.error("Copy failed");
    }
  }

  async function openWa() {
    const url = waUrl({ to: member.phone, text: displayText });
    window.open(url, "_blank", "noopener");
  }

  return (
    <article className="editorial-panel p-5 space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg text-navy truncate">
            {member.name}{" "}
            <span className="font-sans text-sm not-italic">
              {LANGUAGE_FLAGS[template.language] ?? template.language}
            </span>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-medium text-slate">
            <span className="inline-flex items-center gap-1">
              <ChannelIcon c={channel} />
              {channel}
            </span>
            {member.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {member.phone}
              </span>
            )}
            {!member.phone && channel === "whatsapp" && (
              <span className="text-navy">{uiCopy.noPhone}</span>
            )}
            <span>
              · {member.remaining_credits} {uiCopy.credits}
            </span>
          </p>
        </div>
      </header>
      {subject && (
        <p className="text-xs text-slate">
          <span className="font-medium">{uiCopy.subject}</span> · {subject}
        </p>
      )}
      <textarea
        className="w-full min-h-[80px] resize-none rounded-xl border border-gold/15 bg-sand/40 p-3 font-sans text-sm leading-relaxed text-navy whitespace-pre-wrap focus:border-gold/50 focus:outline-none"
        value={displayText}
        onChange={(e) => {
          setEdited(e.target.value);
          onTextChange?.(e.target.value);
        }}
      />
      {edited !== null && (
        <button
          onClick={() => {
            setEdited(null);
            onTextChange?.(null);
          }}
          className="btn-ghost text-xs hover:btn-ghost-hover"
        >
          {uiCopy.reset}
        </button>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={() => copy("draft")}
          className="btn-outline inline-flex items-center gap-1.5 px-3 py-2 text-xs hover:btn-outline-hover"
        >
          <Copy className="h-3 w-3" /> {uiCopy.copy}
        </button>
        {channel === "whatsapp" && (
          <>
            <button
              onClick={openWa}
              className="btn-outline inline-flex items-center gap-1.5 px-3 py-2 text-xs hover:btn-outline-hover"
            >
              <MessageCircle className="h-3 w-3" /> {uiCopy.openWhatsApp}
            </button>
          </>
        )}
        {channel === "email" && member.email && (
          <a
            href={`mailto:${member.email}?subject=${encodeURIComponent(subject ?? "")}&body=${encodeURIComponent(displayText)}`}
            className="btn-outline inline-flex items-center gap-1.5 px-3 py-2 text-xs hover:btn-outline-hover"
          >
            <Mail className="h-3 w-3" /> {uiCopy.openEmail}
          </a>
        )}
        <button
          onClick={() => copy("manually_sent")}
          className="btn-navy inline-flex items-center gap-1.5 px-3 py-2 text-xs hover:btn-navy-hover"
        >
          <Send className="h-3 w-3" /> {uiCopy.markSent}
        </button>
      </div>
    </article>
  );
}

function ChannelIcon({ c }: { c: string }) {
  if (c === "whatsapp") return <MessageCircle className="h-3 w-3 text-gold" />;
  if (c === "email") return <Mail className="h-3 w-3 text-gold" />;
  return <Sparkles className="h-3 w-3 text-gold" />;
}

/* ---------------- Templates ---------------- */

function TemplatesTab() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const listFn = useServerFn(listMessageTemplates);
  const upFn = useServerFn(upsertMessageTemplate);
  const dupFn = useServerFn(duplicateMessageTemplate);
  const togFn = useServerFn(setTemplateActive);
  const { data, isLoading } = useQuery({ queryKey: ["msg-templates"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<any | "new" | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["msg-templates"] });

  const save = useMutation({
    mutationFn: (v: any) => upFn({ data: v }),
    onSuccess: () => {
      toast.success("Saved");
      invalidate();
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const dup = useMutation({
    mutationFn: (id: string) => dupFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Duplicated");
      invalidate();
    },
  });
  const tog = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => togFn({ data: v }),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setEditing("new")} className="btn-navy hover:btn-navy-hover">
          <Plus className="h-3 w-3" /> New template
        </button>
      </div>

      {isLoading && <div className="skeleton-brand h-24 rounded-[8px]" />}
      {data && data.length === 0 && <Empty>{t("messages.noTemplates")}</Empty>}

      <div className="grid md:grid-cols-2 gap-4">
        {(data ?? []).map((t: any) => (
          <article
            key={t.id}
            className={`editorial-panel p-5 space-y-3 ${!t.active ? "opacity-60" : ""}`}
          >
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-lg text-navy">{t.label}</p>
                <p className="mt-0.5 text-xs font-medium text-slate">
                  {t.channel} · {t.language} ·{" "}
                  {TRIGGER_TYPES.find((x) => x.key === t.trigger_type)?.label ?? t.trigger_type}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <IconBtn title="Edit" onClick={() => setEditing(t)}>
                  <Pencil className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn title="Duplicate" onClick={() => dup.mutate(t.id)}>
                  <Copy className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn
                  title={t.active ? "Disable" : "Enable"}
                  onClick={() => tog.mutate({ id: t.id, active: !t.active })}
                >
                  <Power className="h-3.5 w-3.5" />
                </IconBtn>
              </div>
            </header>
            <p className="text-sm text-slate whitespace-pre-wrap line-clamp-4">{t.body}</p>
          </article>
        ))}
      </div>

      {editing && (
        <TemplateEditor
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(v: any) => save.mutate(v)}
          saving={save.isPending}
        />
      )}
    </div>
  );
}

function TemplateEditor({ initial, onClose, onSave, saving }: any) {
  const [f, setF] = useState({
    id: initial?.id,
    key: initial?.key ?? `tpl_${Date.now().toString(36)}`,
    label: initial?.label ?? "",
    channel: initial?.channel ?? "whatsapp",
    trigger_type: initial?.trigger_type ?? "manual",
    language: initial?.language ?? "en",
    subject: initial?.subject ?? "",
    body: initial?.body ?? "",
    description: initial?.description ?? "",
    active: initial?.active ?? true,
  });
  const previewSubject = f.subject ? renderTemplate(f.subject, PREVIEW_VARS) : "";
  const previewBody = f.body ? renderTemplate(f.body, PREVIEW_VARS) : "";
  return (
    <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-4xl space-y-4 overflow-y-auto rounded-2xl border border-gold/30 bg-ivory p-6 max-h-[90vh]">
        <div className="flex justify-between items-center">
          <h3 className="font-display text-2xl text-navy">
            {initial ? "Edit template" : "New template"}
          </h3>
          <button onClick={onClose} className="btn-ghost p-1.5 hover:btn-ghost-hover">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid sm:grid-cols-[minmax(0,1fr)_320px] gap-6">
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <L label="Label">
                <input
                  className="editorial-input"
                  value={f.label}
                  onChange={(e) => setF({ ...f, label: e.target.value })}
                />
              </L>
              <L label="Key">
                <input
                  className="editorial-input"
                  value={f.key}
                  onChange={(e) => setF({ ...f, key: e.target.value })}
                />
              </L>
              <L label="Channel">
                <select
                  className="editorial-input"
                  value={f.channel}
                  onChange={(e) => setF({ ...f, channel: e.target.value })}
                >
                  {CHANNELS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </L>
              <L label="Language">
                <select
                  className="editorial-input"
                  value={f.language}
                  onChange={(e) => setF({ ...f, language: e.target.value })}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </L>
              <L label="Trigger">
                <select
                  className="editorial-input"
                  value={f.trigger_type}
                  onChange={(e) => setF({ ...f, trigger_type: e.target.value })}
                >
                  {TRIGGER_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </L>
              {f.channel === "email" && (
                <L label="Subject">
                  <input
                    className="editorial-input"
                    value={f.subject ?? ""}
                    onChange={(e) => setF({ ...f, subject: e.target.value })}
                  />
                </L>
              )}
            </div>
            <L label="Body">
              <textarea
                rows={6}
                className="editorial-input"
                value={f.body}
                onChange={(e) => setF({ ...f, body: e.target.value })}
              />
            </L>
            <p className="text-xs text-slate">
              Use variables like {`{{member_name}}`}, {`{{class_name}}`}, {`{{class_date}}`},{" "}
              {`{{studio_name}}`}…
            </p>
            <label className="flex items-center gap-2 text-sm text-navy">
              <input
                type="checkbox"
                checked={f.active}
                onChange={(e) => setF({ ...f, active: e.target.checked })}
                className="accent-gold"
              />{" "}
              Active
            </label>
          </div>
          <div className="self-start space-y-3 rounded-2xl border border-gold/20 bg-sand/20 p-4">
            <p className="eyebrow">Preview</p>
            {previewSubject && (
              <p className="text-xs text-slate">
                <span className="font-medium">Subject</span>
                {" · "}
                {previewSubject}
              </p>
            )}
            <pre className="min-h-[120px] rounded-xl border border-gold/15 bg-sand/40 p-3 font-sans text-sm leading-relaxed text-navy whitespace-pre-wrap">
              {previewBody || (
                <span className="text-slate italic">Start typing the body to see a preview...</span>
              )}
            </pre>
            {f.channel === "whatsapp" && previewBody && (
              <a
                href={waUrl({ to: "+972500000000", text: previewBody })}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost inline-flex items-center gap-1.5 text-xs hover:btn-ghost-hover"
              >
                <MessageCircle className="h-3 w-3" /> Preview in WhatsApp →
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="btn-ghost hover:btn-ghost-hover">
            Cancel
          </button>
          <button
            disabled={saving || !f.label || !f.body}
            onClick={() =>
              onSave({
                ...f,
                subject: f.subject || null,
                description: f.description || null,
              })
            }
            className="btn-navy hover:btn-navy-hover disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save template"}
          </button>
        </div>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
function IconBtn({ children, ...rest }: any) {
  return (
    <button
      {...rest}
      className="btn-ghost inline-flex h-8 w-8 items-center justify-center p-0 hover:btn-ghost-hover"
    >
      {children}
    </button>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="editorial-panel p-10 text-center font-display text-slate">{children}</div>;
}

/* ---------------- Logs ---------------- */

function LogsTab() {
  const { t } = useI18n();
  const fn = useServerFn(listNotificationLogs);
  const markFn = useServerFn(markNotificationSent);
  const qc = useQueryClient();
  const [logFilter, setLogFilter] = useState({
    channel: "all",
    status: "all",
    triggerType: "all",
    visibility: "all",
  });
  const { data, isLoading } = useQuery({
    queryKey: ["notification-logs", logFilter],
    queryFn: () => fn({ data: { limit: 100, ...logFilter } }),
  });
  const mark = useMutation({
    mutationFn: (id: string) => markFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Marked manually sent");
      qc.invalidateQueries({ queryKey: ["notification-logs"] });
    },
  });
  if (isLoading) return <div className="skeleton-brand h-24 rounded-[8px]" />;
  const logs = data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {["all", "whatsapp", "email"].map((c) => (
          <button
            key={c}
            onClick={() => setLogFilter((f) => ({ ...f, channel: c }))}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              logFilter.channel === c
                ? "bg-navy text-ivory border-navy"
                : "border-gold/30 text-slate hover:text-navy/85"
            }`}
          >
            {c}
          </button>
        ))}
        <span className="border-s border-gold/20 mx-1" />
        {["all", "draft", "queued", "skipped", "cancelled", "failed", "manually_sent", "sent"].map(
          (s) => (
            <button
              key={s}
              onClick={() => setLogFilter((f) => ({ ...f, status: s }))}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                logFilter.status === s
                  ? "bg-navy text-ivory border-navy"
                  : "border-gold/30 text-slate hover:text-navy/85"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          ),
        )}
        <span className="border-s border-gold/20 mx-1" />
        {["all", "operational", "admin_only"].map((v) => (
          <button
            key={v}
            onClick={() => setLogFilter((f) => ({ ...f, visibility: v }))}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              logFilter.visibility === v
                ? "bg-navy text-ivory border-navy"
                : "border-gold/30 text-slate hover:text-navy/85"
            }`}
          >
            {v.replace("_", " ")}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {["all", ...TRIGGER_TYPES.map((trigger) => trigger.key)].map((triggerType) => (
          <button
            key={triggerType}
            onClick={() => setLogFilter((f) => ({ ...f, triggerType }))}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              logFilter.triggerType === triggerType
                ? "bg-navy text-ivory border-navy"
                : "border-gold/30 text-slate hover:text-navy/85"
            }`}
          >
            {triggerType === "all"
              ? "all"
              : (TRIGGER_TYPES.find((trigger) => trigger.key === triggerType)?.label ??
                triggerType)}
          </button>
        ))}
      </div>
      <div className="flex gap-6 pb-4 border-b border-gold/20">
        {[
          { label: "Total", value: logs.length },
          {
            label: "Sent",
            value: logs.filter((l: any) => l.status === "manually_sent" || l.status === "sent")
              .length,
          },
          { label: "WhatsApp", value: logs.filter((l: any) => l.channel === "whatsapp").length },
          { label: "Email", value: logs.filter((l: any) => l.channel === "email").length },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-[20px] font-display text-navy">{value}</p>
            <p className="text-xs font-medium text-slate">{label}</p>
          </div>
        ))}
      </div>
      {!logs.length && <Empty>{t("messages.noMessages")}</Empty>}
      <ol className="relative border-s border-gold/30 ps-5 space-y-4">
        {logs.map((l: any) => (
          <li key={l.id} className="relative">
            <span className="absolute -start-[26px] top-2 h-2.5 w-2.5 rounded-full bg-gold" />
            <article className="editorial-panel p-4">
              <header className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display text-base text-navy">{l.member?.name ?? "—"}</p>
                  <p className="mt-0.5 text-xs font-medium text-slate">
                    {new Date(l.created_at).toLocaleString()} · {l.channel} ·{" "}
                    {l.trigger_type ?? l.template_key ?? "manual"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${getLogStatusClass(l)}`}
                >
                  {getLogStatusLabel(l)}
                </span>
              </header>
              <div className="mt-2 space-y-1 text-xs text-slate">
                {l.subject ? <p>Subject: {l.subject}</p> : null}
                {l.language ? <p>Language: {l.language}</p> : null}
                {l.staff_visibility ? <p>Visibility: {l.staff_visibility}</p> : null}
                {l.idempotency_key ? <p>Idempotency: {l.idempotency_key}</p> : null}
                {l.provider_message_id ? <p>OpenWA accepted id: {l.provider_message_id}</p> : null}
                {l.error_message ? <p>Error: {l.error_message}</p> : null}
              </div>
              {l.generated_text && (
                <pre className="text-xs text-slate whitespace-pre-wrap font-sans mt-2 line-clamp-4">
                  {l.generated_text}
                </pre>
              )}
              {l.status !== "manually_sent" &&
                l.status !== "sent" &&
                l.status !== "skipped" &&
                l.status !== "cancelled" && (
                  <button
                    onClick={() => mark.mutate(l.id)}
                    className="btn-ghost mt-2 text-xs hover:btn-ghost-hover"
                  >
                    Mark manually sent
                  </button>
                )}
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------------- Package Requests ---------------- */

function RequestsTab() {
  const { t } = useI18n();
  const listFn = useServerFn(listPackageRequests);
  const upFn = useServerFn(updatePackageRequest);
  const settingsFn = useServerFn(getPublicStudioSettings);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["package-requests"], queryFn: () => listFn() });
  const { data: settings } = useQuery({
    queryKey: ["public-studio-settings"],
    queryFn: () => settingsFn(),
  });
  const update = useMutation({
    mutationFn: (v: { id: string; status: any; admin_notes?: string | null }) =>
      upFn({ data: { id: v.id, status: v.status, admin_notes: v.admin_notes } }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["package-requests"] });
    },
  });

  if (isLoading) return <div className="skeleton-brand h-24 rounded-[8px]" />;
  if (!data?.length) return <Empty>{t("messages.noRequests")}</Empty>;

  return (
    <div className="space-y-3">
      {data.map((r: any) => (
        <RequestCard key={r.id} r={r} settings={settings} update={update} />
      ))}
    </div>
  );
}

function RequestCard({ r, settings, update }: { r: any; settings: any; update: any }) {
  const [notes, setNotes] = useState(r.admin_notes ?? "");
  const wa = waUrl({
    to: r.member?.phone,
    text: `Hi ${r.member?.name?.split(" ")[0] ?? ""}, this is ${settings?.studio_name ?? "the studio"} about your ${r.plan?.name ?? "package"} request.`,
  });

  useEffect(() => {
    setNotes(r.admin_notes ?? "");
  }, [r.admin_notes]);

  function saveNotes() {
    if (notes !== (r.admin_notes ?? "")) {
      update.mutate({ id: r.id, status: r.status, admin_notes: notes || null });
    }
  }

  return (
    <article className="editorial-panel p-5 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg text-navy">
          {r.member?.name ?? "—"}{" "}
          <span className="text-slate text-sm">· {r.plan?.name ?? "Package"}</span>
        </p>
        <p className="mt-0.5 text-xs font-medium text-slate">
          {new Date(r.created_at).toLocaleString()} · {r.member?.phone ?? "no phone"}
        </p>
        {r.message_text && <p className="text-sm text-navy mt-2 italic">"{r.message_text}"</p>}
        <textarea
          className="editorial-input text-sm mt-3 resize-none min-h-[52px]"
          placeholder="Admin notes (auto-saves)..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            r.status === "paid"
              ? "bg-navy text-ivory"
              : r.status === "contacted"
                ? "bg-powder text-navy"
                : r.status === "cancelled"
                  ? "bg-sand text-slate"
                  : "bg-gold/20 text-navy"
          }`}
        >
          {r.status}
        </span>
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          className="btn-outline inline-flex items-center gap-1.5 px-3 py-2 text-xs hover:btn-outline-hover"
        >
          <MessageCircle className="h-3 w-3" /> WhatsApp
        </a>
        {r.status === "requested" && (
          <button
            onClick={() => update.mutate({ id: r.id, status: "contacted" })}
            className="btn-ghost text-xs hover:btn-ghost-hover"
          >
            Contacted
          </button>
        )}
        {r.status === "contacted" && (
          <button
            onClick={() => update.mutate({ id: r.id, status: "paid" })}
            className="btn-navy text-xs hover:btn-navy-hover"
          >
            Paid
          </button>
        )}
        {r.status !== "cancelled" && r.status !== "paid" && (
          <button
            onClick={() => update.mutate({ id: r.id, status: "cancelled" })}
            className="btn-ghost text-xs text-destructive/80 hover:text-destructive"
          >
            Cancel
          </button>
        )}
      </div>
    </article>
  );
}
