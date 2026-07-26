import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Bot, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminSection } from "@/components/admin-shared";
import { ConciergeTemplateLibrary } from "@/components/admin/ConciergeTemplateLibrary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  approveConciergeTemplates,
  getConciergeCenter,
  setConciergeAutomationMode,
  setConciergeChannelEnabled,
  simulateConciergeDecision,
} from "@/lib/conciergeAdmin.functions";
import type {
  ConciergeAdminTemplate,
  ConciergeWhatsappDeployment,
} from "@/lib/conciergeTemplateAdmin";
import type { Lang } from "@/lib/i18n";

type JourneyMode = "paused" | "shadow" | "test_only" | "live";
type MutableChannel = "push" | "email" | "whatsapp";

const COPY = {
  en: {
    title: "Concierge command center",
    intro: "Monitor automated journeys, review exceptions, and test decisions safely.",
    safe: "Safe by default",
    safeDetail: "Live delivery requires explicit confirmation. Simulation never sends.",
    refresh: "Refresh",
    attention: "Needs attention",
    noAttention: "Nothing needs attention right now.",
    health: "Runtime health",
    pending: "Pending events",
    dead: "Dead-lettered",
    shadow: "Shadow evaluations",
    suppressed: "Suppressions",
    channels: "Delivery channels",
    channelsHint: "These controls affect Concierge automation only, not the studio inbox.",
    durable: "Always available",
    enabled: "Enabled",
    disabled: "Disabled",
    enable: "Enable",
    disable: "Disable",
    journeys: "Automated journeys",
    journeyHint: "Start in shadow, validate in test-only, then explicitly promote to live.",
    simulator: "Decision simulator",
    simulatorHint: "No message is sent and no frequency reservation is created.",
    recipient: "Preview recipient identifier",
    simulate: "Simulate booking",
    oldest: "Oldest pending",
    loading: "Loading Concierge status…",
    loadError: "Concierge status could not be loaded.",
    retry: "Try again",
    live: "live",
    policy: "Policy",
    updateSuccess: "Concierge journey updated",
    channelSuccess: "Concierge channel updated",
    simulationError: "Simulation failed",
    livePrompt: 'Type "ENABLE LIVE CONCIERGE" to continue',
    outbox: "Outbox",
    switches: "Kill switches",
    rollout: "Shadow → test → live",
    preview: "Safe preview",
    templates: "Templates",
    approveTemplates: "Approve template library",
    templateApprovalPrompt: 'Type "APPROVE CONCIERGE TEMPLATES" to approve the reviewed copy',
    templateSuccess: "Concierge templates approved",
    templateLibrary: "Template library",
    templateLibraryHint:
      "Preview approved or draft copy with safe sample values, then inspect its source variables.",
    allJourneys: "All journeys",
    allChannels: "All channels",
    allLanguages: "All languages",
    searchTemplates: "Search template copy",
    noTemplates: "No templates match these filters.",
    subject: "Subject",
    body: "Message",
    variables: "Variables",
    approved: "Approved",
    draft: "Draft",
    results: "templates",
    overview: "Overview",
    source: "Template source",
  },
  he: {
    title: "מרכז הפיקוד של הקונסיירז׳",
    intro: "מעקב אחר מסעות אוטומטיים, טיפול בחריגות ובדיקת החלטות באופן בטוח.",
    safe: "בטוח כברירת מחדל",
    safeDetail: "הפעלה חיה דורשת אישור מפורש. סימולציה לעולם אינה שולחת.",
    refresh: "רענון",
    attention: "דורש תשומת לב",
    noAttention: "אין כרגע פריטים שדורשים טיפול.",
    health: "בריאות המערכת",
    pending: "אירועים בהמתנה",
    dead: "אירועים שנכשלו",
    shadow: "בדיקות צל",
    suppressed: "הודעות שנעצרו",
    channels: "ערוצי מסירה",
    channelsHint: "הבקרות משפיעות רק על אוטומציות הקונסיירז׳, לא על תיבת השיחות.",
    durable: "זמין תמיד",
    enabled: "פעיל",
    disabled: "כבוי",
    enable: "הפעלה",
    disable: "כיבוי",
    journeys: "מסעות אוטומטיים",
    journeyHint: "מתחילים במצב צל, בודקים במצב ניסוי ורק אז מאשרים הפעלה חיה.",
    simulator: "סימולטור החלטות",
    simulatorHint: "לא נשלחת הודעה ולא נוצרת שמירת תדירות.",
    recipient: "מזהה נמען לתצוגה מקדימה",
    simulate: "סימולציית הזמנה",
    oldest: "האירוע הוותיק ביותר",
    loading: "טוען את מצב הקונסיירז׳…",
    loadError: "לא ניתן לטעון את מצב הקונסיירז׳.",
    retry: "ניסיון נוסף",
    live: "פעילים",
    policy: "מדיניות",
    updateSuccess: "מסע הקונסיירז׳ עודכן",
    channelSuccess: "ערוץ הקונסיירז׳ עודכן",
    simulationError: "הסימולציה נכשלה",
    livePrompt: 'כדי להמשיך, הקלידו "ENABLE LIVE CONCIERGE"',
    outbox: "תור שליחה",
    switches: "מתגי חירום",
    rollout: "צל ← ניסוי ← חי",
    preview: "תצוגה בטוחה",
    templates: "תבניות",
    approveTemplates: "אישור ספריית התבניות",
    templateApprovalPrompt: 'יש להקליד "APPROVE CONCIERGE TEMPLATES" כדי לאשר את התוכן שנבדק',
    templateSuccess: "תבניות הקונסיירז׳ אושרו",
    templateLibrary: "ספריית התבניות",
    templateLibraryHint: "תצוגה של תוכן מאושר או טיוטה עם ערכי דוגמה בטוחים ומקור המשתנים.",
    allJourneys: "כל המסעות",
    allChannels: "כל הערוצים",
    allLanguages: "כל השפות",
    searchTemplates: "חיפוש בתוכן התבניות",
    noTemplates: "אין תבניות שמתאימות למסננים.",
    subject: "נושא",
    body: "הודעה",
    variables: "משתנים",
    approved: "מאושר",
    draft: "טיוטה",
    results: "תבניות",
    overview: "סקירה",
    source: "מקור התבנית",
  },
  ar: {
    title: "مركز تحكم الكونسيرج",
    intro: "راقبي الرحلات الآلية، راجعي الاستثناءات واختبري القرارات بأمان.",
    safe: "آمن افتراضياً",
    safeDetail: "التشغيل المباشر يحتاج تأكيداً صريحاً. المحاكاة لا ترسل أبداً.",
    refresh: "تحديث",
    attention: "يحتاج إلى متابعة",
    noAttention: "لا توجد عناصر تحتاج إلى متابعة الآن.",
    health: "صحة النظام",
    pending: "أحداث معلّقة",
    dead: "أحداث فاشلة",
    shadow: "تقييمات الظل",
    suppressed: "رسائل موقوفة",
    channels: "قنوات الإرسال",
    channelsHint: "تؤثر هذه الضوابط على أتمتة الكونسيرج فقط، وليس صندوق المحادثات.",
    durable: "متاح دائماً",
    enabled: "مفعّل",
    disabled: "متوقف",
    enable: "تفعيل",
    disable: "إيقاف",
    journeys: "الرحلات الآلية",
    journeyHint: "ابدئي بوضع الظل، تحققي في وضع الاختبار، ثم فعّلي المباشر صراحةً.",
    simulator: "محاكي القرارات",
    simulatorHint: "لن تُرسل رسالة ولن يتم إنشاء حجز للتكرار.",
    recipient: "معرّف المستلم للمعاينة",
    simulate: "محاكاة حجز",
    oldest: "أقدم حدث معلّق",
    loading: "جار تحميل حالة الكونسيرج…",
    loadError: "تعذر تحميل حالة الكونسيرج.",
    retry: "إعادة المحاولة",
    live: "مباشر",
    policy: "السياسة",
    updateSuccess: "تم تحديث رحلة الكونسيرج",
    channelSuccess: "تم تحديث قناة الكونسيرج",
    simulationError: "فشلت المحاكاة",
    livePrompt: 'للمتابعة، اكتبي "ENABLE LIVE CONCIERGE"',
    outbox: "قائمة الإرسال",
    switches: "مفاتيح الإيقاف",
    rollout: "ظل ← اختبار ← مباشر",
    preview: "معاينة آمنة",
    templates: "القوالب",
    approveTemplates: "اعتماد مكتبة القوالب",
    templateApprovalPrompt: 'اكتبي "APPROVE CONCIERGE TEMPLATES" لاعتماد النصوص التي تمت مراجعتها',
    templateSuccess: "تم اعتماد قوالب الكونسيرج",
    templateLibrary: "مكتبة القوالب",
    templateLibraryHint: "عايني النص المعتمد أو المسودة بقيم تجريبية آمنة ثم راجعي متغيرات المصدر.",
    allJourneys: "كل الرحلات",
    allChannels: "كل القنوات",
    allLanguages: "كل اللغات",
    searchTemplates: "البحث في نص القالب",
    noTemplates: "لا توجد قوالب مطابقة لهذه المرشحات.",
    subject: "العنوان",
    body: "الرسالة",
    variables: "المتغيرات",
    approved: "معتمد",
    draft: "مسودة",
    results: "قوالب",
    overview: "نظرة عامة",
    source: "مصدر القالب",
  },
} satisfies Record<Lang, Record<string, string>>;

