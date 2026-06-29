import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { adminOverview } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Plus, Users, Wallet, Sparkles, BarChart3 } from "lucide-react";
import { t, useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  localizedClassTitle,
  localizedInstructorName,
  localizedRoomName,
} from "@/lib/localized-content";
import { AdminPageShell, AdminPageHeader, AdminMetricCard } from "@/components/admin-shared";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: OverviewPage,
});

const ils = (n: number, locale: string) =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(n);

function OverviewPage() {
  const { locale, lang } = useI18n();
  useDocumentTitle("page.overview.title");
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
      <AdminPageShell>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton-brand h-28 rounded-[var(--cc-radius-card)]" />
          ))}
        </div>
      </AdminPageShell>
    );
  }

  const d: any = data;

  return (
    <AdminPageShell>
      <AdminPageHeader
        eyebrow={t("admin.overview.eyebrow")}
        title={t("admin.overview.headline")}
        description={
          <>
            {new Date().toLocaleDateString(locale, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}{" "}
            · {t("admin.overview.classesToday", { count: d.todayClasses.length })} ·{" "}
            {t("admin.overview.waitlistSummary", { count: d.waitingCount })}
          </>
        }
        action={<QuickActions />}
      />

      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <AdminMetricCard label={t("admin.overview.clients")} value={d.memberCount} />
        <AdminMetricCard label={t("admin.overview.activeBookings")} value={d.activeBookings} />
        <AdminMetricCard
          label={t("admin.overview.waitlist")}
          value={d.waitingCount}
          accent={d.waitingCount > 0}
        />
        <AdminMetricCard
          label={t("admin.overview.monthRevenue")}
          value={ils(d.monthRevenueIls, locale)}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel title={t("admin.overview.todayClasses")} className="lg:col-span-2">
          {d.todayClasses.length === 0 ? (
            <p className="text-sm text-slate font-display">
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
                      className="flex items-center gap-4 rounded-xl px-2 py-3 transition-colors hover:bg-gold/5"
                    >
                      <div className="w-16 text-center pe-3 border-e border-gold/20">
                        <p className="font-display text-xl leading-none">
                          {startsAt.toLocaleTimeString(locale, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-lg truncate" dir="auto">
                          <bdi>{localizedClassTitle(c, lang)}</bdi>
                        </p>
                        <p className="mt-0.5 text-xs font-medium text-slate">
                          {localizedRoomName(c.room_ref?.name ?? c.room, lang)} ·{" "}
                          {c.instructor?.name
                            ? localizedInstructorName(c.instructor.name, lang)
                            : t("common.unassigned")}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-slate">
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
                <p className="eyebrow mb-2">{t("admin.overview.lowCredits")}</p>
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
                      <span className="text-xs text-slate">
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
            <p className="text-sm text-slate font-display">{t("admin.overview.noUpcoming")}</p>
          ) : (
            <ul className="divide-y divide-gold/15">
              {d.upcoming.slice(0, 6).map((c: any) => {
                const startsAt = new Date(c.starts_at);
                return (
                  <li key={c.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display truncate" dir="auto">
                        <bdi>{localizedClassTitle(c, lang)}</bdi>
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-slate">
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
                        · {localizedRoomName(c.room_ref?.name ?? c.room, lang)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-slate">
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
            <p className="text-sm text-slate font-display">
              {t("admin.overview.noRecentActivity")}
            </p>
          ) : (
            <ul className="divide-y divide-gold/15">
              {d.recentLog.map((l: any) => (
                <li key={l.id} className="py-3">
                  <p className="text-sm">{localizeActivityAction(l.action, lang)}</p>
                  <p className="mt-0.5 text-xs text-slate">
                    {new Date(l.created_at).toLocaleString(locale)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>
    </AdminPageShell>
  );
}

/** Localize dot-notated activity log actions to human-readable strings */
function localizeActivityAction(action: string, lang: "en" | "he" | "ar"): string {
  const ACTION_MAP: Record<string, Record<string, string>> = {
    "booking.created": { he: "הזמנה נוצרה", ar: "تم إنشاء حجز", en: "Booking created" },
    "booking.cancelled": { he: "הזמנה בוטלה", ar: "تم إلغاء الحجز", en: "Booking cancelled" },
    "payment.confirmed": { he: "תשלום אושר", ar: "تم تأكيد الدفع", en: "Payment confirmed" },
    "payment.created": { he: "תשלום נרשם", ar: "تم تسجيل الدفع", en: "Payment recorded" },
    "payment.refunded": { he: "זיכוי בוצע", ar: "تم رد المبلغ", en: "Payment refunded" },
    "member.created": { he: "לקוח/ה חדש/ה", ar: "عميل/ة جديد/ة", en: "New client" },
    "class.created": { he: "שיעור נוצר", ar: "تم إنشاء حصة", en: "Class created" },
    "class.updated": { he: "שיעור עודכן", ar: "تم تحديث الحصة", en: "Class updated" },
    "class.cancelled": { he: "שיעור בוטל", ar: "تم إلغاء الحصة", en: "Class cancelled" },
    "attendance.checked_in": {
      he: "צ׳ק-אין בוצע",
      ar: "تم تسجيل الحضور",
      en: "Checked in",
    },
  };

  const key = action.toLowerCase().trim();
  const mapping = ACTION_MAP[key];
  if (mapping && mapping[lang]) return mapping[lang];
  // Fallback: humanize dot notation
  return action.replace(/\./g, " · ");
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
          className="btn-outline inline-flex min-h-11 items-center gap-2 px-3 py-2 text-sm hover:btn-outline-hover"
        >
          <i.icon className="h-3.5 w-3.5" /> {i.label}
        </Link>
      ))}
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
      className={`editorial-panel p-5 sm:p-6 ${tone === "sand" ? "bg-sand/35" : ""} ${className}`}
    >
      <header className="flex items-baseline justify-between mb-5 pb-2 border-b border-gold/25">
        <h3 className="font-display text-xl font-semibold">{title}</h3>
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
        <p className="eyebrow">{label}</p>
        {hint && <p className="mt-1 text-xs text-slate">{hint}</p>}
      </div>
      <p className="numeric-display text-2xl">{value}</p>
    </div>
  );
}
