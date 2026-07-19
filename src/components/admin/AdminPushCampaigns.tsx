import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, Clock3, Eye, Send, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useI18n, type Lang } from "@/lib/i18n";
import {
  createAdminNotificationCampaign,
  listAdminNotificationCampaigns,
  previewAdminNotificationCampaignAudience,
} from "@/lib/adminNotificationCampaigns.functions";
import type { CampaignAudience } from "@/lib/adminNotificationCampaigns";

type CampaignCategory = "activation" | "marketing" | "retention" | "schedule";
type AudienceKind = Exclude<CampaignAudience["kind"], "specific">;
type CampaignSummary = {
  id: string;
  name: string;
  status: string;
  recipient_count: number;
  sent_count: number;
  opened_count: number;
  booked_count: number;
};

const DEFAULT_CONTENT = {
  he: {
    title: "מערכת השיעורים החדשה פתוחה",
    body: "בחרי את השיעורים שמתאימים לשבוע שלך ושמרי מקום.",
  },
  ar: {
    title: "جدول الحصص الجديد مفتوح",
    body: "اختاري الحصص المناسبة لأسبوعك واحجزي مكانك.",
  },
  en: {
    title: "The new class schedule is open",
    body: "Choose the lessons that fit your week and save your place.",
  },
};

const COPY: Record<Lang, Record<string, string>> = {
  en: {
    title: "iPhone campaigns",
    intro: "Preview the final eligible audience, review every language, then send or schedule.",
    campaignName: "Campaign name",
    category: "Category",
    audience: "Audience",
    destination: "Opens in the app",
    timing: "Send time",
    now: "Send now",
    preview: "Preview audience",
    send: "Send campaign",
    schedule: "Schedule campaign",
    eligible: "eligible iPhones",
    selected: "selected members",
    noDevice: "without an active iPhone",
    disabled: "preference disabled",
    limited: "frequency limited",
    recent: "Recent campaigns",
    empty: "No iPhone campaigns yet.",
    sent: "Campaign prepared successfully.",
  },
  he: {
    title: "קמפיינים ל-iPhone",
    intro: "בודקים את הקהל הסופי, עוברים על כל השפות ורק אז שולחים או מתזמנים.",
    campaignName: "שם הקמפיין",
    category: "סוג הודעה",
    audience: "קהל יעד",
    destination: "מסך שייפתח באפליקציה",
    timing: "מועד שליחה",
    now: "שליחה עכשיו",
    preview: "בדיקת קהל היעד",
    send: "שליחת קמפיין",
    schedule: "תזמון קמפיין",
    eligible: "מכשירי iPhone מתאימים",
    selected: "חברים שנבחרו",
    noDevice: "ללא iPhone פעיל",
    disabled: "ביטלו את הקטגוריה",
    limited: "הגיעו למגבלת תדירות",
    recent: "קמפיינים אחרונים",
    empty: "עדיין לא נשלחו קמפיינים ל-iPhone.",
    sent: "הקמפיין הוכן בהצלחה.",
  },
  ar: {
    title: "حملات iPhone",
    intro: "راجعي الجمهور النهائي وكل لغة، ثم أرسلي الحملة أو حددي موعدها.",
    campaignName: "اسم الحملة",
    category: "الفئة",
    audience: "الجمهور",
    destination: "الصفحة التي ستفتح",
    timing: "وقت الإرسال",
    now: "إرسال الآن",
    preview: "معاينة الجمهور",
    send: "إرسال الحملة",
    schedule: "جدولة الحملة",
    eligible: "أجهزة iPhone مؤهلة",
    selected: "أعضاء محددون",
    noDevice: "بدون iPhone فعال",
    disabled: "الفئة متوقفة",
    limited: "وصلوا إلى حد التكرار",
    recent: "الحملات الأخيرة",
    empty: "لا توجد حملات iPhone بعد.",
    sent: "تم إعداد الحملة بنجاح.",
  },
};

