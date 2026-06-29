import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getReportsBundle } from "@/lib/reports.functions";
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, LineChart, Line } from "recharts";
import {
  Calendar,
  Download,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
} from "lucide-react";
import { useI18n, type Lang } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { AdminPageShell, AdminPageHeader, Empty } from "@/components/admin-shared";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  component: ReportsPage,
});

type Preset = "today" | "week" | "month" | "last_month" | "custom";

function presetRange(p: Preset): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);
  if (p === "today") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (p === "week") {
    const dow = now.getDay();
    start = new Date(now);
    start.setDate(now.getDate() - dow);
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (p === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (p === "last_month") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  }
  const span = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - span);
  return { start, end, prevStart, prevEnd };
}

const ils = (n: number) =>
  new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(n || 0);
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

function csvDownload(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((v) => {
          const s = String(v ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportsPage() {
  const { lang, locale, t } = useI18n();
  useDocumentTitle("page.reports.title");
  const fn = useServerFn(getReportsBundle);
  const [preset, setPreset] = useState<Preset>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const range = useMemo(() => {
    if (preset === "custom" && customStart && customEnd) {
      const s = new Date(customStart);
      s.setHours(0, 0, 0, 0);
      const e = new Date(customEnd);
      e.setHours(23, 59, 59, 999);
      const span = e.getTime() - s.getTime();
      return {
        start: s,
        end: e,
        prevStart: new Date(s.getTime() - span - 1),
        prevEnd: new Date(s.getTime() - 1),
      };
    }
    return presetRange(preset === "custom" ? "month" : preset);
  }, [preset, customStart, customEnd]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-reports", range.start.toISOString(), range.end.toISOString()],
    queryFn: () =>
      fn({
        data: {
          start: range.start.toISOString(),
          end: range.end.toISOString(),
          prevStart: range.prevStart.toISOString(),
          prevEnd: range.prevEnd.toISOString(),
        },
      }),
    refetchOnWindowFocus: false,
  });

  return (
    <AdminPageShell>
      <AdminPageHeader
        eyebrow={t("reports.eyebrow")}
        title={t("reports.title")}
        description={t("reports.subtitle")}
        action={
          <p className="mt-3 text-xs font-medium text-slate">
            {range.start.toLocaleDateString(locale, { month: "long", day: "numeric" })} —{" "}
            {range.end.toLocaleDateString(locale, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        }
      />
      <div className="space-y-10 md:space-y-14 pb-16">
        <div className="pb-6 border-b border-gold/30">
          <DateRangePicker
            preset={preset}
            setPreset={setPreset}
            customStart={customStart}
            customEnd={customEnd}
            setCustomStart={setCustomStart}
            setCustomEnd={setCustomEnd}
          />
        </div>
        {isLoading && <LoadingGrid />}
        {error && (
          <p className="text-sm text-slate font-display">
            {(error as Error).message === "forbidden"
              ? t("reports.error.forbidden")
              : t("reports.error.load")}
          </p>
        )}

        {data && (
          <>
            {/* Insights */}
            {data.insights.length > 0 ? (
              <section>
                <SectionHeader title={t("reports.insights")} eyebrow={t("reports.attention")} />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mt-6">
                  {data.insights.map((i) => (
                    <InsightCard key={i.id} insight={i} lang={lang} />
                  ))}
                </div>
              </section>
            ) : (
              <section>
                <SectionHeader title={t("reports.insights")} eyebrow={t("reports.attention")} />
                <div className="mt-6 editorial-card p-8 text-center">
                  <Sparkles className="h-5 w-5 text-gold/70 mx-auto" />
                  <p className="font-display text-lg mt-3">{t("reports.noUrgent")}</p>
                  <p className="mt-2 text-xs font-medium text-slate">{t("reports.calm")}</p>
                </div>
              </section>
            )}

            {/* Summary KPI strip */}
            <section>
              <SectionHeader title={t("reports.atGlance")} eyebrow={t("reports.topMetrics")} />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5 mt-6">
                <MetricCard
                  label={t("reports.revenue")}
                  value={ils(data.summary.totalRevenue)}
                  prev={
                    data.summary.prevTotalRevenue !== null
                      ? ils(data.summary.prevTotalRevenue)
                      : null
                  }
                  delta={delta(data.summary.totalRevenue, data.summary.prevTotalRevenue)}
                  hint={t("reports.netRefunds")}
                />
                <MetricCard
                  label={t("reports.bookings")}
                  value={String(data.summary.bookingsCount)}
                  prev={
                    data.summary.prevBookingsCount !== null
                      ? String(data.summary.prevBookingsCount)
                      : null
                  }
                  delta={delta(data.summary.bookingsCount, data.summary.prevBookingsCount)}
                  hint={t("reports.createdRange")}
                />
                <MetricCard
                  label={t("reports.attendanceRate")}
                  value={pct(data.summary.attendanceRate)}
                  hint={t("reports.expectedAttendance")}
                />
                <MetricCard
                  label={t("reports.activeMembers")}
                  value={String(data.summary.activeMembersCount)}
                  hint={t("reports.visited60")}
                />
                <MetricCard
                  label={t("reports.newMembers")}
                  value={String(data.summary.newMembersCount)}
                  hint={t("reports.joinedPeriod")}
                />
                <MetricCard
                  label={t("reports.packageSales")}
                  value={String(data.summary.packageSalesCount)}
                  hint={t("reports.paidPlanTransactions")}
                />
                <MetricCard
                  label={t("reports.noShowRate")}
                  value={pct(data.summary.noShowRate)}
                  hint={t("reports.markedAttendance")}
                  tone={data.summary.noShowRate > 0.15 ? "gold" : "default"}
                />
                <MetricCard
                  label={t("reports.waitlistDemand")}
                  value={String(data.summary.waitlistDemand)}
                  hint={t("reports.entriesPeriod")}
                />
              </div>
            </section>

            {/* Revenue */}
            <section>
              <SectionHeader
                title={t("reports.revenue")}
                eyebrow={t("reports.revenue")}
                right={
                  <ExportButton
                    onClick={() =>
                      csvDownload("revenue.csv", [
                        ["Date", "Amount (ILS)"],
                        ...data.revenue.series.map((s) => [s.date, s.amount]),
                      ])
                    }
                    label={t("reports.exportRevenue")}
                  />
                }
              />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-6">
                <Panel title={t("reports.trend")} className="lg:col-span-2">
                  {data.revenue.series.length === 0 ? (
                    <EmptyState text={t("reports.noPaymentsRange")} />
                  ) : (
                    <div className="h-56 w-full min-w-0 -mx-2 sm:mx-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={data.revenue.series}
                          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                        >
                          <XAxis
                            dataKey="date"
                            tick={{ fill: "#6F7A8C", fontSize: 11 }}
                            tickFormatter={(d) => d.slice(5)}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "#FAF7F2",
                              border: "1px solid rgba(212,175,106,0.4)",
                              borderRadius: 10,
                            }}
                            formatter={(v: number) => ils(v)}
                          />
                          <Line
                            type="monotone"
                            dataKey="amount"
                            stroke="#0B1D3A"
                            strokeWidth={2}
                            dot={{ fill: "#D4AF6A", r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="mt-5 pt-5 border-t border-gold/20 grid grid-cols-3 gap-3 sm:gap-4 text-sm">
                    <Stat label={t("reports.total")} value={ils(data.revenue.total)} />
                    <Stat label={t("reports.refunded")} value={ils(data.revenue.refunded)} />
                    <Stat label={t("reports.outstanding")} value={ils(data.revenue.outstanding)} />
                  </div>
                </Panel>

                <Panel title={t("reports.byMethod")}>
                  {Object.keys(data.revenue.byMethod).length === 0 ? (
                    <EmptyState text={t("reports.noRevenue")} />
                  ) : (
                    <ul className="space-y-3">
                      {Object.entries(data.revenue.byMethod)
                        .sort((a, b) => b[1] - a[1])
                        .map(([m, v]) => (
                          <li key={m} className="flex items-center justify-between gap-3">
                            <span className="text-sm capitalize">{m.replace(/_/g, " ")}</span>
                            <span className="font-display text-lg">{ils(v)}</span>
                          </li>
                        ))}
                    </ul>
                  )}
                </Panel>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
                <Panel title={t("reports.byPackage")}>
                  {data.revenue.byPlan.length === 0 ? (
                    <EmptyState text={t("reports.noPackageRevenue")} />
                  ) : (
                    <ul className="divide-y divide-gold/15">
                      {data.revenue.byPlan.slice(0, 8).map((p) => (
                        <li key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-display truncate">{p.name}</p>
                            <p className="text-xs text-slate">
                              {t("reports.salesCount", { count: p.count })}
                            </p>
                          </div>
                          <span className="font-display text-lg shrink-0">{ils(p.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
                <Panel title={t("reports.topSpenders")}>
                  {data.revenue.topSpenders.length === 0 ? (
                    <EmptyState text={t("reports.noSpending")} />
                  ) : (
                    <ul className="divide-y divide-gold/15">
                      {data.revenue.topSpenders.map((s) => (
                        <li key={s.id} className="py-2.5 flex items-center justify-between gap-3">
                          <Link
                            to="/admin/members/$id"
                            params={{ id: s.id }}
                            className="font-display truncate hover:underline"
                          >
                            {s.name}
                          </Link>
                          <span className="font-display text-lg shrink-0">{ils(s.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>
              <p className="mt-3 text-xs text-slate">
                {t("reports.averageRevenue")}:{" "}
                <span className="font-display text-navy">
                  {ils(data.summary.avgRevenuePerActiveMember)}
                </span>
              </p>
            </section>

            {/* Classes & Attendance */}
            <section>
              <SectionHeader
                title={t("reports.classesAttendance")}
                eyebrow={t("reports.fillingStudio")}
                right={
                  <ExportButton
                    onClick={() =>
                      csvDownload("attendance.csv", [
                        ["Class", "Date", "Room", "Instructor", "Capacity", "Booked", "Fill %"],
                        ...data.attendance.mostBooked.map((c) => [
                          c.title,
                          c.starts_at,
                          c.room ?? "",
                          c.instructor ?? "",
                          c.capacity,
                          c.booked,
                          (c.fill * 100).toFixed(0),
                        ]),
                      ])
                    }
                    label={t("reports.exportAttendance")}
                  />
                }
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-5 mt-6">
                <MetricCard
                  label={t("reports.classesHeld")}
                  value={String(data.attendance.totalClasses)}
                />
                <MetricCard
                  label={t("reports.totalBookings")}
                  value={String(data.attendance.totalBookings)}
                />
                <MetricCard
                  label={t("reports.avgFillRate")}
                  value={pct(data.attendance.fillRate)}
                />
                <MetricCard label={t("reports.noShows")} value={pct(data.attendance.noShowRate)} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
                <Panel title={t("reports.mostBooked")}>
                  {data.attendance.mostBooked.length === 0 ? (
                    <EmptyState text={t("reports.noClassesRange")} />
                  ) : (
                    <ul className="divide-y divide-gold/15">
                      {data.attendance.mostBooked.map((c) => (
                        <ClassRow key={c.id} c={c} locale={locale} />
                      ))}
                    </ul>
                  )}
                </Panel>
                <Panel title={t("reports.lowFillRate")}>
                  {data.attendance.leastBooked.length === 0 ? (
                    <EmptyState text={t("reports.nothingToFlag")} />
                  ) : (
                    <ul className="divide-y divide-gold/15">
                      {data.attendance.leastBooked.map((c) => (
                        <ClassRow key={c.id} c={c} locale={locale} />
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>
              {data.attendance.upcomingAtRisk.length > 0 && (
                <Panel title={t("reports.upcomingAtRisk")} tone="sand" className="mt-5">
                  <ul className="divide-y divide-gold/15">
                    {data.attendance.upcomingAtRisk.map((c) => (
                      <li
                        key={c.id}
                        className="py-2.5 flex items-center justify-between gap-3 text-sm"
                      >
                        <div>
                          <p className="font-display">{c.title}</p>
                          <p className="text-xs text-slate">
                            {new Date(c.starts_at).toLocaleString(locale, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}{" "}
                            · {c.room}
                          </p>
                        </div>
                        <span className="text-xs font-medium text-slate">
                          {c.booked}/{c.capacity}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
            </section>

            {/* Rooms */}
            <section>
              <SectionHeader
                title={t("reports.rooms.title")}
                eyebrow={t("reports.rooms.eyebrow")}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
                {data.rooms.length === 0 ? (
                  <div className="lg:col-span-3">
                    <EmptyState text={t("reports.noRoomActivity")} />
                  </div>
                ) : (
                  data.rooms.map((r, i) => (
                    <div key={r.id ?? r.name + i} className="editorial-card overflow-hidden">
                      {r.image_url && (
                        <div
                          className="h-32 bg-cover bg-center"
                          style={{ backgroundImage: `url(${r.image_url})` }}
                        />
                      )}
                      <div className="p-5">
                        <p className="font-display text-xl">{r.name}</p>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <Stat label={t("reports.classes")} value={String(r.classes)} />
                          <Stat label={t("reports.avgFill")} value={pct(r.avgFill)} />
                        </div>
                        <p className="mt-3 text-xs font-medium text-slate">
                          {r.classes < 3
                            ? t("reports.needsMoreData")
                            : r.avgFill >= 0.85
                              ? t("reports.highDemand")
                              : r.avgFill >= 0.5
                                ? t("reports.comfortablyUsed")
                                : t("reports.underused")}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Instructors */}
            <section>
              <SectionHeader
                title={t("reports.instructors.title")}
                eyebrow={t("reports.instructors.eyebrow")}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
                {data.instructors.length === 0 ? (
                  <div className="lg:col-span-3">
                    <EmptyState text={t("reports.noInstructorClasses")} />
                  </div>
                ) : (
                  data.instructors.map((i) => (
                    <div key={i.id} className="editorial-card p-5">
                      <div className="flex items-center gap-3">
                        {i.avatar_url ? (
                          <img
                            src={i.avatar_url}
                            alt={i.name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gold/20" />
                        )}
                        <p className="font-display text-lg">{i.name}</p>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                        <Stat label={t("reports.classes")} value={String(i.classes)} />
                        <Stat label={t("reports.fill")} value={pct(i.avgFill)} />
                        <Stat label={t("reports.attended")} value={pct(i.attendanceRate)} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Members at risk */}
            <section>
              <SectionHeader
                title={t("reports.members.title")}
                eyebrow={t("reports.members.eyebrow")}
                right={
                  <ExportButton
                    onClick={() =>
                      csvDownload("members-at-risk.csv", [
                        ["Name", "Phone", "Last visit", "Remaining credits", "Reasons"],
                        ...data.members.atRisk.map((m) => [
                          m.name,
                          m.phone ?? "",
                          m.last_visit_at ?? "",
                          m.remaining_credits,
                          m.reasons.join("; "),
                        ]),
                      ])
                    }
                    label={t("reports.exportMembers")}
                  />
                }
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-5 mt-6">
                <MetricCard label={t("reports.active")} value={String(data.members.active)} />
                <MetricCard label={t("reports.new")} value={String(data.members.new)} />
                <MetricCard label={t("reports.inactive")} value={String(data.members.inactive)} />
                <MetricCard
                  label={t("reports.firstTimers")}
                  value={String(data.members.firstTimers)}
                />
                <MetricCard
                  label={t("reports.lowCredits")}
                  value={String(data.members.lowCredits)}
                />
                <MetricCard
                  label={t("reports.packageExpiring")}
                  value={String(data.members.expiringSoon)}
                />
              </div>
              <Panel title={t("reports.attention")} tone="sand" className="mt-5">
                {data.members.atRisk.length === 0 ? (
                  <EmptyState text={t("reports.everyMemberGood")} />
                ) : (
                  <ul className="divide-y divide-gold/15">
                    {data.members.atRisk.slice(0, 12).map((m) => {
                      const waHref = m.phone
                        ? `https://wa.me/${String(m.phone).replace(/[^0-9]/g, "")}`
                        : null;
                      return (
                        <li
                          key={m.id}
                          className="py-3 grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center"
                        >
                          <div className="min-w-0">
                            <Link
                              to="/admin/members/$id"
                              params={{ id: m.id }}
                              className="font-display text-base sm:text-lg hover:underline truncate block"
                            >
                              {m.name}
                            </Link>
                            <p className="mt-1 truncate text-xs font-medium text-slate">
                              {m.reasons.join(" · ") || t("reports.checkIn")}
                            </p>
                            <p className="mt-1 text-xs text-slate">
                              {t("reports.credits", { count: m.remaining_credits })}
                              {m.last_visit_at
                                ? ` · ${t("reports.lastVisit", { date: new Date(m.last_visit_at).toLocaleDateString(locale, { month: "short", day: "numeric" }) })}`
                                : ` · ${t("reports.noVisitsYet")}`}
                            </p>
                          </div>
                          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                            {waHref && (
                              <a
                                href={waHref}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-outline inline-flex items-center gap-1 px-2.5 py-1 text-xs hover:btn-outline-hover"
                              >
                                {t("reports.message")}
                              </a>
                            )}
                            <Link
                              to="/admin/members/$id"
                              params={{ id: m.id }}
                              className="inline-flex items-center gap-1 text-xs font-medium text-navy hover:text-gold"
                            >
                              {t("reports.open")} <ArrowRight className="h-3 w-3" />
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>
            </section>

            {/* Packages */}
            <section>
              <SectionHeader
                title={t("reports.packages.title")}
                eyebrow={t("reports.packages.eyebrow")}
                right={
                  <ExportButton
                    onClick={() =>
                      csvDownload("packages.csv", [
                        ["Package", "Revenue", "Sales", "Active", "Expiring soon"],
                        ...data.packages.report.map((p) => [
                          p.name,
                          p.revenue,
                          p.sales,
                          p.active,
                          p.expiringSoon,
                        ]),
                      ])
                    }
                    label={t("reports.exportPackages")}
                  />
                }
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
                {data.packages.report.length === 0 ? (
                  <div className="md:col-span-2">
                    <EmptyState text={t("reports.noPlans")} />
                  </div>
                ) : (
                  data.packages.report.slice(0, 8).map((p) => (
                    <div key={p.id} className="editorial-card p-5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-display text-xl">{p.name}</p>
                        <span className="font-display text-2xl">{ils(p.revenue)}</span>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                        <Stat label={t("reports.sales")} value={String(p.sales)} />
                        <Stat label={t("reports.active")} value={String(p.active)} />
                        <Stat label={t("reports.expiring")} value={String(p.expiringSoon)} />
                      </div>
                    </div>
                  ))
                )}
              </div>
              <Panel title={t("reports.packageRequests")} className="mt-5">
                {Object.keys(data.packages.requestsByStatus).length === 0 ? (
                  <EmptyState text={t("reports.noPackageRequests")} />
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(data.packages.requestsByStatus).map(([s, n]) => (
                      <Stat key={s} label={s.replace(/_/g, " ")} value={String(n)} />
                    ))}
                  </div>
                )}
              </Panel>
            </section>

            {/* Waitlist */}
            <section>
              <SectionHeader
                title={t("reports.waitlist.title")}
                eyebrow={t("reports.waitlist.eyebrow")}
                right={
                  <ExportButton
                    onClick={() =>
                      csvDownload("waitlist.csv", [
                        ["Class", "Date", "Waitlist count", "Promoted"],
                        ...data.waitlist.topClasses.map((c) => [
                          c.title ?? "",
                          c.starts_at ?? "",
                          c.count,
                          c.promoted,
                        ]),
                      ])
                    }
                    label={t("reports.exportWaitlist")}
                  />
                }
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-5 mt-6">
                <MetricCard
                  label={t("reports.totalJoins")}
                  value={String(data.waitlist.totalJoins)}
                />
                <MetricCard
                  label={t("reports.offered")}
                  value={String(data.waitlist.byStatus["offered"] ?? 0)}
                />
                <MetricCard
                  label={t("reports.promoted")}
                  value={String(data.waitlist.byStatus["promoted"] ?? 0)}
                />
                <MetricCard
                  label={t("reports.conversion")}
                  value={pct(data.waitlist.conversionRate)}
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
                <Panel title={t("reports.mostWaitlisted")}>
                  {data.waitlist.topClasses.length === 0 ? (
                    <EmptyState text={t("reports.noWaitlistActivity")} />
                  ) : (
                    <ul className="divide-y divide-gold/15">
                      {data.waitlist.topClasses.map((c) => (
                        <li key={c.id} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-display truncate">{c.title}</p>
                            <p className="text-xs text-slate">
                              {c.starts_at
                                ? new Date(c.starts_at).toLocaleDateString(locale, {
                                    month: "short",
                                    day: "numeric",
                                  })
                                : "—"}
                            </p>
                          </div>
                          <span className="font-display text-lg shrink-0">{c.count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
                <Panel title={t("reports.frequentWaitlisters")}>
                  {data.waitlist.frequentMembers.length === 0 ? (
                    <EmptyState text={t("reports.noRepeatWaitlisters")} />
                  ) : (
                    <ul className="divide-y divide-gold/15">
                      {data.waitlist.frequentMembers.map((m) => (
                        <li key={m.id} className="py-2.5 flex items-center justify-between gap-3">
                          <Link
                            to="/admin/members/$id"
                            params={{ id: m.id }}
                            className="font-display hover:underline"
                          >
                            {m.name}
                          </Link>
                          <span className="font-display text-lg">{m.count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>
            </section>

            {/* Communication */}
            <section>
              <SectionHeader
                title={t("reports.communication.title")}
                eyebrow={t("reports.communication.eyebrow")}
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-5 mt-6">
                <MetricCard
                  label={t("reports.generated")}
                  value={String(data.communication.generated)}
                  hint={t("reports.messagesPrepared")}
                />
                <MetricCard
                  label={t("reports.markedSent")}
                  value={String(data.communication.markedSent)}
                  hint={t("reports.manuallyConfirmed")}
                />
                <MetricCard
                  label={t("reports.templatesUsed")}
                  value={String(Object.keys(data.communication.byTemplate).length)}
                />
                <MetricCard
                  label={t("reports.triggerTypes")}
                  value={String(Object.keys(data.communication.byTrigger).length)}
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
                <Panel title={t("reports.mostUsedTemplates")}>
                  {Object.keys(data.communication.byTemplate).length === 0 ? (
                    <EmptyState text={t("reports.noMessagesPrepared")} />
                  ) : (
                    <ul className="divide-y divide-gold/15">
                      {Object.entries(data.communication.byTemplate)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 6)
                        .map(([k, v]) => (
                          <li key={k} className="py-2.5 flex items-center justify-between gap-3">
                            <span className="text-sm capitalize">{k.replace(/_/g, " ")}</span>
                            <span className="font-display text-lg">{v}</span>
                          </li>
                        ))}
                    </ul>
                  )}
                </Panel>
                <Panel title={t("reports.byTrigger")}>
                  {Object.keys(data.communication.byTrigger).length === 0 ? (
                    <EmptyState text={t("reports.noTrackedTriggers")} />
                  ) : (
                    <ul className="divide-y divide-gold/15">
                      {Object.entries(data.communication.byTrigger)
                        .sort((a, b) => b[1] - a[1])
                        .map(([k, v]) => (
                          <li key={k} className="py-2.5 flex items-center justify-between gap-3">
                            <span className="text-sm capitalize">{k.replace(/_/g, " ")}</span>
                            <span className="font-display text-lg">{v}</span>
                          </li>
                        ))}
                    </ul>
                  )}
                </Panel>
              </div>
            </section>
          </>
        )}
      </div>
    </AdminPageShell>
  );
}

function delta(
  cur: number,
  prev: number | null | undefined,
): { dir: "up" | "down" | "flat"; pct: number } | null {
  if (prev === null || prev === undefined) return null;
  if (prev === 0) return cur > 0 ? { dir: "up", pct: 100 } : { dir: "flat", pct: 0 };
  const d = (cur - prev) / prev;
  if (Math.abs(d) < 0.01) return { dir: "flat", pct: 0 };
  return { dir: d > 0 ? "up" : "down", pct: Math.abs(d * 100) };
}

function DateRangePicker({
  preset,
  setPreset,
  customStart,
  customEnd,
  setCustomStart,
  setCustomEnd,
}: any) {
  const { t } = useI18n();
  const presets: { v: Preset; label: string }[] = [
    { v: "today", label: t("reports.range.today") },
    { v: "week", label: t("reports.range.week") },
    { v: "month", label: t("reports.range.month") },
    { v: "last_month", label: t("reports.range.lastMonth") },
    { v: "custom", label: t("reports.range.custom") },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        <Calendar className="h-3.5 w-3.5 text-gold/70 shrink-0" />
        <div className="flex items-center gap-1.5 shrink-0">
          {presets.map((p) => (
            <button
              key={p.v}
              onClick={() => setPreset(p.v)}
              className={`min-h-9 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${preset === p.v ? "border-navy bg-navy text-ivory" : "border-gold/40 text-navy hover:bg-gold/8"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {preset === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="editorial-input min-h-9 px-2.5 py-1.5 text-xs"
          />
          <span className="text-slate text-xs">→</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="editorial-input min-h-9 px-2.5 py-1.5 text-xs"
          />
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  eyebrow,
  right,
}: {
  title: string;
  eyebrow: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 pb-3 border-b border-gold/25">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="font-display text-xl sm:text-2xl md:text-3xl mt-1 leading-[1.1]">{title}</h2>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

function MetricCard({
  label,
  value,
  prev,
  delta,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  prev?: string | null;
  delta?: { dir: "up" | "down" | "flat"; pct: number } | null;
  hint?: string;
  tone?: "default" | "gold";
}) {
  const { t } = useI18n();
  return (
    <div className={`editorial-card p-5 ${tone === "gold" ? "border-s-4 border-s-gold" : ""}`}>
      <p className="eyebrow">{label}</p>
      <p className="numeric-display text-3xl mt-2">{value}</p>
      {delta && (
        <p
          className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${delta.dir === "up" ? "text-navy" : delta.dir === "down" ? "text-slate" : "text-slate"}`}
        >
          {delta.dir === "up" ? (
            <TrendingUp className="h-3 w-3 text-gold" />
          ) : delta.dir === "down" ? (
            <TrendingDown className="h-3 w-3" />
          ) : (
            <Minus className="h-3 w-3" />
          )}
          {delta.pct.toFixed(0)}% {delta.dir === "flat" ? t("reports.flat") : t("reports.vsPrev")}
        </p>
      )}
      {hint && !delta && <p className="mt-2 text-xs text-slate">{hint}</p>}
      {hint && delta && <p className="mt-1 text-xs text-slate">{hint}</p>}
    </div>
  );
}

function Panel({
  title,
  children,
  className = "",
  tone = "ivory",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  tone?: "ivory" | "sand";
}) {
  return (
    <section
      className={`editorial-panel p-4 sm:p-6 ${tone === "sand" ? "bg-sand/30" : ""} ${className}`}
    >
      <header className="flex items-baseline justify-between gap-3 mb-4 sm:mb-5 pb-2 border-b border-gold/25">
        <h3 className="font-display text-lg sm:text-xl truncate">{title}</h3>
        <Sparkles className="h-3.5 w-3.5 text-gold/70 shrink-0" />
      </header>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="numeric-display text-lg mt-1">{value}</p>
    </div>
  );
}

function ClassRow({ c, locale }: { c: any; locale: string }) {
  return (
    <li className="py-2.5 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-display truncate">{c.title}</p>
        <p className="truncate text-xs text-slate">
          {new Date(c.starts_at).toLocaleDateString(locale, { month: "short", day: "numeric" })} ·{" "}
          {c.room ?? "—"} · {c.instructor ?? "—"}
        </p>
      </div>
      <div className="text-end shrink-0">
        <p className="font-display text-lg">
          {c.booked}/{c.capacity}
        </p>
        <p className="text-xs font-medium text-slate">{(c.fill * 100).toFixed(0)}%</p>
      </div>
    </li>
  );
}

function InsightCard({ insight, lang }: { insight: any; lang: Lang }) {
  const { t } = useI18n();
  const display = localizeInsight(insight, lang, t);
  return (
    <div className="editorial-card bg-powder/15 p-5 border-s-4 border-s-gold">
      <p className="eyebrow">{t("reports.insight")}</p>
      <h4 className="font-display text-xl mt-2">{display.title}</h4>
      <p className="text-sm text-slate mt-2 leading-relaxed">{display.body}</p>
      {display.metric && <p className="numeric-display text-2xl mt-3">{display.metric}</p>}
      {insight.action && (
        <Link
          to={insight.action.to}
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-navy transition hover:text-gold"
        >
          {display.actionLabel} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function localizeInsight(insight: any, lang: Lang, t: ReturnType<typeof useI18n>["t"]) {
  if (lang === "en") {
    return {
      title: insight.title,
      body: insight.body,
      metric: insight.metric,
      actionLabel: insight.action?.label,
    };
  }

  const count = extractNumber(insight.metric) ?? extractNumber(insight.title) ?? 0;
  const pctValue = extractNumber(insight.metric) ?? 0;
  const actionLabel = actionLabelFor(insight.action?.to, t) ?? insight.action?.label;

  if (insight.id === "needs-attention") {
    return {
      title: t("reports.insight.needsAttention.title", { count }),
      body: t("reports.insight.needsAttention.body"),
      metric: t("reports.membersMetric", { count }),
      actionLabel,
    };
  }
  if (insight.id === "first-timers") {
    return {
      title: t("reports.insight.firstTimers.title", { count }),
      body: t("reports.insight.firstTimers.body"),
      metric: t("reports.newMetric", { count }),
      actionLabel,
    };
  }
  if (insight.id === "package-followup") {
    return {
      title: t("reports.insight.packageFollowup.title", { count }),
      body: t("reports.insight.packageFollowup.body"),
      metric: t("reports.pendingMetric", { count }),
      actionLabel,
    };
  }
  if (insight.id === "no-show") {
    return {
      title: t("reports.insight.noShow.title"),
      body: t("reports.insight.noShow.body", { count: pctValue }),
      metric: `${pctValue}%`,
      actionLabel,
    };
  }
  if (insight.id === "waitlist-demand") {
    const name = String(insight.title).replace(/ has strong waitlist demand$/, "");
    return {
      title: t("reports.insight.waitlistDemand.title", { name }),
      body: t("reports.insight.waitlistDemand.body", { count }),
      metric: t("reports.waitingMetric", { count }),
      actionLabel,
    };
  }
  if (insight.id === "hot-room") {
    const name = String(insight.title).replace(/ is reaching high occupancy$/, "");
    return {
      title: t("reports.insight.hotRoom.title", { name }),
      body: t("reports.insight.hotRoom.body", { count: pctValue }),
      metric: t("reports.fillMetric", { count: pctValue }),
      actionLabel,
    };
  }
  if (insight.id === "peak-day") {
    const day = translateDay(String(insight.title).replace(/ is your strongest day$/, ""), lang);
    return {
      title: t("reports.insight.peakDay.title", { day }),
      body: t("reports.insight.peakDay.body", { day }),
      metric: t("reports.bookingsMetric", { count }),
      actionLabel,
    };
  }

  return {
    title: insight.title,
    body: insight.body,
    metric: insight.metric,
    actionLabel,
  };
}

function extractNumber(value: unknown) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function actionLabelFor(to: string | undefined, t: ReturnType<typeof useI18n>["t"]) {
  if (to === "/admin/members") return t("reports.openMembers");
  if (to === "/admin/calendar") return t("reports.openCalendar");
  if (to === "/admin/rooms") return t("reports.openRooms");
  if (to === "/admin/messages") return t("reports.openMessages");
  return undefined;
}

function translateDay(day: string, lang: Lang) {
  if (lang === "he") {
    return (
      (
        {
          Sunday: "יום ראשון",
          Monday: "יום שני",
          Tuesday: "יום שלישי",
          Wednesday: "יום רביעי",
          Thursday: "יום חמישי",
          Friday: "יום שישי",
          Saturday: "שבת",
        } as Record<string, string>
      )[day] ?? day
    );
  }
  if (lang === "ar") {
    return (
      (
        {
          Sunday: "الأحد",
          Monday: "الاثنين",
          Tuesday: "الثلاثاء",
          Wednesday: "الأربعاء",
          Thursday: "الخميس",
          Friday: "الجمعة",
          Saturday: "السبت",
        } as Record<string, string>
      )[day] ?? day
    );
  }
  return day;
}

function ExportButton({ onClick, label = "Export" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="btn-outline inline-flex min-h-9 items-center gap-2 whitespace-nowrap px-3 py-1.5 text-xs hover:btn-outline-hover"
    >
      <Download className="h-3 w-3" />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">CSV</span>
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return <Empty>{text}</Empty>;
}

function LoadingGrid() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="skeleton-brand h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton-brand h-56" />
        ))}
      </div>
    </div>
  );
}