export function ConciergeCommandCenter({ lang }: { lang: Lang }) {
  const copy = COPY[lang] ?? COPY.en;
  const queryClient = useQueryClient();
  const getCenter = useServerFn(getConciergeCenter);
  const setMode = useServerFn(setConciergeAutomationMode);
  const setChannel = useServerFn(setConciergeChannelEnabled);
  const approveTemplates = useServerFn(approveConciergeTemplates);
  const simulate = useServerFn(simulateConciergeDecision);
  const [recipientId, setRecipientId] = useState("preview-recipient");
  const [simulation, setSimulation] = useState<Record<string, unknown> | null>(null);
  const [activeView, setActiveView] = useState<"overview" | "templates">("overview");
  const center = useQuery({
    queryKey: ["concierge-center"],
    queryFn: () => getCenter(),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["concierge-center"] });
  const modeMutation = useMutation({
    mutationFn: (input: { automationId: string; mode: JourneyMode; confirmation?: string }) =>
      setMode({ data: input }),
    onSuccess: async () => {
      await refresh();
      toast.success(copy.updateSuccess);
    },
    onError: (error) => toast.error(error.message),
  });
  const channelMutation = useMutation({
    mutationFn: (input: { channel: MutableChannel; enabled: boolean }) =>
      setChannel({ data: input }),
    onSuccess: async () => {
      await refresh();
      toast.success(copy.channelSuccess);
    },
    onError: (error) => toast.error(error.message),
  });
  const templateMutation = useMutation({
    mutationFn: () =>
      approveTemplates({ data: { confirmation: "APPROVE CONCIERGE TEMPLATES" as const } }),
    onSuccess: async () => {
      await refresh();
      toast.success(copy.templateSuccess);
    },
    onError: (error) => toast.error(error.message),
  });
  const simulationMutation = useMutation({
    mutationFn: () =>
      simulate({
        data: {
          recipientId,
          locale: lang,
          hasPush: true,
          event: "booking_confirmed",
          purpose: "transactional",
          priority: 3,
          simulatedAt: new Date().toISOString(),
        },
      }),
    onSuccess: (result) => setSimulation(result as Record<string, unknown>),
    onError: (error) => toast.error(error instanceof Error ? error.message : copy.simulationError),
  });

  if (center.isLoading) {
    return <div className="editorial-panel p-6 text-sm text-slate">{copy.loading}</div>;
  }
  if (center.isError) {
    return (
      <div className="editorial-panel flex items-center justify-between gap-4 p-6">
        <p className="text-sm text-destructive">{copy.loadError}</p>
        <Button variant="outline" onClick={() => center.refetch()}>
          {copy.retry}
        </Button>
      </div>
    );
  }

  const suppressionCount = Object.values(center.data?.shadowSummary.suppressions ?? {}).reduce(
    (total, value) => total + Number(value),
    0,
  );
  const liveCount = (center.data?.automations ?? []).filter(
    (automation: { mode: string }) => automation.mode === "live",
  ).length;
  const unhealthy = (center.data?.queueHealth.deadLettered ?? 0) > 0;
  const templates = (center.data?.templates ?? []) as ConciergeAdminTemplate[];
  const whatsappDeployments = (center.data?.whatsappDeployments ??
    []) as ConciergeWhatsappDeployment[];

  return (
    <div className="space-y-7">
      <section className="editorial-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-navy p-5 text-ivory">
          <div className="flex items-start gap-3">
            <Bot className="mt-0.5 h-6 w-6 text-gold" />
            <div>
              <h2 className="font-serif text-2xl">{copy.title}</h2>
              <p className="mt-1 text-sm text-ivory/70">{copy.intro}</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="border-ivory/30 bg-transparent text-ivory hover:bg-ivory/10"
            disabled={center.isFetching}
            onClick={() => center.refetch()}
          >
            <RefreshCw className={`h-4 w-4 ${center.isFetching ? "animate-spin" : ""}`} />
            {copy.refresh}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
          <span className="inline-flex items-center gap-2 font-medium text-navy">
            {unhealthy ? (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
            )}
            {copy.safe}
          </span>
          <span className="text-slate">{copy.safeDetail}</span>
          <Badge variant={liveCount > 0 ? "destructive" : "secondary"}>
            {liveCount} {copy.live}
          </Badge>
          <Badge
            variant={center.data?.templateHealth.awaitingApproval ? "destructive" : "secondary"}
          >
            {center.data?.templateHealth.approved ?? 0}/{center.data?.templateHealth.total ?? 0}{" "}
            {copy.templates}
          </Badge>
          {(center.data?.templateHealth.awaitingApproval ?? 0) > 0 && (
            <Button
              variant="outline"
              disabled={templateMutation.isPending}
              onClick={() => {
                const confirmation = window.prompt(copy.templateApprovalPrompt);
                if (confirmation === "APPROVE CONCIERGE TEMPLATES") {
                  templateMutation.mutate();
                }
              }}
            >
              {copy.approveTemplates}
            </Button>
          )}
        </div>
      </section>

      <div className="flex gap-2" role="tablist" aria-label={copy.title}>
        {(["overview", "templates"] as const).map((view) => (
          <Button
            key={view}
            role="tab"
            aria-selected={activeView === view}
            variant={activeView === view ? "default" : "outline"}
            onClick={() => setActiveView(view)}
          >
            {view === "overview" ? copy.overview : copy.templates}
          </Button>
        ))}
      </div>

      {activeView === "overview" && (
        <>
          <AdminSection title={copy.attention} eyebrow="Concierge">
            <div className="space-y-2">
              {(center.data?.attention ?? []).map(
                (item: { id: string; title: string; item_type: string; severity: string }) => (
                  <div
                    className="editorial-panel flex items-center justify-between gap-4 p-4"
                    key={item.id}
                  >
                    <div>
                      <p className="font-medium text-navy">{item.title}</p>
                      <p className="mt-1 text-xs text-slate">
                        {item.item_type.replaceAll("_", " ")}
                      </p>
                    </div>
                    <Badge variant={item.severity === "urgent" ? "destructive" : "secondary"}>
                      {item.severity}
                    </Badge>
                  </div>
                ),
              )}
              {center.data?.attention.length === 0 && (
                <div className="editorial-panel flex items-center gap-3 p-5 text-slate">
                  <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                  {copy.noAttention}
                </div>
              )}
            </div>
          </AdminSection>

          <AdminSection title={copy.health} eyebrow={copy.outbox}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label={copy.pending} value={center.data?.queueHealth.pending ?? 0} />
              <Metric label={copy.dead} value={center.data?.queueHealth.deadLettered ?? 0} alert />
              <Metric label={copy.shadow} value={center.data?.shadowSummary.evaluated ?? 0} />
              <Metric label={copy.suppressed} value={suppressionCount} />
            </div>
            {center.data?.queueHealth.oldestPendingAt && (
              <p className="text-xs text-slate">
                {copy.oldest}:{" "}
                <span dir="ltr">
                  {new Date(center.data.queueHealth.oldestPendingAt).toLocaleString()}
                </span>
              </p>
            )}
          </AdminSection>

          <AdminSection title={copy.channels} eyebrow={copy.switches}>
            <p className="mb-4 text-sm text-slate">{copy.channelsHint}</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(center.data?.channels ?? []).map(
                (channel: { channel: string; enabled: boolean }) => (
                  <div
                    className="editorial-panel flex items-center justify-between gap-3 p-4"
                    key={channel.channel}
                  >
                    <div>
                      <p className="font-medium capitalize text-navy">
                        {channel.channel.replace("_", " ")}
                      </p>
                      <p className="mt-1 text-xs text-slate">
                        {channel.channel === "in_app"
                          ? copy.durable
                          : channel.enabled
                            ? copy.enabled
                            : copy.disabled}
                      </p>
                    </div>
                    {channel.channel === "in_app" ? (
                      <Badge>{copy.durable}</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant={channel.enabled ? "destructive" : "outline"}
                        disabled={channelMutation.isPending}
                        onClick={() =>
                          channelMutation.mutate({
                            channel: channel.channel as MutableChannel,
                            enabled: !channel.enabled,
                          })
                        }
                      >
                        {channel.enabled ? copy.disable : copy.enable}
                      </Button>
                    )}
                  </div>
                ),
              )}
            </div>
          </AdminSection>

          <AdminSection title={copy.journeys} eyebrow={copy.rollout}>
            <p className="mb-4 text-sm text-slate">{copy.journeyHint}</p>
            <div className="grid gap-4 lg:grid-cols-2">
              {(center.data?.automations ?? []).map(
                (automation: {
                  id: string;
                  journey_type: string;
                  version: number;
                  mode: JourneyMode;
                }) => (
                  <article className="editorial-panel space-y-4 p-5" key={automation.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-serif text-xl capitalize text-navy">
                          {automation.journey_type.replaceAll("_", " ")}
                        </h3>
                        <p className="text-xs text-slate">
                          {copy.policy} v{automation.version}
                        </p>
                      </div>
                      <Badge>{automation.mode.replace("_", " ")}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(["paused", "shadow", "test_only", "live"] as const).map((mode) => (
                        <Button
                          key={mode}
                          size="sm"
                          variant={automation.mode === mode ? "default" : "outline"}
                          disabled={modeMutation.isPending}
                          onClick={() => {
                            const confirmation =
                              mode === "live"
                                ? (window.prompt(copy.livePrompt) ?? undefined)
                                : undefined;
                            if (mode === "live" && confirmation !== "ENABLE LIVE CONCIERGE") return;
                            modeMutation.mutate({
                              automationId: automation.id,
                              mode,
                              confirmation,
                            });
                          }}
                        >
                          {mode.replace("_", " ")}
                        </Button>
                      ))}
                    </div>
                  </article>
                ),
              )}
            </div>
          </AdminSection>

          <AdminSection title={copy.simulator} eyebrow={copy.preview}>
            <p className="mb-4 text-sm text-slate">{copy.simulatorHint}</p>
            <div className="editorial-panel grid gap-4 p-5 md:grid-cols-[1fr_auto]">
              <Input
                aria-label={copy.recipient}
                value={recipientId}
                onChange={(event) => setRecipientId(event.target.value)}
              />
              <Button
                disabled={simulationMutation.isPending || recipientId.trim().length === 0}
                onClick={() => simulationMutation.mutate()}
              >
                {copy.simulate}
              </Button>
              {simulation && (
                <pre
                  dir="ltr"
                  className="overflow-auto rounded-lg bg-navy p-4 text-left text-xs text-ivory md:col-span-2"
                >
                  {JSON.stringify(simulation, null, 2)}
                </pre>
              )}
            </div>
          </AdminSection>
        </>
      )}

      {activeView === "templates" && (
        <ConciergeTemplateLibrary
          templates={templates}
          whatsappDeployments={whatsappDeployments}
          copy={copy}
        />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div className="editorial-panel p-4">
      <p className="text-sm text-slate">{label}</p>
      <p
        className={`mt-1 font-serif text-3xl ${alert && value > 0 ? "text-destructive" : "text-navy"}`}
      >
        {value}
      </p>
    </div>
  );
}
