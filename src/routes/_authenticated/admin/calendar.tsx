import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect, useRef } from "react";
import { calendarRange } from "@/lib/calendar.functions";
import { AdminPageShell, AdminPageHeader, AdminMetricCard, Empty } from "@/components/admin-shared";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  UserPlus,
  Lock,
  ClipboardCheck,
  Calendar as CalIcon,
  Users,
  Clock,
  Sparkles,
  MapPin,
  AlertCircle,
} from "lucide-react";
import { ClassRosterDrawer } from "@/components/admin/ClassRosterDrawer";
import { getLocale, t, useI18n, type Lang } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { localizedClassTitle, localizedInstructorName } from "@/lib/localized-content";

export const Route = createFileRoute("/_authenticated/admin/calendar")({
  component: CalendarPage,
});

type ViewMode = "day" | "week";

function startOfWeek(d: Date) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const dow = (out.getDay() + 6) % 7; // Monday-first
  out.setDate(out.getDate() - dow);
  return out;
}
function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtDate(d: Date, opts: Intl.DateTimeFormatOptions) {
  return d.toLocaleDateString(getLocale(), opts);
}

function classCountLabel(count: number) {
  return t("calendar.classCount", { count });
}

function localizedRoomName(name: string | null | undefined, lang: Lang) {
  if (!name) return "—";
  const normalized = name.trim();
  const aliases: Record<string, Record<Lang, string>> = {
    "Cloud Studio": { en: "Cloud Studio", he: "סטודיו קלאוד", ar: "استوديو كلاود" },
    "E2E Studio": { en: "E2E Studio", he: "סטודיו E2E", ar: "استوديو E2E" },
  };
  return aliases[normalized]?.[lang] ?? normalized;
}

function classMeta(cls: any, lang: Lang, room?: any) {
  const normalizedClass = cls.program_type ? cls : { ...cls, program_type: cls.program };
  return {
    title: localizedClassTitle(normalizedClass, lang),
    room: localizedRoomName(room?.name ?? cls.room_ref?.name ?? cls.room, lang),
    instructor: cls.instructor?.name
      ? localizedInstructorName(cls.instructor.name, lang)
      : t("common.unassigned"),
  };
}

