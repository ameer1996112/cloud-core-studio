import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { adminOverview } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Home, Plus, Users, Wallet, Sparkles, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Studio Command Center — Cloud & Core" }] }),
  component: OverviewPage,
});

const ils = (n: number) =>
  new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(n);

function OverviewPage() {
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
      {/* Eyebrow */}
      <header className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-gold/30">
        <div>
          <p className="eyebrow text-[10px]">Studio command centre</p>
          <h1 className="font-display italic text-4xl md:text-5xl mt-2">
            A calm day at Cloud &amp; Core
          </h1>
          <p className="text-slate text-sm mt-3">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}{" "}
            · {d.todayClasses.length} class{d.todayClasses.length === 1 ? "" : "es"} on deck.
          </p>
        </div>
        <QuickActions />
      </header>

      {/* KPI strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard label="Members" value={d.memberCount} />
        <KpiCard label="Active bookings" value={d.activeBookings} />
        <KpiCard
          label="Waitlist"
          value={d.waitingCount}
          tone={d.waitingCount > 0 ? "gold" : "default"}
        />
        <KpiCard label="Revenue this month" value={ils(d.monthRevenueIls)} compact />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel title="Today's classes" className="lg:col-span-2">
          {d.todayClasses.length === 0 ? (
            <p className="text-sm text-slate font-display italic">
              No classes scheduled today.{" "}
              <Link to="/admin/calendar" className="underline">
                Open calendar
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-gold/15">
              {d.todayClasses.map((c: any) => {
                const t = new Date(c.starts_at);
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
                          {t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-lg truncate">{c.title}</p>
                        <p className="text-[11px] uppercase tracking-[0.15em] text-slate mt-0.5">
                          {c.room} · {c.instructor?.name ?? "Unassigned"}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] uppercase tracking-[0.15em] text-slate">
                        {c.booked_count}/{c.capacity}
                        {left <= 0 ? " · full" : ""}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Needs attention" tone="sand">
          <div className="space-y-5 text-sm">
            <Pulse
              label="First-time members"
              value={d.firstTimerCount}
              hint="Greet warmly at the door"
            />
            <Pulse
              label="Waitlist pressure"
              value={d.waitingCount}
              hint="Promote when space frees"
            />
            <Pulse label="Active rooms" value={d.roomCount} />
            {d.membersLowCredit.length > 0 && (
              <div>
                <p className="eyebrow text-[10px] mb-2">Low credits</p>
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
                      <span className="text-slate text-[11px]">{m.remaining_credits} left</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Upcoming this week">
          {d.upcoming.length === 0 ? (
            <p className="text-sm text-slate font-display italic">
              The studio is quiet. Use Calendar to plan ahead.
            </p>
          ) : (
            <ul className="divide-y divide-gold/15">
              {d.upcoming.slice(0, 6).map((c: any) => {
                const t = new Date(c.starts_at);
                return (
                  <li key={c.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display truncate">{c.title}</p>
                      <p className="text-[11px] uppercase tracking-[0.15em] text-slate mt-0.5">
                        {t.toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        · {t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}{" "}
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

        <Panel title="Recent activity">
          {d.recentLog.length === 0 ? (
            <p className="text-sm text-slate font-display italic">No recent admin actions yet.</p>
          ) : (
            <ul className="divide-y divide-gold/15">
              {d.recentLog.map((l: any) => (
                <li key={l.id} className="py-3">
                  <p className="text-sm">{l.action.replace(/\./g, " · ")}</p>
                  <p className="text-[11px] text-slate mt-0.5">
                    {new Date(l.created_at).toLocaleString()}
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
    { to: "/admin/reports", icon: BarChart3, label: "Reports" },
    { to: "/admin/classes/new", icon: Plus, label: "Add class" },
    { to: "/admin/members", icon: Users, label: "Members" },
    { to: "/admin/payments", icon: Wallet, label: "Record payment" },
    { to: "/admin/calendar", icon: Calendar, label: "Calendar" },
  ] as const;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <Link
          key={i.to}
          to={i.to}
          className="inline-flex items-center gap-2 px-3 py-2 border border-gold/40 rounded-[2px] text-[11px] uppercase tracking-[0.16em] text-navy hover:bg-gold/10"
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
