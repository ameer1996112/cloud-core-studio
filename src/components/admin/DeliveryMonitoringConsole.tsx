import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  Eye,
  Mail,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  listCanonicalDeliveries,
  retryCanonicalDeliveryAction,
} from "@/lib/unifiedMessages.functions";
import {
  filterDeliveryRows,
  isDeliveryAttention,
  isDeliveryRetryCandidate,
  type DeliveryMonitorFilters,
  type DeliveryMonitorRow,
  type DeliveryTrafficKind,
} from "@/lib/deliveryMonitoring";
import type { DeliveryStatus, MessageChannel } from "@/lib/messaging.types";
import { useI18n, type Lang } from "@/lib/i18n";

const DELIVERY_COPY: Record<Lang, Record<string, string>> = {
  en: {
    eyebrow: "Live operations",
    title: "Delivery observatory",
    description: "See exactly what each member was sent, across every channel, in one place.",
    trafficScope: "Activity source",
    trafficLive: "Live customers",
    trafficTest: "Staff tests",
    trafficSystem: "System alerts",
    trafficAll: "All activity",
    live: "Live · refreshes every 30 seconds",
    updated: "Updated",
    refresh: "Refresh now",
    deliveries24h: "Deliveries · 24h",
    handoffs: "Successful outcomes",
    confirmed: "confirmed delivered or read",
    attention: "Needs attention",
    noIncidents: "No active incidents",
    reached: "Members reached",
    inFlight: "in progress",
    policySkipped: "held by policy",
    search: "Search member, phone, email or event",
    allChannels: "All channels",
    allStatuses: "All outcomes",
    successful: "Successful handoff",
    notSent: "Not sent by policy",
    memberFocus: "Showing one member",
    clear: "Clear",
    results: "results",
    member: "Member",
    message: "Message",
    channel: "Channel",
    status: "Outcome",
    activity: "Last activity",
    attempts: "Attempts",
    investigate: "Investigate",
    noResults: "No deliveries match these filters.",
    loadMore: "Load more",
    showing: "Showing",
    of: "of",
    unknownMember: "Unknown recipient",
    viewMemberHistory: "Show this member only",
    openProfile: "Open member profile",
    deliveryDetail: "Delivery investigation",
    deliveryDetailDescription: "Customer, channel, provider attempts and final outcome.",
    overview: "Delivery overview",
    provider: "Provider",
    scheduled: "Scheduled",
    nextAttempt: "Next attempt",
    event: "Event",
    template: "Template",
    issue: "What needs attention",
    technicalCode: "Technical code",
    timeline: "Delivery timeline",
    created: "Delivery created",
    attempt: "Provider attempt",
    retryScheduled: "Retry scheduled",
    deviceResults: "Push devices",
    queueRetry: "Queue retry",
    retryQueued: "Delivery queued for retry",
    retryNotAvailable: "Automatic retry is not available for this outcome.",
    doNotRetry: "Do not retry—check the provider before taking action.",
    noAttempts: "No provider attempt was made.",
    error_event_channel_not_enabled: "Not sent because this channel is disabled for this event.",
    error_recipient_not_allowlisted: "Held by the controlled rollout allowlist.",
    error_whatsapp_template_locale_unapproved:
      "The WhatsApp template is not approved for this member’s language.",
    failure_transient:
      "A temporary provider problem interrupted this delivery. It can be retried safely.",
    failure_permanent:
      "The provider rejected this delivery permanently. Check the member’s contact details before taking action.",
    failure_configuration:
      "A channel or provider setting is incomplete. Fix the configuration before trying again.",
    failure_ambiguous:
      "The provider outcome is unknown. Staff reconciliation is required to avoid a duplicate message.",
    error_default: "The provider could not complete this delivery.",
    status_queued: "Queued",
    status_sending: "Sending",
    status_accepted: "Accepted by provider",
    status_sent: "Sent · unconfirmed",
    status_delivered: "Delivered",
    status_read: "Read",
    status_failed: "Failed",
    status_dead_letter: "Action required",
    status_suppressed: "Not sent by policy",
    status_expired: "Expired",
    status_cancelled: "Cancelled",
    status_delivery_unknown: "Outcome unknown",
    channel_in_app: "In-app",
    channel_push: "Push",
    channel_email: "Email",
    channel_whatsapp: "WhatsApp",
  },
  he: {
    eyebrow: "תפעול בזמן אמת",
    title: "בקרת מסירות",
    description: "תמונה ברורה של כל הודעה שנשלחה לכל מתאמן או מתאמנת, בכל הערוצים.",
    trafficScope: "מקור הפעילות",
    trafficLive: "לקוחות אמיתיים",
    trafficTest: "בדיקות צוות",
    trafficSystem: "התראות מערכת",
    trafficAll: "כל הפעילות",
    live: "חי · מתעדכן כל 30 שניות",
    updated: "עודכן",
    refresh: "רענון עכשיו",
    deliveries24h: "מסירות · 24 שעות",
    handoffs: "תוצאות תקינות",
    confirmed: "אושרו כמסירה או קריאה",
    attention: "דורשות טיפול",
    noIncidents: "אין תקלות פעילות",
    reached: "לקוחות שקיבלו",
    inFlight: "בתהליך",
    policySkipped: "נעצרו לפי מדיניות",
    search: "חיפוש לפי שם, טלפון, אימייל או אירוע",
    allChannels: "כל הערוצים",
    allStatuses: "כל התוצאות",
    successful: "נמסר בהצלחה לספק",
    notSent: "לא נשלח לפי מדיניות",
    memberFocus: "מוצגת היסטוריה של לקוח אחד",
    clear: "ניקוי",
    results: "תוצאות",
    member: "לקוח/ה",
    message: "הודעה",
    channel: "ערוץ",
    status: "תוצאה",
    activity: "פעילות אחרונה",
    attempts: "ניסיונות",
    investigate: "בדיקה",
    noResults: "לא נמצאו מסירות שמתאימות למסננים.",
    loadMore: "הצגת עוד",
    showing: "מוצגות",
    of: "מתוך",
    unknownMember: "נמען לא מזוהה",
    viewMemberHistory: "הצגת הלקוח/ה בלבד",
    openProfile: "פתיחת כרטיס הלקוח/ה",
    deliveryDetail: "בדיקת מסירה",
    deliveryDetailDescription: "לקוח, ערוץ, ניסיונות ספק ותוצאה סופית.",
    overview: "סיכום המסירה",
    provider: "ספק",
    scheduled: "מועד מתוכנן",
    nextAttempt: "ניסיון הבא",
    event: "אירוע",
    template: "תבנית",
    issue: "מה דורש טיפול",
    technicalCode: "קוד טכני",
    timeline: "ציר זמן",
    created: "המסירה נוצרה",
    attempt: "ניסיון מול הספק",
    retryScheduled: "נקבע ניסיון חוזר",
    deviceResults: "מכשירי Push",
    queueRetry: "הוספה לניסיון חוזר",
    retryQueued: "המסירה נוספה לניסיון חוזר",
    retryNotAvailable: "לא ניתן לבצע ניסיון חוזר אוטומטי לתוצאה הזאת.",
    doNotRetry: "אין לנסות שוב — יש לבדוק מול הספק לפני פעולה.",
    noAttempts: "לא בוצע ניסיון מול ספק.",
    error_event_channel_not_enabled: "ההודעה לא נשלחה כי הערוץ כבוי עבור האירוע הזה.",
    error_recipient_not_allowlisted: "ההודעה נעצרה במסגרת ההשקה המבוקרת.",
    error_whatsapp_template_locale_unapproved: "תבנית WhatsApp עדיין לא אושרה בשפה של הלקוח/ה.",
    failure_transient: "תקלה זמנית אצל הספק עצרה את המסירה. ניתן לנסות שוב בבטחה.",
    failure_permanent: "הספק דחה את המסירה באופן קבוע. יש לבדוק את פרטי הקשר לפני פעולה נוספת.",
    failure_configuration: "הגדרת הערוץ או הספק אינה מלאה. יש לתקן את ההגדרה לפני ניסיון נוסף.",
    failure_ambiguous: "תוצאת המסירה אצל הספק אינה ידועה. נדרשת בדיקת צוות כדי למנוע הודעה כפולה.",
    error_default: "הספק לא הצליח להשלים את המסירה.",
    status_queued: "ממתינה",
    status_sending: "נשלחת",
    status_accepted: "התקבלה אצל הספק",
    status_sent: "נשלחה · ללא אישור מסירה",
    status_delivered: "נמסרה",
    status_read: "נקראה",
    status_failed: "השליחה נכשלה",
    status_dead_letter: "דורשת טיפול",
    status_suppressed: "לא נשלחה לפי מדיניות",
    status_expired: "פג תוקף",
    status_cancelled: "בוטלה",
    status_delivery_unknown: "מצב המסירה לא ידוע",
    channel_in_app: "באפליקציה",
    channel_push: "התראת Push",
    channel_email: "אימייל",
    channel_whatsapp: "WhatsApp",
  },
  ar: {
    eyebrow: "تشغيل مباشر",
    title: "مراقبة التسليم",
    description: "صورة واضحة لكل رسالة أُرسلت لكل عضو عبر جميع القنوات.",
    trafficScope: "مصدر النشاط",
    trafficLive: "عملاء فعليون",
    trafficTest: "اختبارات الطاقم",
    trafficSystem: "تنبيهات النظام",
    trafficAll: "كل النشاط",
    live: "مباشر · يتحدّث كل 30 ثانية",
    updated: "آخر تحديث",
    refresh: "تحديث الآن",
    deliveries24h: "عمليات التسليم · 24 ساعة",
    handoffs: "نتائج ناجحة",
    confirmed: "تم تأكيد تسليمها أو قراءتها",
    attention: "تحتاج متابعة",
    noIncidents: "لا توجد مشاكل نشطة",
    reached: "أعضاء تم الوصول إليهم",
    inFlight: "قيد التنفيذ",
    policySkipped: "أوقفتها السياسة",
    search: "ابحث بالاسم أو الهاتف أو البريد أو الحدث",
    allChannels: "كل القنوات",
    allStatuses: "كل النتائج",
    successful: "تسليم ناجح للمزوّد",
    notSent: "لم تُرسل حسب السياسة",
    memberFocus: "عرض عضو واحد",
    clear: "مسح",
    results: "نتائج",
    member: "العضو",
    message: "الرسالة",
    channel: "القناة",
    status: "النتيجة",
    activity: "آخر نشاط",
    attempts: "المحاولات",
    investigate: "فحص",
    noResults: "لا توجد عمليات تسليم تطابق عوامل التصفية.",
    loadMore: "عرض المزيد",
    showing: "يتم عرض",
    of: "من",
    unknownMember: "مستلم غير معروف",
    viewMemberHistory: "عرض هذا العضو فقط",
    openProfile: "فتح ملف العضو",
    deliveryDetail: "فحص التسليم",
    deliveryDetailDescription: "العضو والقناة ومحاولات المزوّد والنتيجة النهائية.",
    overview: "ملخص التسليم",
    provider: "المزوّد",
    scheduled: "موعد الإرسال",
    nextAttempt: "المحاولة القادمة",
    event: "الحدث",
    template: "القالب",
    issue: "ما الذي يحتاج متابعة",
    technicalCode: "الرمز التقني",
    timeline: "الخط الزمني",
    created: "تم إنشاء التسليم",
    attempt: "محاولة المزوّد",
    retryScheduled: "تمت جدولة إعادة المحاولة",
    deviceResults: "أجهزة Push",
    queueRetry: "إضافة لإعادة المحاولة",
    retryQueued: "تمت إضافة التسليم لإعادة المحاولة",
    retryNotAvailable: "إعادة المحاولة التلقائية غير متاحة لهذه النتيجة.",
    doNotRetry: "لا تُعِد المحاولة — افحص المزوّد أولاً.",
    noAttempts: "لم تتم محاولة الإرسال إلى المزوّد.",
    error_event_channel_not_enabled: "لم تُرسل الرسالة لأن القناة غير مفعّلة لهذا الحدث.",
    error_recipient_not_allowlisted: "تم إيقاف الرسالة ضمن الإطلاق التدريجي.",
    error_whatsapp_template_locale_unapproved: "قالب WhatsApp غير معتمد بلغة العضو.",
    failure_transient: "أوقفت مشكلة مؤقتة لدى المزوّد عملية التسليم. يمكن إعادة المحاولة بأمان.",
    failure_permanent: "رفض المزوّد التسليم نهائيًا. افحص بيانات تواصل العضو قبل اتخاذ إجراء.",
    failure_configuration: "إعداد القناة أو المزوّد غير مكتمل. أصلح الإعداد قبل إعادة المحاولة.",
    failure_ambiguous: "نتيجة المزوّد غير معروفة. يجب أن يراجعها الطاقم لتجنب إرسال رسالة مكررة.",
    error_default: "تعذّر على المزوّد إكمال التسليم.",
    status_queued: "في الانتظار",
    status_sending: "قيد الإرسال",
    status_accepted: "قبلها المزوّد",
    status_sent: "أُرسلت · غير مؤكدة",
    status_delivered: "تم التسليم",
    status_read: "تمت القراءة",
    status_failed: "فشل الإرسال",
    status_dead_letter: "تحتاج معالجة",
    status_suppressed: "لم تُرسل حسب السياسة",
    status_expired: "انتهت الصلاحية",
    status_cancelled: "أُلغيت",
    status_delivery_unknown: "نتيجة التسليم غير معروفة",
    channel_in_app: "داخل التطبيق",
    channel_push: "Push",
    channel_email: "البريد الإلكتروني",
    channel_whatsapp: "WhatsApp",
  },
};