function CalendarPage() {
  useDocumentTitle("page.calendar.title");
  useI18n();
  const fn = useServerFn(calendarRange);
  const [view, setView] = useState<ViewMode>("week");
  const [openClassId, setOpenClassId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const range = useMemo(() => {
    const from = view === "day" ? new Date(anchor) : startOfWeek(anchor);
    const days = view === "day" ? 1 : 7;
    const to = new Date(from);
    to.setDate(to.getDate() + days);
    to.setMilliseconds(-1);
    return { from, to, days };
  }, [view, anchor]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-calendar", view, range.from.toISOString()],
    queryFn: () =>
      fn({ data: { fromIso: range.from.toISOString(), toIso: range.to.toISOString() } }),
  });

  const rooms = useMemo(() => data?.rooms ?? [], [data?.rooms]);
  const classes = useMemo(() => data?.classes ?? [], [data?.classes]);

  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < range.days; i++) {
      const d = new Date(range.from);
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [range]);

  // KPI mini-strip — anchored on the selected day (in day view) or today (in week view).
  const kpiDate = useMemo(
    () => (view === "day" ? anchor : new Date(new Date().setHours(0, 0, 0, 0))),
    [view, anchor],
  );
  const dayClasses = useMemo(
    () =>
      classes.filter(
        (c: any) => sameDay(new Date(c.starts_at), kpiDate) && c.status !== "cancelled",
      ),
    [classes, kpiDate],
  );
  const kpi = useMemo(() => {
    const bookedSpots = dayClasses.reduce((acc: number, c: any) => acc + (c.booked_count ?? 0), 0);
    const waiting = dayClasses.reduce((acc: number, c: any) => acc + (c.waitlist_count ?? 0), 0);
    const roomsInUse = new Set(dayClasses.map((c: any) => c.room_id ?? c.room)).size;
    return { classes: dayClasses.length, bookedSpots, waiting, roomsInUse };
  }, [dayClasses]);

  function shift(deltaDays: number) {
    const d = new Date(anchor);
    d.setDate(d.getDate() + deltaDays);
    setAnchor(d);
  }
  function today() {
    setAnchor(new Date(new Date().setHours(0, 0, 0, 0)));
  }

  const headerLabel =
    view === "day"
      ? fmtDate(anchor, { weekday: "long", month: "long", day: "numeric" })
      : t("calendar.weekOf", { date: fmtDate(range.from, { month: "long", day: "numeric" }) });
  const headerEyebrow = view === "day" ? t("calendar.dayView") : t("calendar.weekView");

  return (
    <AdminPageShell>
      {/* Editorial page header */}
      <AdminPageHeader
        eyebrow={headerEyebrow}
        title={headerLabel}
        action={
          <>
            <NavBtn onClick={() => shift(view === "day" ? -1 : -7)} aria-label={t("common.back")}>
              <ChevronLeft className="h-4 w-4 directional-icon-back" />
            </NavBtn>
            <button
              onClick={today}
              className="btn-outline inline-flex h-10 items-center px-4 text-xs hover:btn-outline-hover"
            >
              {t("common.today")}
            </button>
            <NavBtn onClick={() => shift(view === "day" ? 1 : 7)} aria-label={t("common.next")}>
              <ChevronRight className="h-4 w-4 directional-icon-forward" />
            </NavBtn>
            <div className="hidden sm:block h-6 w-px bg-gold/30 mx-1" />
            <QuickActions />
          </>
        }
        secondaryAction={<ViewToggle view={view} onChange={setView} />}
      />

      <div className="space-y-7 mt-6">
        {/* KPI strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <AdminMetricCard
            label={view === "day" ? t("calendar.classesToday") : t("calendar.todayClasses")}
            value={kpi.classes}
          />
          <AdminMetricCard label={t("calendar.bookedSpots")} value={kpi.bookedSpots} />
          <AdminMetricCard
            label={t("calendar.waitlistPressure")}
            value={kpi.waiting}
            accent={kpi.waiting > 0}
          />
          <AdminMetricCard
            label={t("calendar.roomsInUse")}
            value={`${kpi.roomsInUse}${rooms.length ? ` / ${rooms.length}` : ""}`}
          />
        </section>

        {/* Body */}
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isLoading ? (
          <CalendarSkeleton />
        ) : rooms.length === 0 ? (
          <Empty>
            {t("calendar.addRoomPrompt")}{" "}
            <Link to="/admin/rooms" className="underline underline-offset-4">
              {t("common.room")}
            </Link>{" "}
            {t("calendar.addRoomSuffix")}
          </Empty>
        ) : view === "day" ? (
          <DayLayout day={anchor} rooms={rooms} classes={classes} onOpen={setOpenClassId} />
        ) : (
          <WeekLayout
            days={days}
            rooms={rooms}
            classes={classes}
            onOpen={setOpenClassId}
            anchor={anchor}
            setAnchor={setAnchor}
          />
        )}

        {/* Room legend */}
        {rooms.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 border-t border-gold/20">
            <span className="eyebrow">{t("calendar.rooms")}</span>
            {rooms.map((r: any) => (
              <span key={r.id} className="inline-flex items-center gap-2 text-xs text-slate">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: r.color }}
                />
                <span className="truncate">
                  {localizedRoomName(r.name, getLocale() as Lang)}{" "}
                  <span className="text-slate/60">
                    · {t("calendar.capacityShort", { count: r.capacity })}
                  </span>
                </span>
              </span>
            ))}
          </div>
        )}

        <ClassRosterDrawer classId={openClassId} onClose={() => setOpenClassId(null)} />
      </div>
    </AdminPageShell>
  );
}

/* ============= Shared chrome ============= */

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const labels: Record<ViewMode, string> = {
    day: t("calendar.day"),
    week: t("calendar.week"),
  };
  return (
    <div className="inline-flex shrink-0 overflow-hidden rounded-full border border-gold/40 bg-ivory">
      {(["day", "week"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`h-10 px-4 text-xs font-medium transition ${
            view === v ? "bg-navy text-ivory" : "bg-ivory text-slate hover:text-navy/85"
          }`}
        >
          {labels[v]}
        </button>
      ))}
    </div>
  );
}

