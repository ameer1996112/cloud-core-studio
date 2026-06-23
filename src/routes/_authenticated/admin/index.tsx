import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { adminOverview } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Home, Plus, Users, Wallet, Sparkles, BarChart3 } from "lucide-react";
import { t, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Studio Command Center — Cloud & Core" }] }),
  component: OverviewPage,
});

const ils = (n: number, locale: string) =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(n);

function OverviewPage() {
  const { locale } = useI18n();
  const fn = useServerFn(adminOverview);
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) {
        void navigate({ to: "/auth", replace: true });
        return null;
      }
      try {
        return await fn();
      } catch (e) {
        if (e instanceof Error && e.message.toLowerCase().includes("unauthorized")) {
          void navigate({ to: "/auth", replace: true });
          return null;
        }
        throw e;
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton-brand h-28" />
          ))}
        </div>
      </div>
    );
  }

  const d: any = data;

  return (
    <div className="space-y-12">
      <header className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] items-end gap-5 pb-6 border-b border-gold/30">
        <div className="min-w-0">
          <p className="eyebrow text-[10px]">{t("admin.overview.eyebrow")}</p>
          <h1 className="font-display italic text-3xl sm:text-4xl md:text-5xl mt-2 leading-[1.05]">
            {t("admin.overview.headline")}
          </h1>
          <p className="text-slate text-sm mt-3">
            {new Date().toLocaleDateString(locale, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}{" "}
            · {t("admin.overview.classesToday", { count: d.todayClasses.length })} ·{" "}
            {t("admin.overview.waitlistSummary", { count: d.waitingCount })}
          </p>
        </div>
        <QuickActions />
      </header>

      {/* KPI strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard label={t("admin.overview.clients")} value={d.memberCount} />
        <KpiCard label={t("admin.overview.activeBookings")} value={d.activeBookings} />
        <KpiCard
          label={t("admin.overview.waitlist")}
          value={d.waitingCount}
          tone={d.waitingCount > 0 ? "gold" : "default"}
        />
        <KpiCard
          label={t("admin.overview.monthRevenue")}
          value={ils(d.monthRevenueIls, locale)}
          compact
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel title={t("admin.overview.todayClasses")} className="lg:col-span-2">
          {d.todayClasses.length === 0 ? (
            <p className="text-sm text-slate font-display italic">
              {t("admin.overview.noClassesToday")}{" "}
              <Link to="/admin/calendar" className="underline">
                {t("admin.overview.openCalendar")}
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-gold/15">
              {d.todayClasses.map((c: any) => {
                const startsAt = new Date(c.starts_at);
                const left = c.capacity - c.booked_count;
                return (
                  <li key={c.id}>
                    <Link
                      to="/admin/classes/$id"
                      params={{ id: c.id }}
                      className="flex items-center gap-4 py-3 hover:bg-gold/5 px-1 rounded-[2px]"
                    >
                      <div className="w-16 text-center pr-3 border-r border-gold/20">
                        <p className="font-display text-xl leading-none">
                          {startsAt.toLocaleTimeString(locale, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-lg truncate">{c.title}</p>
                        <p className="text-[11px] uppercase tracking-[0.15em] text-slate mt-0.5">
                          {c.room} · {c.instructor?.name ?? t("common.unassigned")}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] uppercase tracking-[0.15em] text-slate">
                        {c.booked_count}/{c.capacity}
                        {left <= 0 ? ` · ${t("common.full")}` : ""}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title={t("admin.overview.attentionNow")} tone="sand">
          <div className="space-y-5 text-sm">
            <Pulse
              label={t("admin.overview.newClients")}
              value={d.firstTimerCount}
              hint={t("admin.overview.newClientsHint")}
            />
            <Pulse
              label={t("admin.overview.waitlistPressure")}
              value={d.waitingCount}
              hint={t("admin.overview.waitlistPressureHint")}
            />
            <Pulse label={t("admin.overview.activeRooms")} value={d.roomCount} />
            {d.membersLowCredit.length > 0 && (
              <div>
                <p className="eyebrow text-[10px] mb-2">{t("admin.overview.lowCredits")}</p>
                <ul className="space-y-1">
                  {d.membersLowCredit.map((m: any) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                      <Link
                        to="/admin/members/$id"
                        params={{ id: m.id }}
                        className="font-display truncate hover:underline"
                      >
                        {m.name}
                      </Link>
                      <span className="text-slate text-[11px]">
                        {t("admin.overview.creditsLeft", { count: m.remaining_credits })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title={t("admin.overview.upcomingWeek")}>
          {d.upcoming.length === 0 ? (
            <p className="text-sm text-slate font-display italic">
              {t("admin.overview.noUpcoming")}
            </p>
          ) : (
            <ul className="divide-y divide-gold/15">
              {d.upcoming.slice(0, 6).map((c: any) => {
                const startsAt = new Date(c.starts_at);
                return (
                  <li key={c.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display truncate">{c.title}</p>
                      <p className="text-[11px] uppercase tracking-[0.15em] text-slate mt-0.5">
                        {startsAt.toLocaleDateString(locale, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        ·{" "}
                        {startsAt.toLocaleTimeString(locale, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}{" "}
                        · {c.room}
                      </p>
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.15em] text-slate shrink-0">
                      {c.booked_count}/{c.capacity}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title={t("admin.overview.recentActivity")}>
          {d.recentLog.length === 0 ? (
            <p className="text-sm text-slate font-display italic">
              {t("admin.overview.noRecentActivity")}
            </p>
          ) : (
            <ul className="divide-y divide-gold/15">
              {d.recentLog.map((l: any) => (
                <li key={l.id} className="py-3">
                  <p className="text-sm">{l.action.replace(/\./g, " · ")}</p>
                  <p className="text-[11px] text-slate mt-0.5">
                    {new Date(l.created_at).toLocaleString(locale)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>
    </div>
  );
}

function QuickActions() {
  const items = [
    { to: "/admin/classes/new", icon: Plus, label: t("admin.overview.addClass") },
    { to: "/admin/calendar", icon: Calendar, label: t("admin.overview.calendar") },
    { to: "/admin/payments", icon: Wallet, label: t("admin.overview.recordPayment") },
    { to: "/admin/members", icon: Users, label: t("admin.overview.clients") },
    { to: "/admin/reports", icon: BarChart3, label: t("admin.overview.reports") },
  ] as const;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <Link
          key={i.to}
          to={i.to}
          className="inline-flex min-h-11 items-center gap-2 px-3 py-2 border border-gold/40 rounded-[2px] text-[12px] text-navy hover:bg-gold/10"
        >
          <i.icon className="h-3.5 w-3.5" /> {i.label}
        </Link>
      ))}
    </div>
  );
}

function KpiCard({
  label,
  value,
  compact = false,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  compact?: boolean;
  tone?: "default" | "gold";
}) {
  return (
    <div className={`editorial-card p-5 ${tone === "gold" ? "border-l-4 border-l-gold" : ""}`}>
      <p className="eyebrow text-[10px]">{label}</p>
      <p className={`numeric-display mt-3 ${compact ? "text-3xl" : "text-4xl"}`}>{value}</p>
    </div>
  );
}

function Panel({
  title,
  children,
  tone = "ivory",
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "ivory" | "sand";
  className?: string;
}) {
  return (
    <section
      className={`editorial-panel p-6 ${tone === "sand" ? "bg-[#E8DFD1]/30" : ""} ${className}`}
    >
      <header className="flex items-baseline justify-between mb-5 pb-2 border-b border-gold/25">
        <h3 className="font-display italic text-xl">{title}</h3>
        <Sparkles className="h-3.5 w-3.5 text-gold/70" />
      </header>
      {children}
    </section>
  );
}

function Pulse({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="eyebrow text-[10px]">{label}</p>
        {hint && <p className="text-[11px] text-slate mt-1">{hint}</p>}
      </div>
      <p className="numeric-display text-2xl">{value}</p>
    </div>
  );
}
