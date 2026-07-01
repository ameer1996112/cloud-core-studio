import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Sparkles,
  Check,
  CreditCard,
  FileText,
  MessageCircle,
  Send,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getMyPackages } from "@/lib/member.functions";
import { getPublicStudioSettings } from "@/lib/studioSettings.functions";
import { createManualPackagePayment, getMyPackageRequests } from "@/lib/memberRequests.functions";
import { waUrl } from "@/lib/messageTemplate";
import { LANG_META, labelForMethod, labelForStatus, t, useI18n, type Lang } from "@/lib/i18n";
import { MemberEmptyState } from "@/components/member/PremiumClassCard";
import { formatPlanPrice, getPlanDisplay } from "@/lib/planDisplay";
import { hasTestPlanRecord } from "@/lib/test-records";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { LtrInline } from "@/components/ui/bidi";

export const Route = createFileRoute("/_authenticated/member/packages")({
  component: MemberPackages,
});

function MemberPackages() {
  const { lang, locale, dir } = useI18n();
  useDocumentTitle("page.packages.title");
  const fetchPackages = useServerFn(getMyPackages);
  const fetchSettings = useServerFn(getPublicStudioSettings);
  const fetchRequests = useServerFn(getMyPackageRequests);
  const createManualPayment = useServerFn(createManualPackagePayment);
  const qc = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["member-packages"],
    queryFn: () => fetchPackages(),
  });
  const { data: settings } = useQuery({
    queryKey: ["public-studio-settings"],
    queryFn: () => fetchSettings(),
  });
  const { data: requests } = useQuery({
    queryKey: ["my-package-requests"],
    queryFn: () => fetchRequests(),
  });

  const manualPayment = useMutation({
    mutationFn: (v: { planId: string; method: "cash" | "bit"; messageText: string }) =>
      createManualPayment({ data: v }),
    onSuccess: () => {
      toast.success(t("packages.requestReceived"));
      setSelectedPlan(null);
      qc.invalidateQueries({ queryKey: ["member-packages"] });
    },
    onError: () => toast.error(t("packages.manualPaymentError")),
  });

  const active = data?.mine.find((p: any) => p.status === "active");
  const credits = data?.member?.remaining_credits ?? 0;
  const memberName = data?.member?.name?.split(" ")[0] ?? "";
  const pendingPayments = (data?.payments ?? []).filter((p: any) => p.status === "pending");
  const visiblePlans = (data?.plans ?? [])
    .filter((p: any) => !hasTestPlanRecord(p))
    .sort(comparePricingPlans);

  function submitManualPayment(plan: any, method: "cash" | "bit") {
    const planDisplay = getPlanDisplay(plan, lang);
    const amount = formatPlanPrice(plan);
    const text =
      method === "bit"
        ? t("member.packageBitConfirmationMessage", {
            studio: settings?.studio_name ?? "Cloud & Core",
            member: memberName || t("member.friend"),
            plan: planDisplay.name,
            amount,
          })
        : t("member.packageManualPaymentMessage", {
            studio: settings?.studio_name ?? "Cloud & Core",
            member: memberName || t("member.friend"),
            plan: planDisplay.name,
            method: labelForMethod(method),
            amount,
            credits,
          });
    manualPayment.mutate({ planId: plan.id, method, messageText: text });
  }

  const requestsByPlan: Record<string, any> = {};
  for (const r of requests ?? []) if (r.plan_id) requestsByPlan[r.plan_id] = r;

  return (
    <section dir={dir} className="member-page w-full space-y-6 sm:space-y-8 pb-10">
      <div className="member-page-panel p-5 sm:p-8">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] md:items-end">
          <div className="member-page-copy">
            <p className="member-eyebrow">{t("member.packages.kicker")}</p>
            <h1 className="member-page-title mt-3">{t("nav.plans")}</h1>
            <p className="member-page-body mt-3">{t("member.packages.body")}</p>
          </div>
          <div className="member-stat-strip">
            <StatCell label={t("member.stat.credits")} value={credits} />
            <StatCell label={t("payments.pending")} value={pendingPayments.length} />
          </div>
        </div>
        <div className="mt-6 border-t border-gold/25 pt-5">
          <p className="member-eyebrow">{t("member.activePackage")}</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <p className="font-display text-[clamp(1.55rem,7vw,1.875rem)] text-navy leading-tight">
              {active?.plan
                ? t("member.planWithCredits", {
                    plan: getPlanDisplay(active.plan, lang).name,
                    count: credits,
                  })
                : credits > 0
                  ? t("member.creditsAvailable", { count: credits })
                  : t("member.noActivePackage")}
            </p>
            {active?.expires_at && (
              <p className="text-sm text-slate">
                {t("member.expires")}{" "}
                <LtrInline className="text-navy">
                  {new Date(active.expires_at).toLocaleDateString(locale, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </LtrInline>
              </p>
            )}
          </div>
        </div>
      </div>

      {requests && requests.length > 0 && (
        <div className="space-y-2">
          <h2 className="member-eyebrow">{t("packages.recent")}</h2>
          <div className="member-card divide-y hairline">
            {requests.slice(0, 4).map((r: any) => (
              <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-navy truncate">
                    {r.plan ? getPlanDisplay(r.plan, lang).name : t("nav.plans")}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-slate">
                    {new Date(r.created_at).toLocaleDateString(locale)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${
                    r.status === "paid"
                      ? "border-navy bg-navy text-ivory"
                      : r.status === "contacted"
                        ? "border-powder/70 bg-powder/75 text-navy"
                        : r.status === "cancelled"
                          ? "border-sand bg-sand/70 text-slate"
                          : "border-gold/35 bg-gold/12 text-navy"
                  }`}
                >
                  {labelForStatus(r.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="member-section-heading">
          <div>
            <h2 className="member-section-title">{t("packages.available")}</h2>
            <p className="member-page-body mt-2 max-w-2xl text-sm sm:text-base">
              {pricingCopy[lang].subtitle}
            </p>
          </div>
        </div>
        <div className="package-value-strip" aria-label={pricingCopy[lang].valueStripLabel}>
          {pricingCopy[lang].valueChips.map((chip) => (
            <span key={chip} className="package-value-chip">
              {chip}
            </span>
          ))}
        </div>
        {isLoading && <div className="h-40 skeleton-brand rounded-[var(--cc-radius-card)]" />}
        {visiblePlans.length === 0 && !isLoading ? (
          <MemberEmptyState
            variant="packages"
            title={t("member.empty.packages.title")}
            body={t("member.empty.packages.body")}
          />
        ) : (
          <div className="package-pricing-grid">
            {visiblePlans.map((p: any) => (
              <PackagePricingCard
                key={p.id}
                plan={p}
                lang={lang}
                request={requestsByPlan[p.id]}
                payment={pendingPayments.find(
                  (payment: any) => payment.plan?.id === p.id && payment.status === "pending",
                )}
                onRequest={() => setSelectedPlan(p)}
                pending={manualPayment.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {selectedPlan && (
        <PaymentMethodSheet
          plan={selectedPlan}
          lang={lang}
          settings={settings}
          pending={manualPayment.isPending}
          onClose={() => setSelectedPlan(null)}
          onSubmit={(method) => submitManualPayment(selectedPlan, method)}
        />
      )}

      <div className="space-y-3">
        <div className="member-section-heading">
          <h2 className="member-section-title">{t("packages.creditHistory")}</h2>
        </div>
        {data?.ledger.length === 0 ? (
          <MemberEmptyState
            variant="packages"
            title={t("packages.noCredit")}
            body={t("member.empty.packages.body")}
            align="start"
            tone="sand"
            illustration={null}
          />
        ) : (
          <div className="member-card divide-y hairline">
            {data?.ledger.map((t: any) => (
              <div key={t.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <p className="text-navy truncate">
                    {formatCreditReason(t.reason, t.amount_delta)}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-slate">
                    {new Date(t.created_at).toLocaleDateString(locale)}
                  </p>
                </div>
                <span
                  className={`numeric-display font-display text-xl ${t.amount_delta >= 0 ? "text-navy" : "text-slate"}`}
                >
                  {t.amount_delta > 0 ? "+" : ""}
                  {t.amount_delta}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="member-section-heading">
          <h2 className="member-section-title">{t("packages.paymentHistory")}</h2>
        </div>
        {data?.payments.length === 0 ? (
          <MemberEmptyState
            variant="payments"
            title={t("packages.noPayments")}
            body={t("member.empty.payments.body")}
            align="start"
            tone="ivory"
          />
        ) : (
          <div className="member-card divide-y hairline">
            {data?.payments.map((p: any) => {
              const receipt = Array.isArray(p.receipt) ? p.receipt[0] : p.receipt;
              return (
                <div
                  key={p.id}
                  className="px-4 py-3 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="text-navy truncate">
                      {p.plan ? getPlanDisplay(p.plan, lang).name : t("receipt.studioPayment")}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-medium text-slate">
                      {new Date(p.created_at ?? p.paid_at).toLocaleDateString(locale)} ·{" "}
                      {labelForMethod(p.method)} · {labelForStatus(p.status)}
                    </p>
                  </div>
                  <div className="text-start shrink-0">
                    <p className="font-display text-xl text-navy">
                      <LtrInline>{formatPaymentAmount(p.amount, p.currency)}</LtrInline>
                    </p>
                    {receipt && (
                      <Link
                        to="/receipts/$id"
                        params={{ id: receipt.id }}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-navy hover:text-gold"
                      >
                        <FileText className="h-3 w-3" /> {receipt.receipt_number}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function StatCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="member-stat-cell">
      <p className="member-eyebrow text-slate">{label}</p>
      <p className="numeric-display numeric-display-md mt-2">{value}</p>
    </div>
  );
}

function PackagePricingCard({
  plan,
  lang,
  request,
  payment,
  onRequest,
  pending,
}: {
  plan: any;
  lang: Lang;
  request?: any;
  payment?: any;
  onRequest: () => void;
  pending: boolean;
}) {
  const isUnlimited = plan.credits >= 999 || /unlim/i.test(plan.name);
  const display = getPlanDisplay(plan, lang);
  const price = formatPlanPrice(plan);
  const marketing = getPackageMarketing(plan, lang);
  const isRecommended = marketing.kind === "recommended";
  const creditsLine = getPackageCreditsLine(plan.credits, lang);
  return (
    <div
      className={`package-plan-card member-card ${isRecommended ? "is-recommended" : ""}`}
      data-plan-kind={marketing.kind}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-2xl text-navy leading-tight">{display.name}</p>
            {marketing.badge && <span className="package-plan-badge">{marketing.badge}</span>}
            {marketing.secondaryBadge && (
              <span className="package-plan-badge is-secondary">{marketing.secondaryBadge}</span>
            )}
          </div>
          <p className="text-sm text-slate mt-1.5">{marketing.subtitle || display.description}</p>
        </div>
        <span className="package-plan-icon" aria-hidden="true">
          <Sparkles className="h-4 w-4" />
        </span>
      </div>
      <div>
        <p className="numeric-display font-display text-4xl text-navy">{price}</p>
        <p className="mt-2 text-sm font-semibold text-navy">{marketing.priceNote}</p>
        {marketing.savings && (
          <p className="mt-1 text-xs font-semibold text-gold-dark">{marketing.savings}</p>
        )}
      </div>
      <div className="space-y-2 text-sm">
        {(marketing.features.length
          ? marketing.features
          : [
              isUnlimited ? t("packages.unlimited") : creditsLine,
              plan.duration_days
                ? t("packages.validDays", { days: plan.duration_days })
                : t("packages.noExpiry"),
              t("packages.allPrograms"),
            ]
        ).map((feature) => (
          <p key={feature} className="flex items-center gap-2 text-navy">
            <Check className="h-3.5 w-3.5 text-gold" /> {feature}
          </p>
        ))}
      </div>
      <div className="mt-auto flex items-end justify-between gap-3 pt-3 border-t hairline">
        <p className="text-xs font-medium text-slate">{t("packages.choosePackage")}</p>
        {payment ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-ivory px-3 py-2 text-xs font-medium text-navy">
            <Wallet className="h-3 w-3 text-gold" /> {t("packages.pendingPayment")}
          </span>
        ) : request && request.status !== "cancelled" ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-ivory px-3 py-2 text-xs font-medium text-navy">
            <MessageCircle className="h-3 w-3 text-gold" />{" "}
            {request.status === "paid" ? t("packages.activated") : t("packages.requested")}
          </span>
        ) : (
          <button
            onClick={onRequest}
            disabled={pending}
            className={
              isRecommended
                ? "btn-navy hover:btn-navy-hover disabled:opacity-50"
                : "btn-outline hover:btn-ghost-hover disabled:opacity-50"
            }
          >
            <Send className="h-3 w-3" /> {marketing.cta}
          </button>
        )}
      </div>
    </div>
  );
}

type PricingKind = "recommended" | "single" | "monthly5" | "card10" | "default";

type PricingPlanLike = {
  description?: string | null;
  price_cents?: number | string | null;
  credits?: number | string | null;
  duration_days?: number | string | null;
};

const planOrder: Record<PricingKind, number> = {
  recommended: 0,
  monthly5: 1,
  single: 2,
  card10: 3,
  default: 4,
};

const pricingCopy: Record<
  Lang,
  { subtitle: string; valueStripLabel: string; valueChips: string[] }
> = {
  he: {
    subtitle: "בחרי את החבילה שמתאימה לקצב שלך — לשיעור ניסיון, התמדה חודשית או גמישות מלאה.",
    valueStripLabel: "השוואת ערך בין החבילות",
    valueChips: ["₪80 לשיעור בודד", "₪35 לשיעור במנוי המומלץ", "חיסכון של ₪450"],
  },
  en: {
    subtitle:
      "Choose the package that fits your rhythm — a trial class, monthly consistency, or full flexibility.",
    valueStripLabel: "Package value comparison",
    valueChips: ["₪80 for a drop-in", "₪35 per class on the recommended plan", "Save ₪450"],
  },
  ar: {
    subtitle: "اختاري الباقة المناسبة لإيقاعك — تجربة واحدة، التزام شهري، أو مرونة كاملة.",
    valueStripLabel: "مقارنة قيمة الباقات",
    valueChips: ["₪80 للحصة الواحدة", "₪35 للحصة في الباقة الموصى بها", "توفير ₪450"],
  },
};

function packageKind(plan: PricingPlanLike): PricingKind {
  const code = String(plan?.description ?? "");
  if (code === "cloud_monthly_2x_week" || Number(plan?.price_cents) === 35000) return "recommended";
  if (code === "cloud_monthly_1x_week" || Number(plan?.price_cents) === 28000) return "monthly5";
  if (code === "single_class" || Number(plan?.price_cents) === 8000) return "single";
  if (code === "cloud_10_entry_card" || Number(plan?.price_cents) === 70000) return "card10";
  return "default";
}

function comparePricingPlans(a: PricingPlanLike, b: PricingPlanLike) {
  const kindDiff = planOrder[packageKind(a)] - planOrder[packageKind(b)];
  if (kindDiff !== 0) return kindDiff;
  return Number(a?.price_cents ?? 0) - Number(b?.price_cents ?? 0);
}

function getPackageMarketing(plan: PricingPlanLike, lang: Lang) {
  const kind = packageKind(plan);
  const days = Number(plan?.duration_days ?? 0);
  const credits = Number(plan?.credits ?? 0);
  const fallbackPriceNote =
    credits > 0
      ? perClassCopy(lang, Math.round(Number(plan?.price_cents ?? 0) / 100 / credits))
      : "";
  const fallbackFeatureDays = days > 0 ? t("packages.validDays", { days }) : t("packages.noExpiry");

  const copy = {
    single: {
      he: {
        subtitle: "שיעור בודד להיכרות עם הסטודיו",
        priceNote: "₪80 לשיעור",
        savings: "",
        badge: "",
        secondaryBadge: "",
        features: ["כניסה אחת לשיעור", "בתוקף ל־14 ימים", "מתאים להתנסות ראשונה"],
        cta: "בחירת שיעור",
      },
      en: {
        subtitle: "A single class to get to know the studio",
        priceNote: "₪80 per class",
        savings: "",
        badge: "",
        secondaryBadge: "",
        features: ["1 class entry", "Valid for 14 days", "Best for a first trial"],
        cta: "Choose class",
      },
      ar: {
        subtitle: "حصة واحدة للتعرّف على الاستوديو",
        priceNote: "₪80 للحصة",
        savings: "",
        badge: "",
        secondaryBadge: "",
        features: ["دخول واحد لحصة", "صالحة لمدة 14 يوم", "مناسبة للتجربة الأولى"],
        cta: "اختيار حصة",
      },
    },
    monthly5: {
      he: {
        subtitle: "מתאים למי שמגיעה פעם בשבוע",
        priceNote: "₪56 לשיעור",
        savings: "",
        badge: "",
        secondaryBadge: "",
        features: ["5 כניסות לשיעורים", "בתוקף ל־30 ימים", "לכל תכניות הסטודיו"],
        cta: "בחירת חבילה",
      },
      en: {
        subtitle: "For members who come once a week",
        priceNote: "₪56 per class",
        savings: "",
        badge: "",
        secondaryBadge: "",
        features: ["5 class entries", "Valid for 30 days", "All studio programs"],
        cta: "Choose package",
      },
      ar: {
        subtitle: "مناسب لمن تأتي مرة في الأسبوع",
        priceNote: "₪56 للحصة",
        savings: "",
        badge: "",
        secondaryBadge: "",
        features: ["5 دخولات للحصص", "صالحة لمدة 30 يوم", "كل برامج الاستوديو"],
        cta: "اختيار الباقة",
      },
    },
    recommended: {
      he: {
        subtitle: "הבחירה הטובה למי שרוצה להתקדם ולהתמיד",
        priceNote: "רק ₪35 לשיעור",
        savings: "חיסכון של ₪450 לעומת 10 כניסות חד־פעמיות",
        badge: "הכי משתלם",
        secondaryBadge: "מומלץ",
        features: [
          "10 כניסות לשיעורים",
          "בתוקף ל־30 ימים",
          "הכי מתאים להתמדה שבועית",
          "לכל תכניות הסטודיו",
        ],
        cta: "בחירת המנוי המומלץ",
      },
      en: {
        subtitle: "The best choice for progressing and staying consistent",
        priceNote: "Only ₪35 per class",
        savings: "Save ₪450 compared with 10 drop-ins",
        badge: "Best value",
        secondaryBadge: "Recommended",
        features: [
          "10 class entries",
          "Valid for 30 days",
          "Best for weekly consistency",
          "All studio programs",
        ],
        cta: "Choose recommended plan",
      },
      ar: {
        subtitle: "الخيار الأفضل للتقدّم والاستمرارية",
        priceNote: "فقط ₪35 للحصة",
        savings: "توفير ₪450 مقارنة بـ 10 دخولات منفردة",
        badge: "الأوفر",
        secondaryBadge: "موصى به",
        features: [
          "10 دخولات للحصص",
          "صالحة لمدة 30 يوم",
          "الأفضل للاستمرارية الأسبوعية",
          "كل برامج الاستوديو",
        ],
        cta: "اختيار الاشتراك الموصى به",
      },
    },
    card10: {
      he: {
        subtitle: "גמישות מלאה ללא התחייבות חודשית",
        priceNote: "₪70 לשיעור",
        savings: "",
        badge: "",
        secondaryBadge: "",
        features: ["10 כניסות לשיעורים", "בתוקף ל־90 ימים", "מתאים למי שמגיעה לא קבוע"],
        cta: "בחירת כרטיסייה",
      },
      en: {
        subtitle: "Full flexibility with no monthly commitment",
        priceNote: "₪70 per class",
        savings: "",
        badge: "",
        secondaryBadge: "",
        features: ["10 class entries", "Valid for 90 days", "Best for flexible visitors"],
        cta: "Choose class card",
      },
      ar: {
        subtitle: "مرونة كاملة بدون التزام شهري",
        priceNote: "₪70 للحصة",
        savings: "",
        badge: "",
        secondaryBadge: "",
        features: ["10 دخولات للحصص", "صالحة لمدة 90 يوم", "مناسبة لمن لا تأتي بانتظام"],
        cta: "اختيار البطاقة",
      },
    },
  } as const;

  if (kind !== "default") return { kind, ...copy[kind][lang] };
  return {
    kind,
    subtitle: "",
    priceNote: fallbackPriceNote,
    savings: "",
    badge: "",
    secondaryBadge: "",
    features: [
      getPackageCreditsLine(Number(plan?.credits ?? 0), lang),
      fallbackFeatureDays,
      t("packages.allPrograms"),
    ],
    cta: t("packages.choosePackage"),
  };
}

function perClassCopy(lang: Lang, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return "";
  if (lang === "he") return `₪${amount} לשיעור`;
  if (lang === "ar") return `₪${amount} للحصة`;
  return `₪${amount} per class`;
}

function getPackageCreditsLine(credits: number, lang: Lang) {
  if (lang === "he") {
    return credits === 1 ? "כניסה אחת לשיעור" : `${credits} כניסות לשיעורים`;
  }
  if (lang === "ar") {
    return credits === 1 ? "دخول واحد للحصص" : `${credits} دخولات للحصص`;
  }
  return credits === 1 ? "1 class credit" : `${credits} class credits`;
}

function formatCreditReason(reason: string | null | undefined, amountDelta: number) {
  const normalized = (reason ?? "").trim().toLowerCase();
  if (normalized === "booking") return t("packages.creditReasonBooking");
  if (normalized.startsWith("plan paid:")) return t("packages.creditReasonPlanPaid");
  if (normalized.includes("qa_member_sweep_")) return t("packages.creditReasonGrant");
  if (amountDelta > 0 && normalized.length === 0) return t("packages.creditReasonGrant");
  return reason?.trim() || t("packages.creditReasonGrant");
}

function PaymentMethodSheet({
  plan,
  lang,
  settings,
  pending,
  onClose,
  onSubmit,
}: {
  plan: any;
  lang: Lang;
  settings: any;
  pending: boolean;
  onClose: () => void;
  onSubmit: (method: "cash" | "bit") => void;
}) {
  const [method, setMethod] = useState<"cash" | "bit" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const dir = LANG_META[lang].dir;
  const display = getPlanDisplay(plan, lang);
  const price = formatPlanPrice(plan);
  const phone = settings?.whatsapp_number ?? settings?.public_phone ?? "";
  const bitMessage = t("member.packageBitConfirmationMessage", {
    studio: settings?.studio_name ?? "Cloud & Core",
    member: t("member.friend"),
    plan: display.name,
    amount: price,
  });

  function openWhatsApp() {
    if (!phone) return;
    window.open(waUrl({ to: phone, text: bitMessage }), "_blank", "noopener");
  }

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-50 bg-navy/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5"
    >
      <div className="member-card member-sheet-content w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-[0_30px_60px_-28px_rgba(11,29,58,0.38)]">
        <header className="flex items-start justify-between gap-4 border-b hairline pb-4">
          <div>
            <p className="member-eyebrow">{t("packages.paymentMethod")}</p>
            <h3 className="font-display text-3xl text-navy mt-1">{t("packages.paymentTitle")}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost h-9 w-9 p-0 hover:btn-ghost-hover"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="mt-5 rounded-xl border border-gold/25 bg-ivory/70 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-2xl leading-tight text-navy">{display.name}</p>
              <p className="mt-1 text-sm text-slate">{display.memberLine}</p>
            </div>
            <p className="numeric-display text-3xl text-navy">{price}</p>
          </div>
        </div>

        {!confirming ? (
          <div className="mt-5 space-y-3">
            <PaymentOption
              active={method === "cash"}
              icon={<Wallet className="h-4 w-4" />}
              label={t("packages.cashLabel")}
              description={t("packages.cashDescription")}
              onClick={() => setMethod("cash")}
            />
            <PaymentOption
              active={method === "bit"}
              icon={<MessageCircle className="h-4 w-4" />}
              label={t("packages.bitLabel")}
              description={t("packages.bitDescription")}
              onClick={() => setMethod("bit")}
            />
            <PaymentOption
              disabled
              icon={<CreditCard className="h-4 w-4" />}
              label={t("packages.cardSoonLabel")}
              description={t("packages.cardSoonDescription")}
            />
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-gold/25 bg-sand/20 p-4">
              <p className="text-xs font-medium text-slate">{t("packages.selectedMethod")}</p>
              <p className="mt-1 font-display text-2xl text-navy">
                {method ? labelForMethod(method) : "—"}
              </p>
              <p className="mt-2 text-sm text-slate">
                {method === "bit" ? t("packages.bitDescription") : t("packages.cashDescription")}
              </p>
            </div>
            {method === "bit" && (
              <div className="rounded-xl border border-gold/25 bg-ivory p-4">
                <p className="text-sm text-navy">
                  {phone ? (
                    <>
                      {t("packages.bitNumber", { phone: "" })}
                      <span dir="ltr" className="member-ltr-value inline-block">
                        {phone}
                      </span>
                    </>
                  ) : (
                    t("packages.bitNumberMissing")
                  )}
                </p>
                {phone && (
                  <button
                    type="button"
                    onClick={openWhatsApp}
                    className="btn-ghost mt-3 inline-flex items-center gap-2 px-0 text-xs hover:btn-ghost-hover"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {t("packages.whatsappConfirm")}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center gap-3 border-t hairline pt-4">
          <button type="button" onClick={onClose} className="btn-outline flex-1">
            {t("common.cancel")}
          </button>
          {!confirming ? (
            <button
              type="button"
              disabled={!method}
              onClick={() => setConfirming(true)}
              className="btn-navy flex-1 disabled:opacity-50"
            >
              {t("packages.continue")}
            </button>
          ) : (
            <button
              type="button"
              disabled={!method || pending}
              onClick={() => method && onSubmit(method)}
              className="btn-navy flex-1 disabled:opacity-50"
            >
              {pending ? t("common.saving") : t("packages.submitForConfirmation")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PaymentOption({
  active,
  disabled,
  icon,
  label,
  description,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-start transition ${
        active
          ? "border-gold bg-gold/10 shadow-[0_18px_36px_-30px_rgba(11,29,58,0.38)]"
          : disabled
            ? "border-sand bg-sand/20 opacity-60 cursor-not-allowed"
            : "border-gold/25 bg-ivory hover:border-gold/70 hover:bg-gold/5"
      }`}
    >
      <span className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-gold/30 text-navy">
          {icon}
        </span>
        <span>
          <span className="block font-display text-xl text-navy">{label}</span>
          <span className="mt-1 block text-sm leading-6 text-slate">{description}</span>
        </span>
      </span>
    </button>
  );
}

function formatPaymentAmount(amount: number | string, currency: string | null | undefined) {
  const value = Number(amount ?? 0);
  if ((currency ?? "ILS") === "ILS") return `₪${value.toFixed(0)}`;
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency ?? "ILS",
    maximumFractionDigits: 0,
  }).format(value);
}