function NavBtn({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className="btn-outline inline-flex h-10 w-10 items-center justify-center p-0 hover:btn-outline-hover"
    >
      {children}
    </button>
  );
}

function QuickActions() {
  const items = [
    { to: "/admin/classes/new", icon: Plus, label: t("calendar.addClass") },
    { to: "/admin/classes/new", icon: UserPlus, label: t("calendar.privateSession") },
    { to: "/admin/rooms", icon: Lock, label: t("calendar.blockRoom") },
    { to: "/admin/attendance", icon: ClipboardCheck, label: t("nav.attendance") },
  ] as const;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((i) => (
        <Link
          key={i.label}
          to={i.to}
          className="btn-outline inline-flex h-10 items-center gap-1.5 bg-ivory px-3 text-xs hover:btn-outline-hover"
        >
          <i.icon className="h-3.5 w-3.5 text-gold" />{" "}
          <span className="hidden sm:inline">{i.label}</span>
        </Link>
      ))}
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="editorial-panel p-6 space-y-3">
      <div className="skeleton-brand h-6 w-40" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="skeleton-brand h-24" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="editorial-panel p-10 text-center space-y-4">
      <AlertCircle className="h-6 w-6 text-gold mx-auto" />
      <p className="font-display text-xl text-navy">{t("calendar.loadErrorTitle")}</p>
      <p className="text-sm text-slate">{t("calendar.loadErrorBody")}</p>
      <button onClick={onRetry} className="btn-navy mx-auto hover:btn-navy-hover">
        {t("common.retry")}
      </button>
    </div>
  );
}

/* ============= Day view ============= */

function DayLayout(props: {
  day: Date;
  rooms: any[];
  classes: any[];
  onOpen: (id: string) => void;
}) {
  return (
    <>
      <div className="hidden md:block">
        <DayTimeline {...props} />
      </div>
      <div className="md:hidden">
        <DayAgenda {...props} />
      </div>
    </>
  );
}

