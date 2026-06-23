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

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({ meta: [{ title: "Reports & Insights — Cloud & Core" }] }),
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
    <div className="space-y-10 md:space-y-14 pb-16">
      <header className="space-y-5 pb-6 border-b border-gold/30">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 md:flex md:flex-wrap md:justify-between">
          <div className="min-w-0">
            <p className="eyebrow text-[10px]">Owner insights</p>
            <h1 className="font-display italic text-3xl sm:text-4xl md:text-5xl mt-2 leading-[1.05]">
              Studio Reports
            </h1>
            <p className="text-slate text-sm mt-3 max-w-xl leading-relaxed">
              Understand revenue, attendance, demand, and member care from one calm view.
            </p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate mt-3">
              {range.start.toLocaleDateString(undefined, { month: "long", day: "numeric" })} —{" "}
              {range.end.toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        <DateRangePicker
          preset={preset}
          setPreset={setPreset}
          customStart={customStart}
          customEnd={customEnd}
          setCustomStart={setCustomStart}
          setCustomEnd={setCustomEnd}
        />
      </header>

      {isLoading && <LoadingGrid />}
      {error && (
        <p className="text-sm text-slate font-display italic">
          {(error as Error).message === "forbidden"
            ? "This area is for studio owners only."
            : "Could not load reports."}
        </p>
      )}

      {data && (
        <>
          {/* Insights */}
          {data.insights.length > 0 ? (
            <section>
              <SectionHeader title="Studio insights" eyebrow="What needs your attention" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mt-6">
                {data.insights.map((i) => (
                  <InsightCard key={i.id} insight={i} />
                ))}
              </div>
            </section>
          ) : (
            <section>
              <SectionHeader title="Studio insights" eyebrow="What needs your attention" />
              <div className="mt-6 editorial-card p-8 text-center">
                <Sparkles className="h-5 w-5 text-gold/70 mx-auto" />
                <p className="font-display italic text-lg mt-3">
                  No urgent studio signals right now.
                </p>
                <p className="text-[11px] uppercase tracking-[0.15em] text-slate mt-2">
                  The studio is running calmly across the range you selected.
                </p>
              </div>
            </section>
          )}

          {/* Summary KPI strip */}
          <section>
            <SectionHeader title="At a glance" eyebrow="Top metrics" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5 mt-6">
              <MetricCard
                label="Revenue"
                value={ils(data.summary.totalRevenue)}
                prev={
                  data.summary.prevTotalRevenue !== null ? ils(data.summary.prevTotalRevenue) : null
                }
                delta={delta(data.summary.totalRevenue, data.summary.prevTotalRevenue)}
                hint="Net of refunds"
              />
              <MetricCard
                label="Bookings"
                value={String(data.summary.bookingsCount)}
                prev={
                  data.summary.prevBookingsCount !== null
                    ? String(data.summary.prevBookingsCount)
                    : null
                }
                delta={delta(data.summary.bookingsCount, data.summary.prevBookingsCount)}
                hint="Created in range"
              />
              <MetricCard
                label="Attendance rate"
                value={pct(data.summary.attendanceRate)}
                hint="Of expected attendances"
              />
              <MetricCard
                label="Active members"
                value={String(data.summary.activeMembersCount)}
                hint="Visited in last 60 days"
              />
              <MetricCard
                label="New members"
                value={String(data.summary.newMembersCount)}
                hint="Joined this period"
              />
              <MetricCard
                label="Package sales"
                value={String(data.summary.packageSalesCount)}
                hint="Paid plan transactions"
              />
              <MetricCard
                label="No-show rate"
                value={pct(data.summary.noShowRate)}
                hint="Of marked attendance"
                tone={data.summary.noShowRate > 0.15 ? "gold" : "default"}
              />
              <MetricCard
                label="Waitlist demand"
                value={String(data.summary.waitlistDemand)}
                hint="Entries this period"
              />
            </div>
          </section>

          {/* Revenue */}
          <section>
            <SectionHeader
              title="Revenue"
              eyebrow="Where the studio earns"
              right={
                <ExportButton
                  onClick={() =>
                    csvDownload("revenue.csv", [
                      ["Date", "Amount (ILS)"],
                      ...data.revenue.series.map((s) => [s.date, s.amount]),
                    ])
                  }
                  label="Export revenue"
                />
              }
            />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-6">
              <Panel title="Trend" className="lg:col-span-2">
                {data.revenue.series.length === 0 ? (
                  <EmptyState text="No payments recorded in this range yet." />
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
                            borderRadius: 2,
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
                  <Stat label="Total" value={ils(data.revenue.total)} />
                  <Stat label="Refunded" value={ils(data.revenue.refunded)} />
                  <Stat label="Outstanding" value={ils(data.revenue.outstanding)} />
                </div>
              </Panel>

              <Panel title="By method">
                {Object.keys(data.revenue.byMethod).length === 0 ? (
                  <EmptyState text="No revenue recorded." />
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
              <Panel title="By package">
                {data.revenue.byPlan.length === 0 ? (
                  <EmptyState text="No package-linked revenue." />
                ) : (
                  <ul className="divide-y divide-gold/15">
                    {data.revenue.byPlan.slice(0, 8).map((p) => (
                      <li key={p.name} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-display truncate">{p.name}</p>
                          <p className="text-[11px] text-slate">
                            {p.count} sale{p.count === 1 ? "" : "s"}
                          </p>
                        </div>
                        <span className="font-display text-lg shrink-0">{ils(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel title="Top spenders">
                {data.revenue.topSpenders.length === 0 ? (
                  <EmptyState text="No spending data yet." />
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
            <p className="text-[11px] text-slate mt-3">
              Average revenue per active member:{" "}
              <span className="font-display text-navy">
                {ils(data.summary.avgRevenuePerActiveMember)}
              </span>
            </p>
          </section>

          {/* Classes & Attendance */}
          <section>
            <SectionHeader
              title="Classes &amp; Attendance"
              eyebrow="What's filling the studio"
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
                  label="Export attendance"
                />
              }
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-5 mt-6">
              <MetricCard label="Classes held" value={String(data.attendance.totalClasses)} />
              <MetricCard label="Bookings" value={String(data.attendance.totalBookings)} />
              <MetricCard label="Avg fill rate" value={pct(data.attendance.fillRate)} />
              <MetricCard label="No-shows" value={pct(data.attendance.noShowRate)} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
              <Panel title="Most booked">
                {data.attendance.mostBooked.length === 0 ? (
                  <EmptyState text="No classes in range." />
                ) : (
                  <ul className="divide-y divide-gold/15">
                    {data.attendance.mostBooked.map((c) => (
                      <ClassRow key={c.id} c={c} />
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel title="Low fill rate">
                {data.attendance.leastBooked.length === 0 ? (
                  <EmptyState text="Nothing to flag." />
                ) : (
                  <ul className="divide-y divide-gold/15">
                    {data.attendance.leastBooked.map((c) => (
                      <ClassRow key={c.id} c={c} />
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
            {data.attendance.upcomingAtRisk.length > 0 && (
              <Panel title="Upcoming classes at risk" tone="sand" className="mt-5">
                <ul className="divide-y divide-gold/15">
                  {data.attendance.upcomingAtRisk.map((c) => (
                    <li
                      key={c.id}
                      className="py-2.5 flex items-center justify-between gap-3 text-sm"
                    >
                      <div>
                        <p className="font-display">{c.title}</p>
                        <p className="text-[11px] text-slate">
                          {new Date(c.starts_at).toLocaleString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}{" "}
                          · {c.room}
                        </p>
                      </div>
                      <span className="text-[11px] uppercase tracking-[0.15em] text-slate">
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
            <SectionHeader title="Rooms" eyebrow="Space utilization" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
              {data.rooms.length === 0 ? (
                <div className="lg:col-span-3">
                  <EmptyState text="No room activity in this range." />
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
                        <Stat label="Classes" value={String(r.classes)} />
                        <Stat label="Avg fill" value={pct(r.avgFill)} />
                      </div>
                      <p className="mt-3 text-[11px] uppercase tracking-[0.15em] text-slate">
                        {r.classes < 3
                          ? "Needs more data"
                          : r.avgFill >= 0.85
                            ? "High demand"
                            : r.avgFill >= 0.5
                              ? "Comfortably used"
                              : "Underused"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Instructors */}
          <section>
            <SectionHeader title="Instructors" eyebrow="Teaching performance" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
              {data.instructors.length === 0 ? (
                <div className="lg:col-span-3">
                  <EmptyState text="No instructor-led classes in this range, or instructors not yet assigned." />
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
                      <Stat label="Classes" value={String(i.classes)} />
                      <Stat label="Fill" value={pct(i.avgFill)} />
                      <Stat label="Attended" value={pct(i.attendanceRate)} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Members at risk */}
          <section>
            <SectionHeader
              title="Members"
              eyebrow="Retention & care"
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
                  label="Export members"
                />
              }
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-5 mt-6">
              <MetricCard label="Active" value={String(data.members.active)} />
              <MetricCard label="New" value={String(data.members.new)} />
              <MetricCard label="Inactive" value={String(data.members.inactive)} />
              <MetricCard label="First-timers" value={String(data.members.firstTimers)} />
              <MetricCard label="Low credits" value={String(data.members.lowCredits)} />
              <MetricCard label="Package expiring" value={String(data.members.expiringSoon)} />
            </div>
            <Panel title="Needs attention" tone="sand" className="mt-5">
              {data.members.atRisk.length === 0 ? (
                <EmptyState text="Every member is in a good place right now." />
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
                          <p className="text-[11px] uppercase tracking-[0.15em] text-slate mt-1 truncate">
                            {m.reasons.join(" · ") || "Check in"}
                          </p>
                          <p className="text-[11px] text-slate mt-1">
                            {m.remaining_credits} credits
                            {m.last_visit_at
                              ? ` · last visit ${new Date(m.last_visit_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                              : " · no visits yet"}
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                          {waHref && (
                            <a
                              href={waHref}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 border border-gold/40 rounded-[2px] text-[10px] uppercase tracking-[0.15em] text-navy hover:bg-gold/10"
                            >
                              Message
                            </a>
                          )}
                          <Link
                            to="/admin/members/$id"
                            params={{ id: m.id }}
                            className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.15em] text-navy hover:text-gold"
                          >
                            Open <ArrowRight className="h-3 w-3" />
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
              title="Packages"
              eyebrow="Plan performance"
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
                  label="Export packages"
                />
              }
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
              {data.packages.report.length === 0 ? (
                <div className="md:col-span-2">
                  <EmptyState text="No plans defined yet." />
                </div>
              ) : (
                data.packages.report.slice(0, 8).map((p) => (
                  <div key={p.id} className="editorial-card p-5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-display text-xl">{p.name}</p>
                      <span className="font-display text-2xl">{ils(p.revenue)}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                      <Stat label="Sales" value={String(p.sales)} />
                      <Stat label="Active" value={String(p.active)} />
                      <Stat label="Expiring" value={String(p.expiringSoon)} />
                    </div>
                  </div>
                ))
              )}
            </div>
            <Panel title="Package requests" className="mt-5">
              {Object.keys(data.packages.requestsByStatus).length === 0 ? (
                <EmptyState text="No package requests yet." />
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
              title="Waitlist demand"
              eyebrow="Where members want in"
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
                  label="Export waitlist"
                />
              }
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-5 mt-6">
              <MetricCard label="Total joins" value={String(data.waitlist.totalJoins)} />
              <MetricCard label="Offered" value={String(data.waitlist.byStatus["offered"] ?? 0)} />
              <MetricCard
                label="Promoted"
                value={String(data.waitlist.byStatus["promoted"] ?? 0)}
              />
              <MetricCard label="Conversion" value={pct(data.waitlist.conversionRate)} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
              <Panel title="Most waitlisted classes">
                {data.waitlist.topClasses.length === 0 ? (
                  <EmptyState text="No waitlist activity." />
                ) : (
                  <ul className="divide-y divide-gold/15">
                    {data.waitlist.topClasses.map((c) => (
                      <li key={c.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-display truncate">{c.title}</p>
                          <p className="text-[11px] text-slate">
                            {c.starts_at
                              ? new Date(c.starts_at).toLocaleDateString(undefined, {
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
              <Panel title="Frequent waitlisters">
                {data.waitlist.frequentMembers.length === 0 ? (
                  <EmptyState text="No repeat waitlisters." />
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
            <SectionHeader title="Communication" eyebrow="Messages generated" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-5 mt-6">
              <MetricCard
                label="Generated"
                value={String(data.communication.generated)}
                hint="Messages prepared"
              />
              <MetricCard
                label="Marked sent"
                value={String(data.communication.markedSent)}
                hint="Manually confirmed"
              />
              <MetricCard
                label="Templates used"
                value={String(Object.keys(data.communication.byTemplate).length)}
              />
              <MetricCard
                label="Trigger types"
                value={String(Object.keys(data.communication.byTrigger).length)}
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
              <Panel title="Most used templates">
                {Object.keys(data.communication.byTemplate).length === 0 ? (
                  <EmptyState text="No messages prepared in this range." />
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
              <Panel title="By trigger">
                {Object.keys(data.communication.byTrigger).length === 0 ? (
                  <EmptyState text="No tracked triggers yet." />
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
  const presets: { v: Preset; label: string }[] = [
    { v: "today", label: "Today" },
    { v: "week", label: "This week" },
    { v: "month", label: "This month" },
    { v: "last_month", label: "Last month" },
    { v: "custom", label: "Custom" },
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
              className={`shrink-0 px-3 py-1.5 border rounded-[2px] text-[11px] uppercase tracking-[0.16em] transition min-h-9 ${preset === p.v ? "bg-navy text-ivory border-navy" : "border-gold/40 text-navy hover:bg-gold/10"}`}
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
            className="px-2.5 py-1.5 border border-gold/40 rounded-[2px] text-xs bg-ivory min-h-9"
          />
          <span className="text-slate text-xs">→</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-2.5 py-1.5 border border-gold/40 rounded-[2px] text-xs bg-ivory min-h-9"
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
        <p className="eyebrow text-[10px]">{eyebrow}</p>
        <h2 className="font-display italic text-xl sm:text-2xl md:text-3xl mt-1 leading-[1.1]">
          {title}
        </h2>
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
  return (
    <div className={`editorial-card p-5 ${tone === "gold" ? "border-l-4 border-l-gold" : ""}`}>
      <p className="eyebrow text-[10px]">{label}</p>
      <p className="numeric-display text-3xl mt-2">{value}</p>
      {delta && (
        <p
          className={`mt-2 text-[11px] uppercase tracking-[0.15em] inline-flex items-center gap-1 ${delta.dir === "up" ? "text-navy" : delta.dir === "down" ? "text-slate" : "text-slate"}`}
        >
          {delta.dir === "up" ? (
            <TrendingUp className="h-3 w-3 text-gold" />
          ) : delta.dir === "down" ? (
            <TrendingDown className="h-3 w-3" />
          ) : (
            <Minus className="h-3 w-3" />
          )}
          {delta.pct.toFixed(0)}% {delta.dir === "flat" ? "flat" : "vs prev"}
        </p>
      )}
      {hint && !delta && <p className="text-[11px] text-slate mt-2">{hint}</p>}
      {hint && delta && <p className="text-[11px] text-slate mt-1">{hint}</p>}
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
      className={`editorial-panel p-4 sm:p-6 ${tone === "sand" ? "bg-[#E8DFD1]/30" : ""} ${className}`}
    >
      <header className="flex items-baseline justify-between gap-3 mb-4 sm:mb-5 pb-2 border-b border-gold/25">
        <h3 className="font-display italic text-lg sm:text-xl truncate">{title}</h3>
        <Sparkles className="h-3.5 w-3.5 text-gold/70 shrink-0" />
      </header>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="eyebrow text-[9px]">{label}</p>
      <p className="numeric-display text-lg mt-1">{value}</p>
    </div>
  );
}

function ClassRow({ c }: { c: any }) {
  return (
    <li className="py-2.5 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-display truncate">{c.title}</p>
        <p className="text-[11px] text-slate truncate">
          {new Date(c.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
          · {c.room ?? "—"} · {c.instructor ?? "—"}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-display text-lg">
          {c.booked}/{c.capacity}
        </p>
        <p className="text-[10px] uppercase tracking-[0.15em] text-slate">
          {(c.fill * 100).toFixed(0)}%
        </p>
      </div>
    </li>
  );
}

function InsightCard({ insight }: { insight: any }) {
  return (
    <div className="editorial-card p-5 border-l-4 border-l-gold bg-[#B7CCE6]/15">
      <p className="eyebrow text-[10px]">Insight</p>
      <h4 className="font-display italic text-xl mt-2">{insight.title}</h4>
      <p className="text-sm text-slate mt-2 leading-relaxed">{insight.body}</p>
      {insight.metric && <p className="numeric-display text-2xl mt-3">{insight.metric}</p>}
      {insight.action && (
        <Link
          to={insight.action.to}
          className="mt-4 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-navy hover:text-gold transition"
        >
          {insight.action.label} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function ExportButton({ onClick, label = "Export" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-3 py-1.5 border border-gold/40 rounded-[2px] text-[11px] uppercase tracking-[0.16em] text-navy hover:bg-gold/10 min-h-9 whitespace-nowrap"
    >
      <Download className="h-3 w-3" />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">CSV</span>
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-slate font-display italic py-6 text-center">{text}</p>;
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
