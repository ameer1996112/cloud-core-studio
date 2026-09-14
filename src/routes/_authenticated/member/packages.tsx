import { MemberPageIntro } from "@/components/member/MemberPage";
import packagesCss from "@/styles/packages.css?url";
import matDetail from "@/assets/mat-detail.webp";
import { MemberPageState } from "@/components/member/MemberPageState";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Sparkles,
  Check,
  ClipboardCheck,
  CreditCard,
  FileText,
  MessageCircle,
  RefreshCw,
  ArrowRight,
  Smartphone,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getMyPackages } from "@/lib/member.functions";
import { getPublicStudioSettings } from "@/lib/studioSettings.functions";
import { createManualPackagePayment, getMyPackageRequests } from "@/lib/memberRequests.functions";
import { createCheckoutSession } from "@/lib/receipts.functions";
import { cancelMySubscription } from "@/lib/subscriptions.functions";
import { LANG_META, labelForMethod, labelForStatus, t, useI18n, type Lang } from "@/lib/i18n";
import { MemberEmptyState } from "@/components/member/PremiumClassCard";
import { MemberFeedbackPanel } from "@/components/member/MemberFeedbackPanel";
import { formatPlanPrice, getPlanDisplay } from "@/lib/planDisplay";
import { hasTestPlanRecord } from "@/lib/test-records";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { LtrInline } from "@/components/ui/bidi";
import type { CheckoutConsent } from "@/lib/checkoutConsent";
import { trackYogaPromo } from "@/lib/yogaPromo";

const BIT_PAYMENT_PHONE = "0523318478";
type OnlinePaymentMethod = "bit" | "card";

function isOnlineCheckoutAttempt(payment: any) {
  return payment?.provider === "hyp";
}

function isManualPendingPayment(payment: any) {
  return payment?.status === "pending" && !isOnlineCheckoutAttempt(payment);
}

function isVisiblePaymentHistory(payment: any) {
  if (!isOnlineCheckoutAttempt(payment)) return true;
  return (
    payment?.status !== "pending" && payment?.status !== "cancelled" && payment?.status !== "failed"
  );
}

export const Route = createFileRoute("/_authenticated/member/packages")({
  head: () => ({ links: [{ rel: "stylesheet", href: packagesCss }] }),
  component: MemberPackages,
});