function DayTimeline({
  day,
  rooms,
  classes,
  onOpen,
}: {
  day: Date;
  rooms: any[];
  classes: any[];
  onOpen: (id: string) => void;
}) {
  const HOUR_PX = 60;
  const startHour = 6;
  const endHour = 22;
  const totalHours = endHour - startHour;

  // current-time indicator
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const showNow = sameDay(now, day) && now.getHours() >= startHour && now.getHours() < endHour;
  const nowTop = showNow
    ? (((now.getHours() - startHour) * 60 + now.getMinutes()) / 60) * HOUR_PX
    : 0;

  function itemsFor(room: any) {
    return classes.filter(
      (c: any) =>
        sameDay(new Date(c.starts_at), day) &&
        (c.room_id === room.id || (!c.room_id && c.room === room.name)),
    );
  }

  return (
    <div className="editorial-panel p-0 overflow-x-auto">
      <div
        className="grid"
        style={{ gridTemplateColumns: `72px repeat(${rooms.length}, minmax(200px, 1fr))` }}
      >
        {/* Header row */}
        <div className="sticky top-0 z-10 bg-ivory border-b border-gold/25" />
        {rooms.map((r) => (
          <div
            key={r.id}
            className="sticky top-0 z-10 bg-ivory border-b border-gold/25 px-4 py-3"
            style={{ boxShadow: `inset 0 3px 0 ${r.color}` }}
          >
            <p className="font-display text-base text-navy truncate leading-tight">
              {localizedRoomName(r.name, getLocale() as Lang)}
            </p>
            <p className="mt-0.5 text-xs font-medium text-slate">
              {t("calendar.capacityShort", { count: r.capacity })}
            </p>
          </div>
        ))}

        {/* Hour rail */}
        <div className="relative bg-[rgba(232,223,209,0.18)]">
          {Array.from({ length: totalHours }).map((_, i) => (
            <div
              key={i}
              className="border-t border-gold/15 ps-2 pt-1 text-xs font-medium text-slate"
              style={{ height: HOUR_PX }}
            >
              {String(startHour + i).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {/* Room lanes */}
        {rooms.map((r) => (
          <div
            key={r.id}
            className="relative border-s border-gold/15"
            style={{ height: HOUR_PX * totalHours }}
          >
            {Array.from({ length: totalHours }).map((_, i) => (
              <div key={i} className="border-t border-gold/10" style={{ height: HOUR_PX }} />
            ))}
            {/* Now line */}
            {showNow && (
              <div className="absolute inset-x-0 z-20 pointer-events-none" style={{ top: nowTop }}>
                <div className="h-px bg-gold relative">
                  <span className="absolute -start-1 -top-1 h-2 w-2 rounded-full bg-gold" />
                </div>
              </div>
            )}
            {itemsFor(r).map((c: any) => {
              const start = new Date(c.starts_at);
              const meta = classMeta(c, getLocale() as Lang, r);
              const offsetMin = (start.getHours() - startHour) * 60 + start.getMinutes();
              const top = (offsetMin / 60) * HOUR_PX;
              const height = Math.max(38, (c.duration_minutes / 60) * HOUR_PX - 4);
              return (
                <button
                  key={c.id}
                  onClick={() => onOpen(c.id)}
                  className="absolute inset-x-1.5 rounded-[4px] px-3 py-2 text-start overflow-hidden bg-white border border-gold/30 hover:border-gold transition-shadow shadow-[0_1px_0_rgba(11,29,58,0.04)] hover:shadow-[0_6px_18px_-8px_rgba(11,29,58,0.18)]"
                  style={{ top, height, borderInlineStart: `3px solid ${r.color}` }}
                  aria-label={`${meta.title} ${fmtTime(start)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-[14px] leading-tight text-navy truncate flex-1">
                      {meta.title}
                    </p>
                    <StatusBadge cls={c} />
                  </div>
                  <p className="mt-1 truncate text-xs font-medium text-slate">
                    {fmtTime(start)} · {meta.instructor} · {c.booked_count}/{c.capacity}
                    {c.waitlist_count > 0 ? ` · +${c.waitlist_count}` : ""}
                  </p>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayAgenda({
  day,
  rooms,
  classes,
  onOpen,
}: {
  day: Date;
  rooms: any[];
  classes: any[];
  onOpen: (id: string) => void;
}) {
  const items = useMemo(
    () =>
      classes
        .filter((c: any) => sameDay(new Date(c.starts_at), day))
        .sort((a: any, b: any) => +new Date(a.starts_at) - +new Date(b.starts_at)),
    [classes, day],
  );

  const buckets: { label: string; items: any[] }[] = [
    { label: t("calendar.morning"), items: [] },
    { label: t("calendar.afternoon"), items: [] },
    { label: t("calendar.evening"), items: [] },
  ];
  items.forEach((c: any) => {
    const h = new Date(c.starts_at).getHours();
    if (h < 12) buckets[0].items.push(c);
    else if (h < 17) buckets[1].items.push(c);
    else buckets[2].items.push(c);
  });

  const roomById: Record<string, any> = {};
  rooms.forEach((r: any) => {
    roomById[r.id] = r;
  });

  if (items.length === 0) return <EmptyDay />;

  return (
    <div className="space-y-7">
      {buckets
        .filter((b) => b.items.length)
        .map((b) => (
          <div key={b.label} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-xl text-navy">{b.label}</h3>
              <span className="text-xs font-medium text-slate">
                {classCountLabel(b.items.length)}
              </span>
            </div>
            <div className="space-y-2.5">
              {b.items.map((c: any) => (
                <AgendaCard
                  key={c.id}
                  cls={c}
                  room={roomById[c.room_id]}
                  onOpen={() => onOpen(c.id)}
                />
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

function AgendaCard({ cls, room, onOpen }: { cls: any; room: any; onOpen: () => void }) {
  const start = new Date(cls.starts_at);
  const color = room?.color ?? cls.program?.color ?? "#D4AF6A";
  const meta = classMeta(cls, getLocale() as Lang, room);
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-4 rounded-xl border border-gold/30 bg-white p-4 text-start shadow-[0_1px_0_rgba(11,29,58,0.04)] transition-shadow hover:border-gold hover:shadow-[0_8px_22px_-10px_rgba(11,29,58,0.18)]"
      style={{ borderInlineStart: `4px solid ${color}` }}
    >
      <div className="text-end pe-4 border-e border-gold/25 min-w-[64px]">
        <p className="font-display text-xl text-navy leading-none">{fmtTime(start)}</p>
        <p className="mt-1 text-xs font-medium text-slate">
          {cls.duration_minutes}
          {t("common.minutes")}
        </p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-lg text-navy leading-tight truncate">{meta.title}</p>
          <StatusBadge cls={cls} />
        </div>
        <p className="mt-1 truncate text-xs font-medium text-slate">
          {meta.room} · {meta.instructor}
        </p>
        <p className="mt-1.5 flex items-center gap-3 text-xs text-slate">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3 text-gold" />
            {cls.booked_count}/{cls.capacity}
          </span>
          {cls.waitlist_count > 0 && (
            <span className="inline-flex items-center gap-1 text-navy">
              <Clock className="h-3 w-3 text-gold" />
              {t("calendar.waitingCount", { count: cls.waitlist_count })}
            </span>
          )}
        </p>
      </div>
    </button>
  );
}

function EmptyDay() {
  return (
    <div className="editorial-panel p-10 text-center space-y-3">
      <Sparkles className="h-5 w-5 text-gold mx-auto" />
      <p className="font-display text-xl text-navy">{t("calendar.emptyDayTitle")}</p>
      <p className="text-sm text-slate">{t("calendar.emptyDayBody")}</p>
    </div>
  );
}

/* ============= Week view ============= */

function WeekLayout(props: {
  days: Date[];
  rooms: any[];
  classes: any[];
  onOpen: (id: string) => void;
  anchor: Date;
  setAnchor: (d: Date) => void;
}) {
  return (
    <>
      <div className="hidden md:block">
        <WeekDesktop {...props} />
      </div>
      <div className="md:hidden">
        <WeekMobile {...props} />
      </div>
    </>
  );
}

function WeekDesktop({
  days,
  classes,
  onOpen,
}: {
  days: Date[];
  rooms: any[];
  classes: any[];
  onOpen: (id: string) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    <div className="editorial-panel p-0 overflow-x-auto">
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(170px, 1fr))` }}
      >
        {days.map((d) => {
          const items = classes
            .filter((c: any) => sameDay(new Date(c.starts_at), d))
            .sort((a: any, b: any) => +new Date(a.starts_at) - +new Date(b.starts_at));
          const booked = items.reduce((a: number, c: any) => a + (c.booked_count ?? 0), 0);
          const cap = items.reduce((a: number, c: any) => a + (c.capacity ?? 0), 0);
          const pressure = cap === 0 ? 0 : Math.round((booked / cap) * 100);
          const isToday = sameDay(d, today);
          return (
            <div key={+d} className="border-s border-gold/15 first:border-s-0 min-h-[24rem]">
              <div
                className={`px-3 py-3 border-b border-gold/25 ${isToday ? "bg-[rgba(212,175,106,0.10)]" : ""}`}
              >
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate">
                      {fmtDate(d, { weekday: "short" })}
                    </p>
                    <p
                      className={`font-display text-2xl leading-none mt-1 ${isToday ? "text-navy" : "text-navy/85"}`}
                    >
                      {d.getDate()}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-xs font-medium text-slate">
                      {classCountLabel(items.length)}
                    </p>
                    {cap > 0 && (
                      <div className="mt-1.5 h-1 w-16 bg-sand rounded-full overflow-hidden ms-auto">
                        <div
                          className="h-full bg-gold"
                          style={{ width: `${Math.min(100, pressure)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-2 space-y-1.5">
                {items.length === 0 ? (
                  <p className="py-6 text-xs text-slate/60 italic text-center">—</p>
                ) : (
                  items.map((c: any) => (
                    <WeekBlock key={c.id} cls={c} onOpen={() => onOpen(c.id)} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekBlock({ cls, onOpen }: { cls: any; onOpen: () => void }) {
  const start = new Date(cls.starts_at);
  const color = cls.program?.color ?? "#D4AF6A";
  const meta = classMeta(cls, getLocale() as Lang);
  return (
    <button
      onClick={onOpen}
      className="w-full text-start bg-white border border-gold/25 hover:border-gold rounded-[4px] px-2.5 py-2 transition-shadow hover:shadow-[0_4px_14px_-6px_rgba(11,29,58,0.18)]"
      style={{ borderInlineStart: `3px solid ${color}` }}
    >
      <div className="flex items-center justify-between gap-1">
        <p className="text-xs font-medium text-slate">{fmtTime(start)}</p>
        <StatusBadge cls={cls} compact />
      </div>
      <p className="font-display text-[13px] leading-tight text-navy mt-0.5 line-clamp-2">
        {meta.title}
      </p>
      <p className="mt-0.5 truncate text-xs text-slate">
        {meta.room} · {cls.booked_count}/{cls.capacity}
        {cls.waitlist_count > 0 ? ` · +${cls.waitlist_count}` : ""}
      </p>
    </button>
  );
}

function WeekMobile({
  days,
  classes,
  rooms,
  onOpen,
  anchor,
  setAnchor,
}: {
  days: Date[];
  classes: any[];
  rooms: any[];
  onOpen: (id: string) => void;
  anchor: Date;
  setAnchor: (d: Date) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = days.find((d) => sameDay(d, anchor)) ?? days[0];
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // ensure selected chip is visible
    const el = stripRef.current?.querySelector<HTMLButtonElement>("[data-active='true']");
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [anchor]);

  return (
    <div className="space-y-5">
      <div ref={stripRef} className="-mx-5 px-5 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 min-w-max">
          {days.map((d) => {
            const isSelected = sameDay(d, selected);
            const isToday = sameDay(d, today);
            const count = classes.filter((c: any) => sameDay(new Date(c.starts_at), d)).length;
            return (
              <button
                key={+d}
                data-active={isSelected ? "true" : "false"}
                onClick={() => setAnchor(new Date(d))}
                className={`shrink-0 min-w-[64px] py-2.5 px-3 rounded-[4px] border transition text-center ${
                  isSelected
                    ? "bg-navy text-ivory border-navy"
                    : isToday
                      ? "bg-gold/10 border-gold text-navy"
                      : "bg-white border-gold/30 text-navy hover:border-gold"
                }`}
              >
                <p className={`text-xs font-medium ${isSelected ? "text-ivory/80" : "text-slate"}`}>
                  {fmtDate(d, { weekday: "short" })}
                </p>
                <p className="font-display text-xl leading-none mt-1">{d.getDate()}</p>
                <p
                  className={`mt-1 text-xs font-medium ${isSelected ? "text-ivory/70" : "text-slate"}`}
                >
                  {count}
                </p>
              </button>
            );
          })}
        </div>
      </div>
      <DayAgenda day={selected} rooms={rooms} classes={classes} onOpen={onOpen} />
    </div>
  );
}

/* ============= Status badge ============= */

function StatusBadge({ cls, compact = false }: { cls: any; compact?: boolean }) {
  let label = t("common.open");
  let cls2 = "border-gold/40 text-navy bg-white";
  if (cls.status === "cancelled") {
    label = t("state.cancelled");
    cls2 = "border-slate/30 text-slate bg-sand line-through decoration-slate/50";
  } else if (cls.status === "closed") {
    label = t("state.closed");
    cls2 = "border-slate/30 text-slate bg-sand";
  } else if (cls.booked_count >= cls.capacity) {
    if (cls.waitlist_count > 0) {
      label = t("roster.waitlist");
      cls2 = "border-gold text-navy bg-gold/15";
    } else {
      label = t("common.full");
      cls2 = "bg-navy text-ivory border-navy";
    }
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border font-medium ${compact ? "px-1.5 py-0 text-xs" : "px-2 py-0.5 text-xs"} ${cls2}`}
    >
      {label}
    </span>
  );
}