const AUDIENCES: Array<{ value: AudienceKind; label: Record<Lang, string> }> = [
  {
    value: "all_marketing",
    label: { en: "All opted-in members", he: "כל מי שאישר", ar: "كل من وافق" },
  },
  {
    value: "never_booked",
    label: { en: "Never booked", he: "טרם נרשמו לשיעור", ar: "لم يحجزوا بعد" },
  },
  {
    value: "no_upcoming",
    label: { en: "No upcoming booking", he: "ללא שיעור קרוב", ar: "بدون حجز قادم" },
  },
  {
    value: "inactive_14d",
    label: { en: "Inactive 14+ days", he: "לא פעילים 14+ ימים", ar: "غير نشطين 14+ يوماً" },
  },
  { value: "low_credits", label: { en: "Low credits", he: "מעט קרדיטים", ar: "أرصدة منخفضة" } },
  {
    value: "expiring_7d",
    label: {
      en: "Package expiring in 7 days",
      he: "חבילה מסתיימת תוך 7 ימים",
      ar: "الباقة تنتهي خلال 7 أيام",
    },
  },
];

export function AdminPushCampaigns() {
  const { lang } = useI18n();
  const copy = COPY[lang];
  const queryClient = useQueryClient();
  const previewAudience = useServerFn(previewAdminNotificationCampaignAudience);
  const createCampaign = useServerFn(createAdminNotificationCampaign);
  const listCampaigns = useServerFn(listAdminNotificationCampaigns);
  const [name, setName] = useState("Weekly schedule");
  const [category, setCategory] = useState<CampaignCategory>("schedule");
  const [audienceKind, setAudienceKind] = useState<AudienceKind>("all_marketing");
  const [actionUrl, setActionUrl] = useState("/member/schedule");
  const [sendAt, setSendAt] = useState("");
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [preview, setPreview] = useState<null | {
    selectedCount: number;
    eligibleCount: number;
    excluded: { noActiveDevice: number; preferenceDisabled: number; frequencyLimited: number };
  }>(null);

  const campaigns = useQuery({
    queryKey: ["admin-notification-campaigns"],
    queryFn: () => listCampaigns(),
  });
  const previewMutation = useMutation({
    mutationFn: () => previewAudience({ data: { category, audience: { kind: audienceKind } } }),
    onSuccess: (result) => setPreview(result),
    onError: () => toast.error("Audience preview failed"),
  });
  const sendMutation = useMutation({
    mutationFn: () =>
      createCampaign({
        data: {
          name,
          category,
          localizedContent: content,
          actionUrl,
          audience: { kind: audienceKind },
          sendAt: sendAt ? new Date(sendAt).toISOString() : null,
        },
      }),
    onSuccess: () => {
      toast.success(copy.sent);
      setPreview(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-notification-campaigns"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Campaign failed"),
  });

  function invalidatePreview() {
    setPreview(null);
  }

  return (
    <div className="space-y-6">
      <section className="editorial-panel p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/12 text-navy">
            <BellRing className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-navy">{copy.title}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate">{copy.intro}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label={copy.campaignName}>
            <input
              className="editorial-input"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                invalidatePreview();
              }}
            />
          </Field>
          <Field label={copy.category}>
            <select
              className="editorial-input"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value as CampaignCategory);
                invalidatePreview();
              }}
            >
              <option value="schedule">Schedule</option>
              <option value="activation">Activation</option>
              <option value="retention">Retention</option>
              <option value="marketing">Marketing</option>
            </select>
          </Field>
          <Field label={copy.audience}>
            <select
              className="editorial-input"
              value={audienceKind}
              onChange={(event) => {
                setAudienceKind(event.target.value as AudienceKind);
                invalidatePreview();
              }}
            >
              {AUDIENCES.map((audience) => (
                <option key={audience.value} value={audience.value}>
                  {audience.label[lang]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={copy.destination}>
            <select
              className="editorial-input"
              value={actionUrl}
              onChange={(event) => {
                setActionUrl(event.target.value);
                invalidatePreview();
              }}
            >
              <option value="/member/schedule">Schedule</option>
              <option value="/member/bookings">Bookings</option>
              <option value="/member/packages">Packages & payments</option>
              <option value="/member/account">Account</option>
            </select>
          </Field>
          <Field label={copy.timing}>
            <input
              type="datetime-local"
              className="editorial-input"
              value={sendAt}
              onChange={(event) => {
                setSendAt(event.target.value);
                invalidatePreview();
              }}
            />
            <p className="mt-1 text-xs text-slate">{sendAt ? "" : copy.now}</p>
          </Field>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {(["he", "ar", "en"] as const).map((language) => (
            <div
              key={language}
              dir={language === "en" ? "ltr" : "rtl"}
              className="rounded-[var(--radius-lg)] border border-gold/20 bg-white/55 p-4"
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-gold">
                {language}
              </p>
              <input
                className="editorial-input"
                value={content[language].title}
                onChange={(event) => {
                  setContent((current) => ({
                    ...current,
                    [language]: { ...current[language], title: event.target.value },
                  }));
                  invalidatePreview();
                }}
              />
              <textarea
                className="editorial-input mt-3 min-h-28 resize-y"
                value={content[language].body}
                onChange={(event) => {
                  setContent((current) => ({
                    ...current,
                    [language]: { ...current[language], body: event.target.value },
                  }));
                  invalidatePreview();
                }}
              />
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => previewMutation.mutate()}
            disabled={previewMutation.isPending}
            className="btn-outline inline-flex items-center gap-2 px-4 py-2 text-xs hover:btn-outline-hover"
          >
            <Eye className="h-4 w-4" /> {copy.preview}
          </button>
          {preview && (
            <button
              type="button"
              onClick={() => sendMutation.mutate()}
              disabled={!preview.eligibleCount || sendMutation.isPending}
              className="btn-navy inline-flex items-center gap-2 px-4 py-2 text-xs hover:btn-navy-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sendAt ? <Clock3 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {sendAt ? copy.schedule : copy.send} · {preview.eligibleCount}
            </button>
          )}
        </div>

        {preview && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric
              label={copy.selected}
              value={preview.selectedCount}
              icon={<Users className="h-4 w-4" />}
            />
            <Metric
              label={copy.eligible}
              value={preview.eligibleCount}
              icon={<BellRing className="h-4 w-4" />}
            />
            <Metric label={copy.noDevice} value={preview.excluded.noActiveDevice} />
            <Metric label={copy.disabled} value={preview.excluded.preferenceDisabled} />
            <Metric label={copy.limited} value={preview.excluded.frequencyLimited} />
          </div>
        )}
      </section>

      <section className="editorial-panel overflow-hidden">
        <div className="border-b border-gold/20 px-5 py-4">
          <h2 className="font-semibold text-navy">{copy.recent}</h2>
        </div>
        {!campaigns.data?.length ? (
          <p className="p-6 text-sm text-slate">{copy.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-start text-sm">
              <thead className="bg-white/45 text-xs text-slate">
                <tr>
                  <th className="px-5 py-3 font-medium">Campaign</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Audience</th>
                  <th className="px-3 py-3 font-medium">Sent</th>
                  <th className="px-3 py-3 font-medium">Opened</th>
                  <th className="px-3 py-3 font-medium">Booked</th>
                </tr>
              </thead>
              <tbody>
                {((campaigns.data ?? []) as CampaignSummary[]).map((campaign) => (
                  <tr key={campaign.id} className="border-t border-gold/15">
                    <td className="px-5 py-3 font-medium text-navy">{campaign.name}</td>
                    <td className="px-3 py-3 text-slate">{campaign.status}</td>
                    <td className="px-3 py-3 text-slate">{campaign.recipient_count}</td>
                    <td className="px-3 py-3 text-slate">{campaign.sent_count}</td>
                    <td className="px-3 py-3 text-slate">{campaign.opened_count}</td>
                    <td className="px-3 py-3 text-slate">{campaign.booked_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-start">
      <span className="mb-2 block text-xs font-semibold text-slate">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-gold/20 bg-white/55 p-3 text-start">
      <p className="flex items-center gap-1.5 text-xs text-slate">
        {icon} {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-navy">{value}</p>
    </div>
  );
}
