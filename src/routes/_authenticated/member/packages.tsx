import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Check, MessageCircle, Send, FileText } from "lucide-react";
import { toast } from "sonner";
import { getMyPackages } from "@/lib/member.functions";
import { getPublicStudioSettings } from "@/lib/studioSettings.functions";
import { createMyPackageRequest, getMyPackageRequests } from "@/lib/memberRequests.functions";
import { waUrl } from "@/lib/messageTemplate";
import { labelForMethod, labelForStatus, t, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/member/packages")({
  head: () => ({ meta: [{ title: "חבילות — Cloud & Core" }] }),
  component: MemberPackages,
});

function MemberPackages() {
  useI18n();
  const fetchPackages = useServerFn(getMyPackages);
  const fetchSettings = useServerFn(getPublicStudioSettings);
  const fetchRequests = useServerFn(getMyPackageRequests);
  const createRequest = useServerFn(createMyPackageRequest);
  const qc = useQueryClient();

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

  const request = useMutation({
    mutationFn: (v: { planId: string; messageText: string }) => createRequest({ data: v }),
    onSuccess: () => {
      toast.success(t("packages.requestSent"));
      qc.invalidateQueries({ queryKey: ["my-package-requests"] });
    },
    onError: () => toast.error(t("packages.requestError")),
  });

  const active = data?.mine.find((p: any) => p.status === "active");
  const credits = data?.member?.remaining_credits ?? 0;
  const memberName = data?.member?.name?.split(" ")[0] ?? "";

  function handleRequest(plan: any) {
    const text = `Hi ${settings?.studio_name ?? "the studio"} 👋\nThis is ${memberName || "a member"}. I'd like to purchase the ${plan.name} package${plan.price_cents ? ` (${(plan.price_cents / 100).toFixed(0)} ${plan.currency})` : ""}.\nMy current credits: ${credits}.`;
    request.mutate({ planId: plan.id, messageText: text });
    const url = waUrl({ to: settings?.whatsapp_number ?? settings?.public_phone, text });
    window.open(url, "_blank", "noopener");
  }

  const requestsByPlan: Record<string, any> = {};
  for (const r of requests ?? []) if (r.plan_id) requestsByPlan[r.plan_id] = r;

  return (
    <section className="space-y-8 max-w-3xl mx-auto pb-10">
      <div className="member-card member-panel-powder p-7 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 items-end">
        <div>
          <p className="member-eyebrow">{t("member.activePackage")}</p>
          <p className="font-display italic text-3xl text-navy mt-2 leading-tight">
            {active?.plan?.name ?? t("member.noActivePackage")}
          </p>
          {active?.expires_at && (
            <p className="text-sm text-slate mt-2">
              Valid until{" "}
              {new Date(active.expires_at).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="numeric-display text-5xl font-display text-navy">{credits}</p>
          <p className="member-eyebrow mt-1">{t("member.creditsRemaining")}</p>
        </div>
      </div>

      {requests && requests.length > 0 && (
        <div className="space-y-2">
          <h2 className="member-eyebrow">{t("packages.recent")}</h2>
          <div className="member-card divide-y hairline">
            {requests.slice(0, 4).map((r: any) => (
              <div key={r.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="text-navy">{r.plan?.name ?? t("nav.plans")}</p>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate mt-0.5">
                    {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`text-[10px] uppercase tracking-[0.22em] px-2 py-1 rounded-[2px] ${
                    r.status === "paid"
                      ? "bg-navy text-ivory"
                      : r.status === "contacted"
                        ? "bg-powder text-navy"
                        : r.status === "cancelled"
                          ? "bg-sand text-slate"
                          : "bg-gold/20 text-navy"
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
        <h2 className="font-display italic text-2xl text-navy">{t("packages.available")}</h2>
        {isLoading && <div className="h-40 skeleton-brand rounded-[8px]" />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(data?.plans ?? [])
            .filter((p: any) => !/^E2E\b|\bE2E\b/i.test(p.name ?? ""))
            .map((p: any) => (
              <PackagePricingCard
                key={p.id}
                plan={p}
                request={requestsByPlan[p.id]}
                onRequest={() => handleRequest(p)}
                pending={request.isPending}
              />
            ))}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-display italic text-2xl text-navy">{t("packages.creditHistory")}</h2>
        <div className="member-card divide-y hairline">
          {data?.ledger.length === 0 && (
            <p className="p-5 text-sm italic text-slate">{t("packages.noCredit")}</p>
          )}
          {data?.ledger.map((t: any) => (
            <div key={t.id} className="px-4 py-3 flex items-center justify-between text-sm">
              <div className="min-w-0">
                <p className="text-navy truncate">{t.reason}</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate mt-0.5">
                  {new Date(t.created_at).toLocaleDateString()}
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
      </div>

      <div className="space-y-3">
        <h2 className="font-display italic text-2xl text-navy">{t("packages.paymentHistory")}</h2>
        <div className="member-card divide-y hairline">
          {data?.payments.length === 0 && (
            <p className="p-5 text-sm italic text-slate">{t("packages.noPayments")}</p>
          )}
          {data?.payments.map((p: any) => {
            const receipt = Array.isArray(p.receipt) ? p.receipt[0] : p.receipt;
            return (
              <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-navy truncate">{p.plan?.name ?? t("receipt.studioPayment")}</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate mt-0.5 truncate">
                    {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"} ·{" "}
                    {labelForMethod(p.method)} · {labelForStatus(p.status)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display text-xl text-navy">
                    {Number(p.amount).toFixed(0)}{" "}
                    <span className="text-xs text-slate uppercase">{p.currency}</span>
                  </p>
                  {receipt && (
                    <Link
                      to="/receipts/$id"
                      params={{ id: receipt.id }}
                      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-navy hover:text-gold mt-1"
                    >
                      <FileText className="h-3 w-3" /> {receipt.receipt_number}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PackagePricingCard({
  plan,
  request,
  onRequest,
  pending,
}: {
  plan: any;
  request?: any;
  onRequest: () => void;
  pending: boolean;
}) {
  const isUnlimited = plan.credits >= 999 || /unlim/i.test(plan.name);
  return (
    <div className="member-card p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-2xl text-navy leading-tight">{plan.name}</p>
          {plan.description && <p className="text-sm text-slate mt-1.5">{plan.description}</p>}
        </div>
        <Sparkles className="h-5 w-5 text-gold shrink-0" />
      </div>
      <div className="space-y-2 text-sm">
        <p className="flex items-center gap-2 text-navy">
          <Check className="h-3.5 w-3.5 text-gold" />{" "}
          {isUnlimited
            ? t("packages.unlimited")
            : t("packages.classCredits", { count: plan.credits })}
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
        <div>
          <p className="numeric-display font-display text-3xl text-navy">
            {(plan.price_cents / 100).toFixed(0)}
          </p>
          <p className="text-[10px] uppercase tracking-[0.22em] text-slate">{plan.currency}</p>
        </div>
        {request && request.status !== "cancelled" ? (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.22em] text-navy border border-gold/40 px-3 py-2 rounded-[2px]">
            <MessageCircle className="h-3 w-3 text-gold" />{" "}
            {request.status === "paid" ? t("packages.activated") : t("packages.requested")}
          </span>
        ) : (
          <button
            onClick={onRequest}
            disabled={pending}
            className="btn-navy hover:btn-navy-hover disabled:opacity-50"
          >
            <Send className="h-3 w-3" /> {t("packages.request")}
          </button>
        )}
      </div>
    </div>
  );
}
