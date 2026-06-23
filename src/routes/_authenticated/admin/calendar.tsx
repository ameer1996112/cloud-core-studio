import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect, useRef } from "react";
import { calendarRange } from "@/lib/calendar.functions";
import { Empty } from "@/components/admin-shared";
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

export const Route = createFileRoute("/_authenticated/admin/calendar")({
  head: () => ({ meta: [{ title: "Calendar — Studio Admin" }] }),
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
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function CalendarPage() {
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

  const rooms = data?.rooms ?? [];
  const classes = data?.classes ?? [];

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
      ? anchor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
      : `Week of ${range.from.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`;
  const headerEyebrow = view === "day" ? "Day view" : "Week view";

  return (
    <div className="space-y-7">
      {/* Editorial page header */}
      <header className="space-y-5 pb-5 border-b border-gold/25">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div className="min-w-0">
            <p className="eyebrow text-[10px]">{headerEyebrow}</p>
            <h2 className="font-display italic text-2xl sm:text-3xl mt-1.5 text-navy truncate">
              {headerLabel}
            </h2>
          </div>
          <ViewToggle view={view} onChange={setView} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NavBtn onClick={() => shift(view === "day" ? -1 : -7)} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </NavBtn>
          <button
            onClick={today}
            className="h-10 px-4 inline-flex items-center text-[11px] uppercase tracking-[0.2em] border border-gold/40 rounded-[2px] text-navy hover:bg-gold/10"
          >
            Today
          </button>
          <NavBtn onClick={() => shift(view === "day" ? 1 : 7)} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </NavBtn>
          <div className="hidden sm:block h-6 w-px bg-gold/30 mx-1" />
          <QuickActions />
        </div>
      </header>

      {/* KPI strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          icon={CalIcon}
          label={view === "day" ? "Classes today" : "Today · classes"}
          value={kpi.classes}
        />
        <Kpi icon={Users} label="Booked spots" value={kpi.bookedSpots} />
        <Kpi
          icon={Clock}
          label="Waitlist pressure"
          value={kpi.waiting}
          tone={kpi.waiting > 0 ? "gold" : "default"}
        />
        <Kpi
          icon={MapPin}
          label="Rooms in use"
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
          Add at least one room from{" "}
          <Link to="/admin/rooms" className="underline underline-offset-4">
            Rooms
          </Link>{" "}
          to see the calendar.
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
          <span className="eyebrow text-[10px]">Rooms</span>
          {rooms.map((r: any) => (
            <span key={r.id} className="inline-flex items-center gap-2 text-[11px] text-slate">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: r.color }} />
              <span className="truncate">
                {r.name} <span className="text-slate/60">· cap {r.capacity}</span>
              </span>
            </span>
          ))}
        </div>
      )}

      <ClassRosterDrawer classId={openClassId} onClose={() => setOpenClassId(null)} />
    </div>
  );
}

/* ============= Shared chrome ============= */

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex border border-gold/40 rounded-[2px] overflow-hidden shrink-0">
      {(["day", "week"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-3.5 h-10 text-[11px] uppercase tracking-[0.2em] transition ${
            view === v ? "bg-navy text-ivory" : "text-slate hover:text-navy bg-ivory"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function NavBtn({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className="h-10 w-10 inline-flex items-center justify-center border border-gold/40 rounded-[2px] text-navy hover:bg-gold/10"
    >
      {children}
    </button>
  );
}

function QuickActions() {
  const items = [
    { to: "/admin/classes/new", icon: Plus, label: "Add class" },
    { to: "/admin/classes/new", icon: UserPlus, label: "Private session" },
    { to: "/admin/rooms", icon: Lock, label: "Block room time" },
    { to: "/admin/attendance", icon: ClipboardCheck, label: "Attendance" },
  ] as const;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((i) => (
        <Link
          key={i.label}
          to={i.to}
          className="inline-flex items-center gap-1.5 h-10 px-3 border border-gold/30 rounded-[2px] text-[11px] uppercase tracking-[0.18em] text-navy bg-ivory hover:bg-gold/10"
        >
          <i.icon className="h-3.5 w-3.5 text-gold" />{" "}
          <span className="hidden sm:inline">{i.label}</span>
        </Link>
      ))}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: any;
  label: string;
  value: React.ReactNode;
  tone?: "default" | "gold";
}) {
  return (
    <div
      className={`editorial-card px-4 py-3.5 sm:p-5 ${tone === "gold" ? "border-l-4 border-l-gold" : ""}`}
    >
      <div className="flex items-center justify-between">
        <p className="eyebrow text-[9px] sm:text-[10px] truncate">{label}</p>
        <Icon className="h-3.5 w-3.5 text-gold/70 shrink-0" />
      </div>
      <p className="numeric-display mt-2 text-2xl sm:text-3xl">{value}</p>
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
      <p className="font-display italic text-xl text-navy">The calendar couldn't load.</p>
      <p className="text-sm text-slate">Check your connection, then try again.</p>
      <button onClick={onRetry} className="btn-navy mx-auto hover:btn-navy-hover">
        Retry
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
            <p className="font-display text-base text-navy truncate leading-tight">{r.name}</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate mt-0.5">
              Cap {r.capacity}
            </p>
          </div>
        ))}

        {/* Hour rail */}
        <div className="relative bg-[rgba(232,223,209,0.18)]">
          {Array.from({ length: totalHours }).map((_, i) => (
            <div
              key={i}
              className="text-[10px] uppercase tracking-[0.18em] text-slate pl-2 pt-1 border-t border-gold/15"
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
            className="relative border-l border-gold/15"
            style={{ height: HOUR_PX * totalHours }}
          >
            {Array.from({ length: totalHours }).map((_, i) => (
              <div key={i} className="border-t border-gold/10" style={{ height: HOUR_PX }} />
            ))}
            {/* Now line */}
            {showNow && (
              <div className="absolute inset-x-0 z-20 pointer-events-none" style={{ top: nowTop }}>
                <div className="h-px bg-gold relative">
                  <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-gold" />
                </div>
              </div>
            )}
            {itemsFor(r).map((c: any) => {
              const start = new Date(c.starts_at);
              const offsetMin = (start.getHours() - startHour) * 60 + start.getMinutes();
              const top = (offsetMin / 60) * HOUR_PX;
              const height = Math.max(38, (c.duration_minutes / 60) * HOUR_PX - 4);
              return (
                <button
                  key={c.id}
                  onClick={() => onOpen(c.id)}
                  className="absolute inset-x-1.5 rounded-[4px] px-3 py-2 text-left overflow-hidden bg-white border border-gold/30 hover:border-gold transition-shadow shadow-[0_1px_0_rgba(11,29,58,0.04)] hover:shadow-[0_6px_18px_-8px_rgba(11,29,58,0.18)]"
                  style={{ top, height, borderLeft: `3px solid ${r.color}` }}
                  aria-label={`${c.title} at ${fmtTime(start)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-[14px] leading-tight text-navy truncate flex-1">
                      {c.title}
                    </p>
                    <StatusBadge cls={c} />
                  </div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate mt-1 truncate">
                    {fmtTime(start)} · {c.instructor?.name ?? "—"} · {c.booked_count}/{c.capacity}
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
    { label: "Morning", items: [] },
    { label: "Afternoon", items: [] },
    { label: "Evening", items: [] },
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
              <h3 className="font-display italic text-xl text-navy">{b.label}</h3>
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate">
                {b.items.length} class{b.items.length === 1 ? "" : "es"}
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
  return (
    <button
      onClick={onOpen}
      className="w-full text-left bg-white border border-gold/30 hover:border-gold rounded-[6px] p-4 flex gap-4 items-center transition-shadow shadow-[0_1px_0_rgba(11,29,58,0.04)] hover:shadow-[0_8px_22px_-10px_rgba(11,29,58,0.18)]"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div className="text-right pr-4 border-r border-gold/25 min-w-[64px]">
        <p className="font-display text-xl text-navy leading-none">{fmtTime(start)}</p>
        <p className="text-[10px] uppercase tracking-[0.18em] text-slate mt-1">
          {cls.duration_minutes}m
        </p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-lg text-navy leading-tight truncate">{cls.title}</p>
          <StatusBadge cls={cls} />
        </div>
        <p className="text-[11px] uppercase tracking-[0.15em] text-slate mt-1 truncate">
          {room?.name ?? cls.room ?? "—"} · {cls.instructor?.name ?? "Unassigned"}
        </p>
        <p className="text-[11px] text-slate mt-1.5 flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3 text-gold" />
            {cls.booked_count}/{cls.capacity}
          </span>
          {cls.waitlist_count > 0 && (
            <span className="inline-flex items-center gap-1 text-navy">
              <Clock className="h-3 w-3 text-gold" />
              {cls.waitlist_count} waiting
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
      <p className="font-display italic text-xl text-navy">A calm day at the studio.</p>
      <p className="text-sm text-slate">No classes scheduled. Use Add class to plan one.</p>
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
            <div key={+d} className="border-l border-gold/15 first:border-l-0 min-h-[24rem]">
              <div
                className={`px-3 py-3 border-b border-gold/25 ${isToday ? "bg-[rgba(212,175,106,0.10)]" : ""}`}
              >
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate">
                      {d.toLocaleDateString(undefined, { weekday: "short" })}
                    </p>
                    <p
                      className={`font-display text-2xl leading-none mt-1 ${isToday ? "text-navy" : "text-navy/85"}`}
                    >
                      {d.getDate()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate">
                      {items.length} {items.length === 1 ? "class" : "classes"}
                    </p>
                    {cap > 0 && (
                      <div className="mt-1.5 h-1 w-16 bg-sand rounded-full overflow-hidden ml-auto">
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
                  <p className="text-[10px] text-slate/60 italic text-center py-6">—</p>
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
  return (
    <button
      onClick={onOpen}
      className="w-full text-left bg-white border border-gold/25 hover:border-gold rounded-[4px] px-2.5 py-2 transition-shadow hover:shadow-[0_4px_14px_-6px_rgba(11,29,58,0.18)]"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-center justify-between gap-1">
        <p className="text-[10px] uppercase tracking-[0.16em] text-slate">{fmtTime(start)}</p>
        <StatusBadge cls={cls} compact />
      </div>
      <p className="font-display text-[13px] leading-tight text-navy mt-0.5 line-clamp-2">
        {cls.title}
      </p>
      <p className="text-[10px] text-slate mt-0.5 truncate">
        {cls.room} · {cls.booked_count}/{cls.capacity}
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
                <p
                  className={`text-[9px] uppercase tracking-[0.2em] ${isSelected ? "text-ivory/80" : "text-slate"}`}
                >
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </p>
                <p className="font-display text-xl leading-none mt-1">{d.getDate()}</p>
                <p
                  className={`text-[9px] uppercase tracking-[0.18em] mt-1 ${isSelected ? "text-ivory/70" : "text-slate"}`}
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
  let label = "Open";
  let cls2 = "border-gold/40 text-navy bg-white";
  if (cls.status === "cancelled") {
    label = "Cancelled";
    cls2 = "border-slate/30 text-slate bg-sand line-through decoration-slate/50";
  } else if (cls.status === "closed") {
    label = "Closed";
    cls2 = "border-slate/30 text-slate bg-sand";
  } else if (cls.booked_count >= cls.capacity) {
    if (cls.waitlist_count > 0) {
      label = "Waitlist";
      cls2 = "border-gold text-navy bg-gold/15";
    } else {
      label = "Full";
      cls2 = "bg-navy text-ivory border-navy";
    }
  }
  return (
    <span
      className={`inline-flex items-center shrink-0 rounded-[2px] border ${compact ? "px-1.5 py-0 text-[9px]" : "px-2 py-0.5 text-[10px]"} uppercase tracking-[0.14em] ${cls2}`}
    >
      {label}
    </span>
  );
}