const STATUS_OPTIONS: Array<DeliveryStatus | "all" | "attention" | "successful" | "not_sent"> = [
  "all",
  "attention",
  "successful",
  "queued",
  "sending",
  "accepted",
  "sent",
  "delivered",
  "read",
  "failed",
  "dead_letter",
  "delivery_unknown",
  "not_sent",
];

const CHANNEL_OPTIONS: Array<"all" | MessageChannel> = [
  "all",
  "in_app",
  "push",
  "whatsapp",
  "email",
];

const TRAFFIC_OPTIONS: Array<DeliveryTrafficKind | "all"> = ["live", "test", "system", "all"];

function statusLabel(copy: Record<string, string>, status: DeliveryStatus) {
  return copy[`status_${status}`] ?? status.replaceAll("_", " ");
}

function channelLabel(copy: Record<string, string>, channel: MessageChannel) {
  return copy[`channel_${channel}`] ?? channel;
}

function eventLabel(eventType: string | null) {
  return eventType ? eventType.replaceAll("_", " ") : "—";
}

function formatDateTime(value: string | null, lang: Lang) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(lang === "he" ? "he-IL" : lang === "ar" ? "ar" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(value));
}

function initials(name: string | null | undefined) {
  return (name ?? "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase();
}

function maskContact(value: string | null | undefined) {
  if (!value) return null;
  if (value.includes("@")) {
    const [local, domain] = value.split("@");
    return `${local?.slice(0, 1) ?? "•"}•••@${domain}`;
  }
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `••• ${digits.slice(-4)}` : value;
}

function errorExplanation(
  copy: Record<string, string>,
  errorCode: string | null,
  failureClass: DeliveryMonitorRow["failure_class"],
) {
  if (errorCode && copy[`error_${errorCode}`]) return copy[`error_${errorCode}`];
  if (failureClass && copy[`failure_${failureClass}`]) return copy[`failure_${failureClass}`];
  return copy.error_default;
}

function ChannelIcon({
  channel,
  className = "h-4 w-4",
}: {
  channel: MessageChannel;
  className?: string;
}) {
  if (channel === "push") return <Bell className={className} aria-hidden="true" />;
  if (channel === "email") return <Mail className={className} aria-hidden="true" />;
  if (channel === "whatsapp") return <MessageCircle className={className} aria-hidden="true" />;
  return <Smartphone className={className} aria-hidden="true" />;
}

function StatusIcon({
  status,
  className = "h-4 w-4",
}: {
  status: DeliveryStatus;
  className?: string;
}) {
  if (["delivered", "read"].includes(status))
    return <CheckCircle2 className={className} aria-hidden="true" />;
  if (["accepted", "sent"].includes(status))
    return <Send className={className} aria-hidden="true" />;
  if (["failed", "dead_letter", "delivery_unknown"].includes(status)) {
    return <AlertTriangle className={className} aria-hidden="true" />;
  }
  if (["queued", "sending"].includes(status))
    return <Clock3 className={className} aria-hidden="true" />;
  return <ShieldCheck className={className} aria-hidden="true" />;
}

function statusTone(status: DeliveryStatus) {
  if (["delivered", "read"].includes(status))
    return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (["accepted", "sent"].includes(status)) return "bg-sky-50 text-sky-800 ring-sky-200";
  if (["failed", "dead_letter", "delivery_unknown"].includes(status)) {
    return "bg-rose-50 text-rose-800 ring-rose-200";
  }
  if (["queued", "sending"].includes(status)) return "bg-amber-50 text-amber-900 ring-amber-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function StatusPill({
  delivery,
  copy,
}: {
  delivery: DeliveryMonitorRow;
  copy: Record<string, string>;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusTone(delivery.status)}`}
    >
      <StatusIcon status={delivery.status} />
      <span className="truncate">{statusLabel(copy, delivery.status)}</span>
    </span>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  detail,
  attention = false,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  detail: string;
  attention?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 shadow-[0_12px_36px_rgba(17,35,64,0.05)] sm:p-4 ${
        attention && value > 0 ? "border-rose-200 bg-rose-50/70" : "border-gold/20 bg-white/75"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">{label}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-navy">{value}</p>
        </div>
        <span
          className={`grid h-10 w-10 place-items-center rounded-xl ${
            attention && value > 0 ? "bg-rose-100 text-rose-700" : "bg-sand text-navy"
          }`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 text-xs text-slate">{detail}</p>
    </div>
  );
}

type TimelineItem = {
  id: string;
  at: string;
  title: string;
  detail: string | null;
  tone: "neutral" | "success" | "danger";
};

function buildTimeline(delivery: DeliveryMonitorRow, copy: Record<string, string>): TimelineItem[] {
  const items: TimelineItem[] = [
    { id: "created", at: delivery.created_at, title: copy.created, detail: null, tone: "neutral" },
  ];
  for (const attempt of delivery.attempts) {
    items.push({
      id: `attempt-${attempt.id}`,
      at: attempt.finished_at ?? attempt.started_at,
      title: `${copy.attempt} ${attempt.attempt_number}`,
      detail:
        [attempt.outcome, attempt.provider_http_status, attempt.provider_error_code]
          .filter(Boolean)
          .join(" · ") || null,
      tone: attempt.failure_class ? "danger" : "neutral",
    });
    if (attempt.next_attempt_at) {
      items.push({
        id: `retry-${attempt.id}`,
        at: attempt.next_attempt_at,
        title: copy.retryScheduled,
        detail: null,
        tone: "neutral",
      });
    }
  }
  const milestones: Array<[string, string | null, DeliveryStatus]> = [
    ["accepted", delivery.accepted_at, "accepted"],
    ["sent", delivery.sent_at, "sent"],
    ["delivered", delivery.delivered_at, "delivered"],
    ["read", delivery.read_at, "read"],
    ["failed", delivery.failed_at, delivery.status === "dead_letter" ? "dead_letter" : "failed"],
  ];
  for (const [id, at, status] of milestones) {
    if (!at) continue;
    items.push({
      id,
      at,
      title: statusLabel(copy, status),
      detail: null,
      tone: isDeliveryAttention(status) ? "danger" : "success",
    });
  }
  return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export function DeliveryMonitoringConsole() {
  const { lang } = useI18n();
  const copy = DELIVERY_COPY[lang] ?? DELIVERY_COPY.en;
  const queryClient = useQueryClient();
  const listFn = useServerFn(listCanonicalDeliveries);
  const retryFn = useServerFn(retryCanonicalDeliveryAction);
  const [traffic, setTraffic] = useState<DeliveryMonitorFilters["traffic"]>("live");
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<DeliveryMonitorFilters["channel"]>("all");
  const [status, setStatus] = useState<DeliveryMonitorFilters["status"]>("all");
  const [memberId, setMemberId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);

  const deliveries = useQuery({
    queryKey: ["canonical-deliveries"],
    queryFn: () => listFn(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const retry = useMutation({
    mutationFn: (deliveryId: string) => retryFn({ data: { deliveryId } }),
    onSuccess: async () => {
      toast.success(copy.retryQueued);
      await queryClient.invalidateQueries({ queryKey: ["canonical-deliveries"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Retry failed"),
  });

  const allDeliveries = useMemo(
    () => deliveries.data?.deliveries ?? [],
    [deliveries.data?.deliveries],
  );
  const filtered = useMemo(() => {
    const values = filterDeliveryRows(allDeliveries, {
      query,
      traffic,
      channel,
      status,
      memberId,
    });
    return [...values].sort((a, b) => {
      const priority =
        Number(isDeliveryAttention(b.status)) - Number(isDeliveryAttention(a.status));
      return priority || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [allDeliveries, query, traffic, channel, status, memberId]);
  const visible = filtered.slice(0, visibleCount);
  const selected = allDeliveries.find((delivery) => delivery.id === selectedId) ?? null;
  const focusedMember = memberId
    ? allDeliveries.find((delivery) => delivery.message?.member?.id === memberId)?.message?.member
    : null;

  useEffect(() => setVisibleCount(50), [query, traffic, channel, status, memberId]);

  const clearFilters = () => {
    setQuery("");
    setTraffic("live");
    setChannel("all");
    setStatus("all");
    setMemberId(null);
  };
  const focusMember = (delivery: DeliveryMonitorRow) => {
    if (!delivery.message?.member?.id) return;
    setMemberId(delivery.message.member.id);
    setSelectedId(null);
  };
  const summary = deliveries.data?.summaries?.[traffic] ?? deliveries.data?.summary;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-gold/25 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(243,237,225,0.78))] p-5 shadow-[0_24px_80px_rgba(17,35,64,0.08)] sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h2 className="mt-1 font-display text-3xl text-navy sm:text-4xl">{copy.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate">{copy.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
              {copy.live}
            </span>
            <button
              type="button"
              onClick={() => deliveries.refetch()}
              disabled={deliveries.isFetching}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-gold/30 bg-white px-3 text-xs font-semibold text-navy transition hover:border-gold/60 hover:bg-sand/40 disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${deliveries.isFetching ? "motion-safe:animate-spin" : ""}`}
              />
              {copy.refresh}
            </button>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate">
            {copy.trafficScope}
          </p>
          <div
            className="grid grid-cols-2 gap-1 rounded-2xl border border-gold/20 bg-white/65 p-1 sm:inline-grid sm:grid-cols-4"
            role="group"
            aria-label={copy.trafficScope}
          >
            {TRAFFIC_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTraffic(value)}
                aria-pressed={traffic === value}
                className={`min-h-11 rounded-xl px-4 text-xs font-semibold transition sm:min-w-28 ${
                  traffic === value
                    ? "bg-navy text-ivory shadow-sm"
                    : "text-slate hover:bg-sand/60 hover:text-navy"
                }`}
              >
                {value === "live"
                  ? copy.trafficLive
                  : value === "test"
                    ? copy.trafficTest
                    : value === "system"
                      ? copy.trafficSystem
                      : copy.trafficAll}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard
            icon={Activity}
            label={copy.deliveries24h}
            value={summary?.total ?? 0}
            detail={`${summary?.inFlight ?? 0} ${copy.inFlight}`}
          />
          <KpiCard
            icon={CheckCircle2}
            label={copy.handoffs}
            value={summary?.successfulHandoffs ?? 0}
            detail={`${summary?.providerConfirmed ?? 0} ${copy.confirmed}`}
          />
          <KpiCard
            icon={CircleAlert}
            label={copy.attention}
            value={summary?.needsAttention ?? 0}
            detail={summary?.needsAttention ? copy.investigate : copy.noIncidents}
            attention
          />
          <KpiCard
            icon={Users}
            label={copy.reached}
            value={summary?.membersReached ?? 0}
            detail={`${summary?.policySkipped ?? 0} ${copy.policySkipped}`}
          />
        </div>
      </section>

      <section className="rounded-[24px] border border-gold/20 bg-white/75 p-4 shadow-[0_16px_50px_rgba(17,35,64,0.05)]">
        <div className="grid gap-3 lg:grid-cols-[minmax(280px,1fr)_190px_210px_auto]">
          <label className="relative block">
            <span className="sr-only">{copy.search}</span>
            <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.search}
              className="min-h-12 w-full rounded-xl border border-gold/25 bg-ivory ps-11 pe-4 text-sm text-navy outline-none transition placeholder:text-slate/70 focus:border-gold focus:ring-2 focus:ring-gold/15"
            />
          </label>
          <label>
            <span className="sr-only">{copy.channel}</span>
            <select
              value={channel}
              onChange={(event) =>
                setChannel(event.target.value as DeliveryMonitorFilters["channel"])
              }
              className="min-h-12 w-full rounded-xl border border-gold/25 bg-ivory px-4 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/15"
            >
              {CHANNEL_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? copy.allChannels : channelLabel(copy, value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">{copy.status}</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as DeliveryMonitorFilters["status"])
              }
              className="min-h-12 w-full rounded-xl border border-gold/25 bg-ivory px-4 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/15"
            >
              {STATUS_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value === "all"
                    ? copy.allStatuses
                    : value === "attention"
                      ? copy.attention
                      : value === "successful"
                        ? copy.successful
                        : value === "not_sent"
                          ? copy.notSent
                          : statusLabel(copy, value)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gold/25 px-4 text-sm font-semibold text-navy transition hover:bg-sand/50"
          >
            <X className="h-4 w-4" />
            {copy.clear}
          </button>
        </div>

        <div className="mt-3 flex min-h-8 flex-wrap items-center justify-between gap-2 text-xs text-slate">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              {filtered.length} {copy.results}
            </span>
            {focusedMember && (
              <button
                type="button"
                onClick={() => setMemberId(null)}
                className="inline-flex items-center gap-2 rounded-full bg-navy px-3 py-1.5 font-semibold text-ivory"
              >
                {copy.memberFocus}: {focusedMember.name}
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <span aria-live="polite">
            {copy.updated} {formatDateTime(deliveries.data?.generatedAt ?? null, lang)}
          </span>
        </div>
      </section>

      {deliveries.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          {deliveries.error instanceof Error ? deliveries.error.message : copy.error_default}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-gold/35 bg-white/60 p-12 text-center">
          <Search className="mx-auto h-8 w-8 text-gold" />
          <p className="mt-3 text-sm text-slate">{copy.noResults}</p>
        </div>
      ) : (
        <>
          <section className="hidden overflow-hidden rounded-[24px] border border-gold/20 bg-white/80 shadow-[0_16px_50px_rgba(17,35,64,0.05)] md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-start text-sm">
                <thead className="border-b border-gold/20 bg-sand/35 text-xs uppercase tracking-[0.08em] text-slate">
                  <tr>
                    <th className="p-4 text-start">{copy.member}</th>
                    <th className="p-4 text-start">{copy.message}</th>
                    <th className="p-4 text-start">{copy.channel}</th>
                    <th className="p-4 text-start">{copy.status}</th>
                    <th className="p-4 text-start">{copy.activity}</th>
                    <th className="p-4 text-start">{copy.attempts}</th>
                    <th className="p-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold/15">
                  {visible.map((delivery) => {
                    const member = delivery.message?.member;
                    const contact = maskContact(member?.phone ?? member?.email);
                    return (
                      <tr
                        key={delivery.id}
                        className={`transition hover:bg-sand/25 ${
                          isDeliveryAttention(delivery.status) ? "bg-rose-50/30" : ""
                        }`}
                      >
                        <td className="p-4">
                          <button
                            type="button"
                            onClick={() => focusMember(delivery)}
                            disabled={!member?.id}
                            className="group flex min-h-11 items-center gap-3 text-start disabled:cursor-default"
                          >
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy text-xs font-semibold text-ivory">
                              {initials(member?.name)}
                            </span>
                            <span className="min-w-0">
                              <span className="block max-w-[190px] truncate font-semibold text-navy group-hover:text-gold">
                                {member?.name ?? copy.unknownMember}
                              </span>
                              {contact && (
                                <bdi className="block text-xs text-slate" dir="ltr">
                                  {contact}
                                </bdi>
                              )}
                            </span>
                          </button>
                        </td>
                        <td className="p-4">
                          <p className="max-w-[270px] truncate font-medium text-navy">
                            {delivery.message?.subject ??
                              eventLabel(delivery.message?.event_type ?? null)}
                          </p>
                          <p className="mt-1 text-xs text-slate">
                            {eventLabel(delivery.message?.event_type ?? null)}
                          </p>
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-2 text-slate">
                            <ChannelIcon channel={delivery.channel} />
                            {channelLabel(copy, delivery.channel)}
                          </span>
                        </td>
                        <td className="p-4">
                          <StatusPill delivery={delivery} copy={copy} />
                        </td>
                        <td className="p-4 text-xs text-slate">
                          <time dateTime={delivery.updated_at}>
                            {formatDateTime(delivery.updated_at, lang)}
                          </time>
                        </td>
                        <td className="p-4 text-center font-medium tabular-nums text-navy">
                          {delivery.attempt_count}
                        </td>
                        <td className="p-4 text-end">
                          <button
                            type="button"
                            onClick={() => setSelectedId(delivery.id)}
                            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gold/25 px-3 text-xs font-semibold text-navy transition hover:border-gold/60 hover:bg-sand/50"
                            aria-label={`${copy.investigate}: ${member?.name ?? copy.unknownMember}`}
                          >
                            {copy.investigate}
                            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3 md:hidden">
            {visible.map((delivery) => {
              const member = delivery.message?.member;
              return (
                <article
                  key={delivery.id}
                  className={`rounded-2xl border p-4 shadow-[0_10px_32px_rgba(17,35,64,0.05)] ${
                    isDeliveryAttention(delivery.status)
                      ? "border-rose-200 bg-rose-50/60"
                      : "border-gold/20 bg-white/80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => focusMember(delivery)}
                      className="flex items-center gap-3 text-start"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy text-xs font-semibold text-ivory">
                        {initials(member?.name)}
                      </span>
                      <span>
                        <span className="block font-semibold text-navy">
                          {member?.name ?? copy.unknownMember}
                        </span>
                        <span className="block text-xs text-slate">
                          {maskContact(member?.phone ?? member?.email)}
                        </span>
                      </span>
                    </button>
                    <StatusPill delivery={delivery} copy={copy} />
                  </div>
                  <div className="mt-4 border-t border-gold/15 pt-4">
                    <p className="font-medium text-navy">
                      {delivery.message?.subject ??
                        eventLabel(delivery.message?.event_type ?? null)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate">
                      <span className="inline-flex items-center gap-1.5">
                        <ChannelIcon channel={delivery.channel} />
                        {channelLabel(copy, delivery.channel)}
                      </span>
                      <time dateTime={delivery.updated_at}>
                        {formatDateTime(delivery.updated_at, lang)}
                      </time>
                      <span>
                        {delivery.attempt_count} {copy.attempts}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(delivery.id)}
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-ivory"
                  >
                    {copy.investigate}
                    <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                  </button>
                </article>
              );
            })}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-slate">
            <span>
              {copy.showing} {visible.length} {copy.of} {filtered.length}
            </span>
            {visible.length < filtered.length && (
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + 50)}
                className="min-h-11 rounded-xl border border-gold/30 bg-white px-4 font-semibold text-navy hover:bg-sand/40"
              >
                {copy.loadMore}
              </button>
            )}
          </div>
        </>
      )}

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent side="end" className="h-dvh w-full overflow-y-auto bg-ivory p-0 sm:max-w-2xl">
          {selected && (
            <DeliveryInvestigation
              delivery={selected}
              copy={copy}
              lang={lang}
              retryPending={retry.isPending}
              onRetry={() => retry.mutate(selected.id)}
              onFocusMember={() => focusMember(selected)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DeliveryInvestigation({
  delivery,
  copy,
  lang,
  retryPending,
  onRetry,
  onFocusMember,
}: {
  delivery: DeliveryMonitorRow;
  copy: Record<string, string>;
  lang: Lang;
  retryPending: boolean;
  onRetry: () => void;
  onFocusMember: () => void;
}) {
  const member = delivery.message?.member;
  const timeline = buildTimeline(delivery, copy);
  const retryable = isDeliveryRetryCandidate(delivery);
  const hasIssue = Boolean(
    delivery.error_code || delivery.error_message || isDeliveryAttention(delivery.status),
  );
  const successfulTargets = delivery.targets.filter((target) =>
    ["sent", "device_received"].includes(target.status),
  ).length;

  return (
    <div className="min-h-full">
      <SheetHeader className="border-b border-gold/20 bg-white/70 px-5 pb-5 pt-6 text-start sm:px-7">
        <p className="eyebrow">{copy.deliveryDetail}</p>
        <SheetTitle className="pe-12 font-display text-3xl text-navy">
          {member?.name ?? copy.unknownMember}
        </SheetTitle>
        <SheetDescription>{copy.deliveryDetailDescription}</SheetDescription>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <StatusPill delivery={delivery} copy={copy} />
          <span className="inline-flex items-center gap-2 rounded-full bg-sand px-3 py-1 text-xs text-navy">
            <ChannelIcon channel={delivery.channel} />
            {channelLabel(copy, delivery.channel)}
          </span>
        </div>
      </SheetHeader>

      <div className="space-y-5 p-5 sm:p-7">
        <section className="rounded-2xl border border-gold/20 bg-white/75 p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-navy text-sm font-semibold text-ivory">
              {initials(member?.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-navy">{member?.name ?? copy.unknownMember}</p>
              {member?.phone && (
                <bdi dir="ltr" className="mt-1 block text-xs text-slate">
                  {member.phone}
                </bdi>
              )}
              {member?.email && (
                <bdi dir="ltr" className="block truncate text-xs text-slate">
                  {member.email}
                </bdi>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {member?.id && (
                  <>
                    <button
                      type="button"
                      onClick={onFocusMember}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gold/30 px-3 text-xs font-semibold text-navy hover:bg-sand/40"
                    >
                      <Eye className="h-4 w-4" />
                      {copy.viewMemberHistory}
                    </button>
                    <a
                      href={`/admin/members/${member.id}`}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gold/30 px-3 text-xs font-semibold text-navy hover:bg-sand/40"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {copy.openProfile}
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-navy">{copy.overview}</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 rounded-2xl border border-gold/20 bg-white/75 p-4 text-sm">
            <div>
              <dt className="text-xs text-slate">{copy.provider}</dt>
              <dd className="mt-1 font-medium text-navy">
                <bdi dir="ltr">{delivery.provider ?? "—"}</bdi>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate">{copy.attempts}</dt>
              <dd className="mt-1 font-medium tabular-nums text-navy">{delivery.attempt_count}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate">{copy.scheduled}</dt>
              <dd className="mt-1 text-xs text-navy">
                <time dateTime={delivery.scheduled_for}>
                  {formatDateTime(delivery.scheduled_for, lang)}
                </time>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate">{copy.nextAttempt}</dt>
              <dd className="mt-1 text-xs text-navy">
                <time dateTime={delivery.next_attempt_at ?? undefined}>
                  {formatDateTime(delivery.next_attempt_at, lang)}
                </time>
              </dd>
            </div>
            {delivery.channel === "push" && (
              <div className="col-span-2">
                <dt className="text-xs text-slate">{copy.deviceResults}</dt>
                <dd className="mt-1 font-medium text-navy">
                  {successfulTargets}/{delivery.targets.length}
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className="rounded-2xl border border-gold/20 bg-white/75 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate">
            {copy.event}
          </p>
          <p className="mt-2 text-lg font-semibold text-navy">
            {delivery.message?.subject ?? eventLabel(delivery.message?.event_type ?? null)}
          </p>
          <p className="mt-1 text-xs text-slate">
            {eventLabel(delivery.message?.event_type ?? null)}
          </p>
          {delivery.message?.template_key && (
            <p className="mt-3 text-xs text-slate">
              {copy.template}:{" "}
              <bdi dir="ltr">
                {delivery.message.template_key} · {delivery.message.template_version ?? "—"}
              </bdi>
            </p>
          )}
        </section>

        {hasIssue && (
          <section
            className={`rounded-2xl border p-4 ${isDeliveryAttention(delivery.status) ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className={`mt-0.5 h-5 w-5 shrink-0 ${isDeliveryAttention(delivery.status) ? "text-rose-700" : "text-amber-700"}`}
              />
              <div className="min-w-0">
                <h3 className="font-semibold text-navy">{copy.issue}</h3>
                <p className="mt-1 text-sm leading-6 text-slate">
                  {errorExplanation(copy, delivery.error_code, delivery.failure_class)}
                </p>
                {delivery.status === "delivery_unknown" && (
                  <p className="mt-2 text-sm font-semibold text-rose-800">{copy.doNotRetry}</p>
                )}
                {delivery.error_code && (
                  <p className="mt-3 text-xs text-slate">
                    {copy.technicalCode}:{" "}
                    <bdi dir="ltr" className="font-mono">
                      {delivery.error_code}
                    </bdi>
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        <section>
          <h3 className="text-sm font-semibold text-navy">{copy.timeline}</h3>
          <ol className="relative mt-4 space-y-4 before:absolute before:bottom-2 before:start-[7px] before:top-2 before:w-px before:bg-gold/30">
            {timeline.map((item) => (
              <li key={item.id} className="relative ps-7">
                <span
                  className={`absolute start-0 top-1.5 h-[15px] w-[15px] rounded-full border-4 border-ivory ${item.tone === "success" ? "bg-emerald-500" : item.tone === "danger" ? "bg-rose-500" : "bg-gold"}`}
                />
                <p className="text-sm font-medium text-navy">{item.title}</p>
                {item.detail && (
                  <bdi dir="ltr" className="mt-0.5 block text-xs text-slate">
                    {item.detail}
                  </bdi>
                )}
                <time dateTime={item.at} className="mt-0.5 block text-xs text-slate">
                  {formatDateTime(item.at, lang)}
                </time>
              </li>
            ))}
          </ol>
          {delivery.attempts.length === 0 && (
            <p className="mt-3 text-xs text-slate">{copy.noAttempts}</p>
          )}
        </section>

        <section className="sticky bottom-0 -mx-5 border-t border-gold/20 bg-ivory/95 px-5 py-4 backdrop-blur sm:-mx-7 sm:px-7">
          {retryable ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={retryPending}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-navy px-5 text-sm font-semibold text-ivory transition hover:bg-navy/90 disabled:opacity-60"
            >
              <RotateCcw className={`h-4 w-4 ${retryPending ? "motion-safe:animate-spin" : ""}`} />
              {copy.queueRetry}
            </button>
          ) : (
            <div className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sand px-4 text-center text-xs font-medium text-slate">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              {delivery.status === "delivery_unknown" ? copy.doNotRetry : copy.retryNotAvailable}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
