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
      toast.success(t("packages.manualPaymentSaved"));
      setSelectedPlan(null);
      qc.invalidateQueries({ queryKey: ["member-packages"] });
    },
    onError: () => toast.error(t("packages.manualPaymentError")),
  });

  const active = data?.mine.find((p: any) => p.status === "active");
  const credits = data?.member?.remaining_credits ?? 0;
  const memberName = data?.member?.name?.split(" ")[0] ?? "";
  const pendingPayments = (data?.payments ?? []).filter((p: any) => p.status === "pending");
  const visiblePlans = (data?.plans ?? []).filter((p: any) => !hasTestPlanRecord(p));

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
          <h2 className="member-section-title">{t("packages.available")}</h2>
        </div>
        {isLoading && <div className="h-40 skeleton-brand rounded-[var(--cc-radius-card)]" />}
        {visiblePlans.length === 0 && !isLoading ? (
          <MemberEmptyState
            variant="packages"
            title={t("member.empty.packages.title")}
            body={t("member.empty.packages.body")}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
  const creditsLine = getPackageCreditsLine(plan.credits, lang);
  return (
    <div className="member-card p-6 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-2xl text-navy leading-tight">{display.name}</p>
          {display.description && (
            <p className="text-sm text-slate mt-1.5">{display.description}</p>
          )}
        </div>
        <Sparkles className="h-5 w-5 text-gold shrink-0" />
      </div>
      <div>
        <p className="numeric-display font-display text-4xl text-navy">{price}</p>
        <p className="mt-2 text-sm font-semibold text-navy">{display.memberLine}</p>
      </div>
      <div className="space-y-2 text-sm">
        <p className="flex items-center gap-2 text-navy">
          <Check className="h-3.5 w-3.5 text-gold" />{" "}
          {isUnlimited ? t("packages.unlimited") : creditsLine}
        </p>
        <p className="flex items-center gap-2 text-navy">
          <Check className="h-3.5 w-3.5 text-gold" />{" "}
          {plan.duration_days
            ? t("packages.validDays", { days: plan.duration_days })
            : t("packages.noExpiry")}
        </p>
        <p className="flex items-center gap-2 text-navy">
          <Check className="h-3.5 w-3.5 text-gold" /> {t("packages.allPrograms")}
        </p>
      </div>
      <div className="flex items-end justify-between pt-3 border-t hairline">
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
            className="btn-navy hover:btn-navy-hover disabled:opacity-50"
          >
            <Send className="h-3 w-3" /> {t("packages.choosePackage")}
          </button>
        )}
      </div>
    </div>
  );
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