function MemberPackages() {
  const { lang, locale, dir } = useI18n();
  useDocumentTitle("page.packages.title");
  const fetchPackages = useServerFn(getMyPackages);
  const fetchSettings = useServerFn(getPublicStudioSettings);
  const fetchRequests = useServerFn(getMyPackageRequests);
  const createManualPayment = useServerFn(createManualPackagePayment);
  const createCheckout = useServerFn(createCheckoutSession);
  const cancelSubscription = useServerFn(cancelMySubscription);
  const qc = useQueryClient();
  const [category, setCategory] = useState<"all" | "subscriptions" | "cards">("all");
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [checkoutFeedback, setCheckoutFeedback] = useState<"error" | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
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

  const checkoutPayment = useMutation({
    mutationFn: (v: {
      planId: string;
      method: OnlinePaymentMethod;
      recurring?: boolean;
      checkout: CheckoutConsent;
    }) =>
      createCheckout({
        data: {
          plan_id: v.planId,
          payment_method: v.method,
          recurring: v.recurring === true,
          checkout: v.checkout,
        },
      }),
    onMutate: () => setCheckoutFeedback(null),
    onSuccess: (res: any) => {
      if (res?.status === "ready" && res.checkout_url) {
        window.location.href = res.checkout_url;
        return;
      }
      setCheckoutFeedback("error");
    },
    onError: () => setCheckoutFeedback("error"),
  });
  const cancelSubscriptionMutation = useMutation({
    mutationFn: () => cancelSubscription(),
    onSuccess: () => {
      toast.success(t("packages.subscriptionCancelSuccess"));
      qc.invalidateQueries({ queryKey: ["member-packages"] });
    },
    onError: () => toast.error(t("packages.subscriptionCancelError")),
  });

  const active = data?.mine.find((p: any) => p.status === "active");
  const activeSubscription = (data?.subscriptions ?? []).find((subscription: any) =>
    ["active", "past_due", "incomplete"].includes(subscription.status),
  );
  const credits = data?.member?.remaining_credits ?? 0;
  const hasUsableActivePackage = Boolean(active && credits > 0);
  const hasRunningSubscription = Boolean(activeSubscription);
  const memberName = data?.member?.name?.split(" ")[0] ?? "";
  const pendingPayments = (data?.payments ?? []).filter(isManualPendingPayment);
  const visiblePaymentHistory = (data?.payments ?? []).filter(isVisiblePaymentHistory);
  const visiblePlans = (data?.plans ?? [])
    .filter((p: any) => !hasTestPlanRecord(p))
    .sort(comparePricingPlans);
  const promoEntitlements = (data?.promotionEntitlements ?? []).filter(
    (entitlement: any) => entitlement.status === "active",
  );

  useEffect(() => {
    if (promoEntitlements.length > 0) trackYogaPromo("yoga_promo_credit_viewed");
  }, [promoEntitlements.length]);

  function submitPayment(
    plan: any,
    method: "cash" | "bit" | "card",
    recurring = false,
    checkout?: CheckoutConsent,
  ) {
    if (hasUsableActivePackage || hasRunningSubscription) {
      toast.error(t("packages.activePackageExists"));
      return;
    }
    if (method === "card" || method === "bit") {
      if (!checkout) return;
      checkoutPayment.mutate({ planId: plan.id, method, recurring, checkout });
      return;
    }
    const planDisplay = getPlanDisplay(plan, lang);
    const amount = formatPlanPrice(plan);
    const text = t("member.packageManualPaymentMessage", {
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

  const displayedPlans = visiblePlans.filter(
    (plan: any) =>
      category === "all" ||
      (category === "subscriptions" ? isRecurringCardPlan(plan) : !isRecurringCardPlan(plan)),
  );
  const categoryCounts = {
    all: visiblePlans.length,
    subscriptions: visiblePlans.filter(isRecurringCardPlan).length,
    cards: visiblePlans.filter((plan: any) => !isRecurringCardPlan(plan)).length,
  };

  if (isLoading)
    return (
      <section
        className="member-page member-package-page package-loading"
        aria-busy="true"
        aria-label={t("common.loading")}
      >
        <div className="package-loading-heading skeleton-brand" />
        <div className="package-pricing-grid">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="package-loading-card skeleton-brand" key={index} />
          ))}
        </div>
      </section>
    );
  if (isError)
    return <MemberPageState title={t("nav.plans")} error onRetry={() => void refetch()} />;

  return (
    <section dir={dir} className="member-page member-package-page">
      <div className="package-introduction">
        <MemberPageIntro
          title={reconstructionCopy[lang].title}
          body={reconstructionCopy[lang].subtitle}
        />
        <img className="package-studio-image" src={matDetail} width={600} height={299} alt="" />
      </div>
      <div className="package-category-tabs" aria-label={t("packages.available")}>
        {(["all", "subscriptions", "cards"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={category === value}
            onClick={() => setCategory(value)}
          >
            {reconstructionCopy[lang][value]}
            <span className="package-category-count" aria-hidden="true">
              {categoryCounts[value]}
            </span>
          </button>
        ))}
      </div>

      <div className="packages-release-layout">
        <div className="package-selection">
          <div className="member-section__heading">
            <div>
              <h2 className="member-section__title">{t("packages.available")}</h2>
            </div>
          </div>
          {isLoading && <div className="h-40 skeleton-brand rounded-[var(--cc-radius-card)]" />}
          {displayedPlans.length === 0 ? (
            <MemberEmptyState
              variant="packages"
              title={t("member.empty.packages.title")}
              body={t("member.empty.packages.body")}
            />
          ) : (
            <div className="package-pricing-grid">
              {displayedPlans.map((p: any) => (
                <PackagePricingCard
                  key={p.id}
                  plan={p}
                  lang={lang}
                  request={requestsByPlan[p.id]}
                  payment={pendingPayments.find((payment: any) => payment.plan?.id === p.id)}
                  onRequest={() => setSelectedPlan(p)}
                  pending={
                    manualPayment.isPending ||
                    checkoutPayment.isPending ||
                    hasUsableActivePackage ||
                    hasRunningSubscription
                  }
                  blockedByActivePackage={hasUsableActivePackage || hasRunningSubscription}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <details className="member-history-disclosure member-card package-current-status">
        <summary>{t("member.activePackage")}</summary>
        <div className="aura-wallet-summary">
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="aura-wallet-title">
              {isLoading ? (
                t("common.loading")
              ) : active?.plan ? (
                <bdi>{getPlanDisplay(active.plan, lang).name}</bdi>
              ) : (
                t("member.noActivePackage")
              )}
            </h2>
            {!isLoading && (
              <p className="aura-wallet-balance">
                {active?.plan && (active.plan.credits >= 999 || /unlim/i.test(active.plan.name)) ? (
                  t("packages.unlimited")
                ) : (
                  <>
                    <strong>
                      <bdi>{credits}</bdi>
                    </strong>
                    <span>{t("member.stat.credits")}</span>
                  </>
                )}
              </p>
            )}
            {active?.expires_at && (
              <p className="text-sm text-slate">
                {t("member.expires")}{" "}
                <bdi dir={lang === "en" ? "ltr" : "rtl"} className="text-navy">
                  {new Date(active.expires_at).toLocaleDateString(locale, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </bdi>
              </p>
            )}
          </div>
          {activeSubscription && (
            <div className="mt-4 rounded-xl border border-gold/25 bg-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-navy">
                    <RefreshCw className="h-4 w-4 text-[var(--color-accent-text)]" />
                    {activeSubscription.status === "past_due"
                      ? t("packages.subscriptionPastDue")
                      : t("packages.subscriptionActive")}
                  </p>
                  <p className="mt-1 text-sm text-slate">
                    {t("packages.subscriptionRenews", {
                      date: new Date(
                        activeSubscription.next_charge_at ??
                          activeSubscription.current_period_end ??
                          Date.now(),
                      ).toLocaleDateString(locale),
                    })}
                  </p>
                  {activeSubscription.card_mask && (
                    <p className="mt-1 text-xs font-medium text-slate">
                      {t("packages.subscriptionCard", { card: activeSubscription.card_mask })}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => cancelSubscriptionMutation.mutate()}
                  disabled={cancelSubscriptionMutation.isPending}
                  className="btn-outline shrink-0 disabled:opacity-50"
                >
                  {cancelSubscriptionMutation.isPending
                    ? t("common.saving")
                    : t("packages.subscriptionCancel")}
                </button>
              </div>
            </div>
          )}
        </div>

        {promoEntitlements.map((entitlement: any) => (
          <div
            key={entitlement.id}
            className="relative overflow-hidden rounded-[1.5rem] border border-gold/45 bg-card p-5 text-foreground shadow-sm sm:p-6"
            data-testid="yoga-promo-wallet-credit"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="member-eyebrow text-[var(--color-accent-text)]">Cloud &amp; Core</p>
                <h2 className="mt-2 font-display text-2xl text-foreground">
                  {t("promo.yoga.walletTitle")}
                </h2>
                <p className="mt-3 text-sm font-semibold text-foreground">
                  {t("promo.yoga.quantity")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{t("promo.yoga.restriction")}</p>
                {entitlement.expires_at ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("promo.yoga.validUntil", {
                      date: new Date(entitlement.expires_at).toLocaleDateString(locale),
                    })}
                  </p>
                ) : null}
              </div>
              <Sparkles
                className="h-6 w-6 shrink-0 text-[var(--color-accent-text)]"
                aria-hidden="true"
              />
            </div>
          </div>
        ))}

        {requests && requests.length > 0 && (
          <div className="space-y-2">
            <h2 className="member-eyebrow">{t("packages.recent")}</h2>
            <div className="member-card divide-y hairline">
              {requests.slice(0, 4).map((r: any) => (
                <div
                  key={r.id}
                  className="px-4 py-3 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="text-navy">
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

        {!isLoading && pendingPayments.length > 0 && (
          <p className="aura-pending-payments">
            {t("payments.pending")}: <bdi>{pendingPayments.length}</bdi>
          </p>
        )}
      </details>
      <p className="member-page-body mt-4">{pricingCopy[lang].subtitle}</p>
      {selectedPlan && (
        <PaymentMethodSheet
          plan={selectedPlan}
          lang={lang}
          settings={settings}
          pending={manualPayment.isPending || checkoutPayment.isPending}
          feedback={checkoutFeedback}
          onClose={() => setSelectedPlan(null)}
          onSubmit={(method, recurring, checkout) =>
            submitPayment(selectedPlan, method, recurring, checkout)
          }
        />
      )}

      <div className="aura-account-history account-history-refined">
        <section className="account-history-section">
          <div className="account-history-heading">
            <span className="account-history-icon" aria-hidden="true">
              <Wallet size={21} strokeWidth={1.5} />
            </span>
            <h2>{t("packages.creditHistory")}</h2>
          </div>
          {data?.ledger.length === 0 ? (
            <div className="account-history-empty">
              <h3>{t("packages.noCredit")}</h3>
              <p>{t("member.empty.creditHistory.body")}</p>
            </div>
          ) : (
            <div className="account-history-records">
              {data?.ledger.map((t: any) => (
                <div key={t.id} className="account-history-record">
                  <div className="min-w-0">
                    <p className="text-navy">{formatCreditReason(t.reason, t.amount_delta)}</p>
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
        </section>

        <section className="account-history-section">
          <div className="account-history-heading">
            <span className="account-history-icon" aria-hidden="true">
              <FileText size={21} strokeWidth={1.5} />
            </span>
            <h2>{t("packages.paymentHistory")}</h2>
          </div>
          {visiblePaymentHistory.length === 0 ? (
            <div className="account-history-empty">
              <h3>{t("packages.noPayments")}</h3>
              <p>{t("member.empty.payments.body")}</p>
            </div>
          ) : (
            <div className="account-history-records">
              {visiblePaymentHistory.map((p: any) => {
                const receipt = Array.isArray(p.receipt) ? p.receipt[0] : p.receipt;
                return (
                  <div key={p.id} className="account-history-record">
                    <div className="min-w-0">
                      <p className="text-navy">
                        {p.plan ? getPlanDisplay(p.plan, lang).name : t("receipt.studioPayment")}
                      </p>
                      <p className="mt-0.5 text-sm text-slate">
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
                          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-navy hover:text-[var(--color-accent-text)]"
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
        </section>
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
  blockedByActivePackage,
}: {
  plan: any;
  lang: Lang;
  request?: any;
  payment?: any;
  onRequest: () => void;
  pending: boolean;
  blockedByActivePackage: boolean;
}) {
  const display = getPlanDisplay(plan, lang);
  const marketing = getPackageMarketing(plan, lang);
  const isRecommended = marketing.kind === "recommended";
  const isRecurringMonthly = isRecurringCardPlan(plan);
  const creditsLine = getPackageCreditsLine(plan.credits, lang);
  const cardId = `package-plan-${String(plan.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <article
      id={cardId}
      data-package-plan-card="true"
      tabIndex={-1}
      aria-labelledby={`${cardId}-title`}
      className={`package-plan-card member-card ${isRecommended ? "is-recommended" : ""}`}
      data-plan-kind={marketing.kind}
    >
      <div className="package-plan-heading min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={`${cardId}-title`} className="font-display text-2xl leading-tight text-navy">
            {display.name.replace(/[—–]/g, "-")}
          </h3>
          {marketing.badge || marketing.secondaryBadge ? (
            <span className="package-plan-badge">
              {marketing.badge || marketing.secondaryBadge}
            </span>
          ) : null}
        </div>
        {marketing.subtitle ? (
          <p className="mt-1.5 text-sm text-slate">{marketing.subtitle}</p>
        ) : null}
      </div>
      <div className="package-plan-price">
        <p className="numeric-display font-display text-4xl text-navy">
          <bdi dir="ltr">{formatPlanPrice(plan)}</bdi>
        </p>
      </div>
      <div className="package-plan-details">
        <p>
          <Check className="h-4 w-4" />{" "}
          {plan.credits >= 999 || /unlim/i.test(plan.name) ? t("packages.unlimited") : creditsLine}
        </p>
        <p>
          <Check className="h-4 w-4" />
          {plan.duration_days
            ? t("packages.validDays", { days: plan.duration_days })
            : t("packages.noExpiry")}
        </p>
      </div>
      {marketing.savings || marketing.priceNote ? (
        <p className="package-plan-recommendation">{marketing.savings || marketing.priceNote}</p>
      ) : null}
      {isRecurringMonthly ? (
        <p className="package-recurring-disclosure">
          <RefreshCw className="h-3.5 w-3.5" />
          {t("packages.recurringDisclosure")}
        </p>
      ) : null}
      <div className="package-plan-action">
        {payment ? (
          <span className="package-plan-state" role="status">
            <Wallet className="h-3 w-3 text-gold" /> {t("packages.pendingPayment")}
          </span>
        ) : blockedByActivePackage ? (
          <span className="package-plan-state">
            <Wallet className="h-3 w-3 text-gold" /> {t("packages.activePackageBadge")}
          </span>
        ) : request && request.status !== "cancelled" ? (
          <span className="package-plan-state" role="status">
            <MessageCircle className="h-3 w-3 text-gold" />{" "}
            {request.status === "paid" ? t("packages.activated") : t("packages.requested")}
          </span>
        ) : (
          <button
            onClick={onRequest}
            aria-label={`${t("packages.choosePackage")}: ${display.name}`}
            disabled={pending}
            className="btn-navy min-h-11 w-full hover:btn-navy-hover disabled:opacity-50"
          >
            <ArrowRight className="h-4 w-4" /> {marketing.cta}
          </button>
        )}
      </div>
    </article>
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

const reconstructionCopy = {
  he: {
    title: "חבילות מנוי",
    subtitle: "בחירת החבילה שמתאימה לך",
    all: "כל החבילות",
    subscriptions: "מנויים",
    cards: "כרטיסיות",
  },
  en: {
    title: "Membership packages",
    subtitle: "Choose the package that suits you",
    all: "All packages",
    subscriptions: "Memberships",
    cards: "Class packs",
  },
  ar: {
    title: "باقات الاشتراك",
    subtitle: "اختاري الباقة المناسبة لك",
    all: "كل الباقات",
    subscriptions: "اشتراكات",
    cards: "بطاقات حصص",
  },
};

const pricingCopy: Record<
  Lang,
  { subtitle: string; valueStripLabel: string; valueChips: string[] }
> = {
  he: {
    subtitle: "בחרי את החבילה שמתאימה לקצב שלך, לשיעור ניסיון, התמדה חודשית או גמישות מלאה.",
    valueStripLabel: "השוואת ערך בין החבילות",
    valueChips: ["₪80 לשיעור בודד", "₪35 לשיעור במנוי המומלץ", "חיסכון של ₪450"],
  },
  en: {
    subtitle:
      "Choose the package that fits your rhythm, a trial class, monthly consistency, or full flexibility.",
    valueStripLabel: "Package value comparison",
    valueChips: ["₪80 for a drop-in", "₪35 per class on the recommended plan", "Save ₪450"],
  },
  ar: {
    subtitle: "اختاري الباقة المناسبة لإيقاعك, تجربة واحدة، التزام شهري، أو مرونة كاملة.",
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

function isRecurringCardPlan(plan: PricingPlanLike) {
  const kind = packageKind(plan);
  return kind === "monthly5" || kind === "recommended";
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
  feedback,
  onClose,
  onSubmit,
}: {
  plan: any;
  lang: Lang;
  settings: any;
  pending: boolean;
  feedback: "error" | null;
  onClose: () => void;
  onSubmit: (
    method: "cash" | "bit" | "card",
    recurring?: boolean,
    checkout?: CheckoutConsent,
  ) => void;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  const [method, setMethod] = useState<"cash" | "bit" | "card" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutConsent>({
    termsAccepted: false,
  });
  const dir = LANG_META[lang].dir;
  const display = getPlanDisplay(plan, lang);
  const price = formatPlanPrice(plan);
  const recurringCard = isRecurringCardPlan(plan);
  const bitCopy = getBitPaymentCopy(lang);
  const cardEnabled = Boolean(settings?.payments_enabled && settings?.payments_provider === "hyp");
  const hypEnabled = cardEnabled;
  const bitMessage = t("member.packageBitConfirmationMessage", {
    studio: settings?.studio_name ?? "Cloud & Core",
    member: t("member.friend"),
    plan: display.name,
    amount: price,
  });
  const isOnline = method === "card" || method === "bit";
  const checkoutComplete = checkout.termsAccepted;
  const checkoutCopy =
    lang === "he"
      ? {
          consent: "קראתי ואני מאשר/ת את",
          terms: "התקנון ותנאי הרכישה",
        }
      : lang === "ar"
        ? {
            consent: "قرأت وأوافق على",
            terms: "الشروط وأحكام الشراء",
          }
        : {
            consent: "I have read and agree to the",
            terms: "terms and purchase conditions",
          };

  async function copyBitPhone() {
    try {
      await navigator.clipboard.writeText(BIT_PAYMENT_PHONE);
      toast.success(bitCopy.copied);
    } catch {
      toast.error(bitCopy.copyError);
    }
  }

  function openBitApp() {
    void navigator.clipboard?.writeText(BIT_PAYMENT_PHONE).catch(() => undefined);
    const bitUrl = buildBitDeepLink({
      phone: BIT_PAYMENT_PHONE,
      amount: price,
      note: bitMessage,
    });
    window.location.href = bitUrl;
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        dir={dir}
        showCloseButton={false}
        aria-describedby={undefined}
        onOpenAutoFocus={() => {
          returnFocus.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus.current?.focus();
        }}
        onInteractOutside={(event) => event.preventDefault()}
        className="member-card member-sheet-content block w-full sm:max-w-xl max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 top-auto bottom-0 translate-y-0 sm:top-[50%] sm:bottom-auto sm:translate-y-[-50%]"
      >
        <header className="flex items-start justify-between gap-4 border-b hairline pb-4">
          <div>
            <p className="member-eyebrow">{t("packages.paymentMethod")}</p>
            <DialogTitle asChild>
              <h3 className="font-display text-3xl text-navy mt-1">{t("packages.paymentTitle")}</h3>
            </DialogTitle>
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

        <div className="mt-5 rounded-xl border border-gold/25 bg-ivory/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          <p className="member-eyebrow text-slate">{t("packages.purchaseSummary")}</p>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-display text-2xl leading-tight text-navy" dir="auto">
                {display.name}
              </p>
              <p className="mt-1 text-sm text-slate">{display.memberLine}</p>
              {recurringCard && (
                <p className="package-recurring-disclosure mt-2">
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t("packages.recurringDisclosure")}
                </p>
              )}
            </div>
            <div className="shrink-0 text-end">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">
                {t("packages.total")}
              </p>
              <p className="numeric-display mt-1 text-3xl text-navy">
                <LtrInline>{price}</LtrInline>
              </p>
            </div>
          </div>
        </div>

        {feedback === "error" && (
          <MemberFeedbackPanel
            variant="error"
            title={t("packages.cardPaymentError")}
            live="assertive"
            className="mt-4"
          >
            <p>{t("packages.cardPaymentRetry")}</p>
            {isOnline && method && checkoutComplete ? (
              <button
                type="button"
                className="btn-outline mt-3"
                disabled={pending}
                onClick={() => onSubmit(method, method === "card" && recurringCard, checkout)}
              >
                {t("common.retry")}
              </button>
            ) : null}
          </MemberFeedbackPanel>
        )}

        {!confirming ? (
          <div className="mt-5 space-y-3">
            <PaymentOption
              active={method === "cash"}
              icon={<Wallet className="h-4 w-4" />}
              label={t("packages.cashLabel")}
              description={
                recurringCard
                  ? t("packages.cashOneMonthDescription")
                  : t("packages.cashDescription")
              }
              onClick={() => setMethod("cash")}
            />
            {!hypEnabled && !recurringCard && (
              <PaymentOption
                active={method === "bit"}
                icon={<Smartphone className="h-4 w-4" />}
                label={t("packages.bitLabel")}
                description={bitCopy.optionDescription}
                onClick={() => setMethod("bit")}
              />
            )}
            <PaymentOption
              active={method === "card"}
              disabled={!cardEnabled}
              icon={<CreditCard className="h-4 w-4" />}
              label={
                cardEnabled
                  ? recurringCard
                    ? t("packages.cardRecurringLabel")
                    : t("packages.hypPaymentLabel")
                  : t("packages.cardSoonLabel")
              }
              description={
                cardEnabled
                  ? recurringCard
                    ? t("packages.cardRecurringDescription")
                    : t("packages.hypPaymentDescription")
                  : t("packages.cardSoonDescription")
              }
              onClick={() => setMethod("card")}
            />
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-gold/25 bg-sand/20 p-4">
              <p className="text-xs font-medium text-slate">{t("packages.selectedMethod")}</p>
              <p className="mt-1 font-display text-2xl text-navy">
                {method === "card" && !recurringCard
                  ? t("packages.hypPaymentLabel")
                  : method
                    ? labelForMethod(method)
                    : "—"}
              </p>
              <p className="mt-2 text-sm text-slate">
                {method === "bit"
                  ? bitCopy.confirmDescription
                  : method === "card"
                    ? recurringCard
                      ? t("packages.cardRecurringConfirmDescription")
                      : t("packages.cardConfirmDescription")
                    : recurringCard
                      ? t("packages.cashOneMonthDescription")
                      : t("packages.cashDescription")}
              </p>
            </div>
            {isOnline && (
              <div className="rounded-xl border border-gold/25 bg-ivory/70 p-4">
                <label className="flex items-start gap-2 text-sm leading-6 text-slate">
                  <input
                    required
                    type="checkbox"
                    checked={checkout.termsAccepted}
                    onChange={(event) =>
                      setCheckout((current) => ({
                        ...current,
                        termsAccepted: event.target.checked,
                      }))
                    }
                    className="mt-1 h-4 w-4 accent-navy"
                  />
                  <span>
                    {checkoutCopy.consent}{" "}
                    <Link
                      to="/terms"
                      target="_blank"
                      className="font-semibold text-navy underline underline-offset-2"
                    >
                      {checkoutCopy.terms}
                    </Link>
                  </span>
                </label>
              </div>
            )}
            {method === "bit" && !hypEnabled && (
              <div className="overflow-hidden rounded-xl border border-gold/35 bg-ivory shadow-[0_18px_44px_-34px_rgba(11,29,58,0.45)]">
                <div className="flex items-start gap-3 border-b border-gold/20 bg-card p-4">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-navy">
                    <Smartphone className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block font-display text-xl leading-tight text-navy">
                      {bitCopy.openTitle}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-slate">
                      {bitCopy.openBody}
                    </span>
                  </span>
                </div>
                <div className="grid gap-3 p-4">
                  <div className="rounded-lg border border-gold/20 bg-sand/15 p-3">
                    <p className="text-xs font-medium text-slate">{bitCopy.phoneLabel}</p>
                    <p dir="ltr" className="member-ltr-value mt-1 text-2xl font-bold text-navy">
                      {BIT_PAYMENT_PHONE}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openBitApp}
                    className="btn-navy w-full hover:btn-navy-hover"
                  >
                    <Smartphone className="h-4 w-4" />
                    {bitCopy.openButton}
                  </button>
                  <button type="button" onClick={copyBitPhone} className="btn-outline w-full">
                    <ClipboardCheck className="h-4 w-4" />
                    {bitCopy.copyButton}
                  </button>
                </div>
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
              disabled={!method || ((method === "card" || method === "bit") && pending)}
              onClick={() => {
                if (!method) return;
                if (method === "card" || method === "bit") {
                  setConfirming(true);
                  return;
                }
                setConfirming(true);
              }}
              className="btn-navy flex-1 disabled:opacity-50"
            >
              {pending && (method === "card" || method === "bit")
                ? t("common.saving")
                : method === "card" || method === "bit"
                  ? t("packages.continueToCardPayment")
                  : t("packages.continue")}
            </button>
          ) : (
            <button
              type="button"
              disabled={!method || pending || (isOnline && !checkoutComplete)}
              onClick={() =>
                method &&
                onSubmit(
                  method,
                  method === "card" && recurringCard,
                  isOnline ? checkout : undefined,
                )
              }
              className="btn-navy flex-1 disabled:opacity-50"
            >
              {pending
                ? t("packages.openingSecurePayment")
                : method === "card" || method === "bit"
                  ? recurringCard
                    ? t("packages.startRecurringSecurePayment")
                    : t("packages.continueToCardPayment")
                  : t("packages.submitForConfirmation")}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
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

function buildBitDeepLink({
  phone,
  amount,
  note,
}: {
  phone: string;
  amount: string;
  note: string;
}) {
  const numericAmount = amount.replace(/[^\d.]/g, "");
  const params = new URLSearchParams({
    phone,
    amount: numericAmount,
    note,
  });
  return `bit://pay?${params.toString()}`;
}

function getBitPaymentCopy(lang: Lang) {
  if (lang === "he") {
    return {
      optionDescription: "פתחי את ביט, שלמי למספר הסטודיו, ואז שלחי לאישור.",
      confirmDescription: "נפתח את ביט עם מספר הסטודיו. לאחר התשלום שלחי את הבקשה לאישור.",
      openTitle: "תשלום בביט",
      openBody: "מספר היעד מוצג כאן כדי לוודא שהתשלום נשלח למקום הנכון.",
      phoneLabel: "מספר ביט לתשלום",
      openButton: "פתיחת ביט לתשלום",
      copyButton: "העתקת המספר",
      copied: "מספר הביט הועתק",
      copyError: "לא הצלחנו להעתיק את המספר",
    };
  }
  if (lang === "ar") {
    return {
      optionDescription: "افتحي Bit، ادفعي لرقم الاستوديو، ثم أرسلي الطلب للتأكيد.",
      confirmDescription: "سنفتح Bit مع رقم الاستوديو. بعد الدفع أرسلي الطلب للتأكيد.",
      openTitle: "الدفع عبر Bit",
      openBody: "رقم الدفع ظاهر هنا للتأكد من أن الدفعة تصل للمكان الصحيح.",
      phoneLabel: "رقم Bit للدفع",
      openButton: "فتح Bit للدفع",
      copyButton: "نسخ الرقم",
      copied: "تم نسخ رقم Bit",
      copyError: "تعذر نسخ الرقم",
    };
  }
  return {
    optionDescription: "Open Bit, pay the studio number, then submit for approval.",
    confirmDescription:
      "We will open Bit with the studio number. After paying, submit for approval.",
    openTitle: "Bit payment",
    openBody: "The recipient number is shown here so the payment goes to the right place.",
    phoneLabel: "Bit payment number",
    openButton: "Open Bit to pay",
    copyButton: "Copy number",
    copied: "Bit number copied",
    copyError: "Could not copy the number",
  };
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
