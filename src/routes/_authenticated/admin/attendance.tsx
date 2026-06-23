import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { todaysClasses, markAttendance } from "@/lib/admin.functions";
import { getClassRoster } from "@/lib/members.functions";
import { useMemo, useState } from "react";
import { Empty, SectionTitle } from "@/components/admin-shared";
import {
  CheckCircle2,
  Clock,
  XCircle,
  ArrowLeft,
  Search,
  AlertTriangle,
  Sparkles,
  Phone,
} from "lucide-react";
import { labelForStatus, t, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/attendance")({
  head: () => ({ meta: [{ title: "נוכחות — Studio Admin" }] }),
  component: Page,
});

function Page() {
  useI18n();
  const [openId, setOpenId] = useState<string | null>(null);
  if (openId) return <CheckInScreen classId={openId} onBack={() => setOpenId(null)} />;
  return <ClassesList onOpen={setOpenId} />;
}

function ClassesList({ onOpen }: { onOpen: (id: string) => void }) {
  const fn = useServerFn(todaysClasses);
  const { data, isLoading } = useQuery({ queryKey: ["admin-today"], queryFn: () => fn() });

  return (
    <div className="space-y-6">
      <SectionTitle>{t("attendance.today")}</SectionTitle>
      <p className="text-sm text-slate max-w-xl leading-relaxed">{t("attendance.help")}</p>
      {isLoading && <div className="h-40 editorial-panel animate-pulse" />}
      {!isLoading && (data?.length ?? 0) === 0 && <Empty>{t("attendance.noneToday")}</Empty>}
      <div className="grid sm:grid-cols-2 gap-3">
        {(data ?? []).map((c: any) => (
          <ClassCard key={c.id} c={c} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function ClassCard({ c, onOpen }: { c: any; onOpen: (id: string) => void }) {
  const d = new Date(c.starts_at);
  return (
    <button
      onClick={() => onOpen(c.id)}
      className="editorial-card hover:editorial-card-hover p-5 text-left flex items-center gap-5"
    >
      <div className="text-center pr-5 border-r border-gold/25 shrink-0">
        <p className="font-display text-3xl leading-none font-light text-navy">
          {d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
        </p>
        <p className="text-[10px] uppercase tracking-[0.18em] text-slate mt-1.5">
          {c.duration_minutes}m
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg text-navy truncate">{c.title}</p>
        <p className="text-[11px] uppercase tracking-[0.15em] text-slate mt-1 truncate">
          {c.room} · {c.instructor?.name ?? t("common.unassigned")}
        </p>
        <div className="flex gap-2 mt-3">
          <span className="text-[11px] uppercase tracking-[0.15em] text-slate px-2 py-1 border border-gold/30 rounded-[2px]">
            {c.booked_count}/{c.capacity}
          </span>
          {c.waitlist_count > 0 && (
            <span className="text-[11px] uppercase tracking-[0.15em] text-slate px-2 py-1 border border-gold/30 rounded-[2px]">
              {c.waitlist_count} {t("common.waiting")}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function CheckInScreen({ classId, onBack }: { classId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const rosterFn = useServerFn(getClassRoster);
  const markFn = useServerFn(markAttendance);
  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["kiosk-roster", classId],
    queryFn: () => rosterFn({ data: { classId } }),
  });

  const mark = useMutation({
    mutationFn: (v: { bookingId: string; status: any }) => markFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kiosk-roster", classId] }),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data?.bookings ?? [];
    return (data?.bookings ?? []).filter(
      (b: any) =>
        (b.member?.name ?? "").toLowerCase().includes(q) ||
        (b.member?.phone ?? "").toLowerCase().includes(q),
    );
  }, [data, query]);

  if (isLoading || !data?.class) return <div className="h-40 editorial-panel animate-pulse" />;
  const c = data.class as any;
  const start = new Date(c.starts_at);
  const totalBooked = data.bookings.filter((b: any) => b.status === "booked").length;

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-slate hover:text-navy"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t("attendance.allSessions")}
      </button>

      <div className="editorial-panel p-6">
        <p className="eyebrow text-[10px]">{t("attendance.checkIn")}</p>
        <h2 className="font-display text-3xl font-light text-navy mt-2">{c.title}</h2>
        <p className="text-sm text-slate mt-1">
          {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} ·{" "}
          {c.room_obj?.name ?? c.room} · {c.instructor?.name ?? t("common.unassigned")}
        </p>
        <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-gold/20 text-center">
          <KStat label={t("attendance.booked")} value={totalBooked} />
          <KStat label={t("attendance.checkedIn")} value={data.checked_in_count} />
          <KStat label={t("common.capacity")} value={c.capacity} />
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate" />
        <input
          autoFocus
          className="editorial-input pl-11 text-base"
          placeholder={t("attendance.search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 && <Empty>{t("attendance.noMatch")}</Empty>}

      <div className="space-y-2">
        {filtered.map((b: any) => (
          <KioskRow key={b.id} b={b} onMark={(s) => mark.mutate({ bookingId: b.id, status: s })} />
        ))}
      </div>
    </div>
  );
}

function KStat({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="font-display text-3xl font-light text-navy">{value}</p>
      <p className="eyebrow text-[10px] mt-1">{label}</p>
    </div>
  );
}

function KioskRow({ b, onMark }: { b: any; onMark: (s: string) => void }) {
  const m = b.member ?? {};
  const st = b.attendance_state;
  const checked = st === "checked_in" || st === "attended";
  return (
    <div className={`editorial-card p-4 ${checked ? "bg-gold/5" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg text-navy truncate">{m.name}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="text-[11px] uppercase tracking-[0.15em] text-slate">
              {m.remaining_credits ?? 0} {t("common.credits")}
            </span>
            {m.phone && (
              <span className="text-[11px] text-slate inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {m.phone}
              </span>
            )}
            {m.is_first_timer && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] text-gold border border-gold/40 px-1.5 py-0.5 rounded-[2px]">
                <Sparkles className="h-2.5 w-2.5" /> {t("roster.first")}
              </span>
            )}
            {m.active_plan && (
              <span className="text-[10px] uppercase tracking-[0.15em] text-slate border border-gold/30 px-1.5 py-0.5 rounded-[2px]">
                {m.active_plan.name}
              </span>
            )}
            {m.has_care_notes && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] text-navy border border-gold/50 bg-gold/10 px-1.5 py-0.5 rounded-[2px]">
                <AlertTriangle className="h-2.5 w-2.5" /> {t("roster.care")}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4">
        <KioskBtn active={st === "checked_in"} primary onClick={() => onMark("checked_in")}>
          <Clock className="h-4 w-4" /> {t("attendance.present")}
        </KioskBtn>
        <KioskBtn active={st === "attended"} onClick={() => onMark("attended")}>
          <CheckCircle2 className="h-4 w-4" /> {t("attendance.attended")}
        </KioskBtn>
        <KioskBtn active={st === "no_show"} onClick={() => onMark("no_show")}>
          <XCircle className="h-4 w-4" /> {t("attendance.noShow")}
        </KioskBtn>
      </div>
    </div>
  );
}

function KioskBtn({
  active,
  primary,
  onClick,
  children,
}: {
  active?: boolean;
  primary?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 py-3 text-[11px] uppercase tracking-[0.15em] rounded-[2px] border transition-colors";
  const cls = active
    ? "bg-navy border-navy text-ivory"
    : primary
      ? "border-gold text-navy bg-gold/10 hover:bg-gold/20"
      : "border-gold/25 text-slate hover:border-gold hover:text-navy";
  return (
    <button onClick={onClick} className={`${base} ${cls}`}>
      {children}
    </button>
  );
}
