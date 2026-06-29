import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { todaysClasses, markAttendance } from "@/lib/admin.functions";
import { getClassRoster } from "@/lib/members.functions";
import { useMemo, useState } from "react";
import { AdminPageShell, AdminPageHeader, Empty } from "@/components/admin-shared";
import {
  CheckCircle2,
  Clock,
  XCircle,
  ArrowLeft,
  Search,
  AlertTriangle,
  Sparkles,
  Phone,
  Plus,
  CalendarDays,
} from "lucide-react";
import { labelForStatus, t, useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { getPlanDisplay } from "@/lib/planDisplay";
import {
  localizedClassTitle,
  localizedInstructorName,
  localizedRoomName,
} from "@/lib/localized-content";

export const Route = createFileRoute("/_authenticated/admin/attendance")({
  component: Page,
});

function Page() {
  const { lang } = useI18n();
  useDocumentTitle("page.attendance.title");
  const [openId, setOpenId] = useState<string | null>(null);
  if (openId) return <CheckInScreen classId={openId} onBack={() => setOpenId(null)} lang={lang} />;
  return <ClassesList onOpen={setOpenId} lang={lang} />;
}

function ClassesList({ onOpen, lang }: { onOpen: (id: string) => void; lang: "en" | "he" | "ar" }) {
  const fn = useServerFn(todaysClasses);
  const { data, isLoading } = useQuery({ queryKey: ["admin-today"], queryFn: () => fn() });
  const isRtl = lang === "he" || lang === "ar";
  const dir = isRtl ? "rtl" : "ltr";

  return (
    <AdminPageShell>
      <AdminPageHeader
        eyebrow={t("attendance.checkIn")}
        title={t("attendance.today")}
        description={t("attendance.help")}
      />

      {isLoading && <div className="h-40 editorial-panel animate-pulse" />}
      {!isLoading && (data?.length ?? 0) === 0 && (
        <Empty
          title={t("attendance.empty.title")}
          body={t("attendance.empty.body")}
          dir={dir}
          primaryAction={
            <Link to="/admin/classes/new" className="btn-navy hover:btn-navy-hover">
              <Plus className="h-4 w-4" />
              {t("attendance.empty.primary")}
            </Link>
          }
          secondaryAction={
            <Link to="/admin/schedule" className="btn-ghost">
              <CalendarDays className="h-4 w-4" />
              {t("attendance.empty.secondary")}
            </Link>
          }
        />
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {(data ?? []).map((c: any) => (
          <ClassCard key={c.id} c={c} onOpen={onOpen} lang={lang} />
        ))}
      </div>
    </AdminPageShell>
  );
}

function ClassCard({
  c,
  onOpen,
  lang,
}: {
  c: any;
  onOpen: (id: string) => void;
  lang: "en" | "he" | "ar";
}) {
  const { locale } = useI18n();
  const d = new Date(c.starts_at);
  return (
    <button
      onClick={() => onOpen(c.id)}
      className="editorial-card hover:editorial-card-hover p-5 text-start flex items-center gap-5"
    >
      <div className="text-center pe-5 border-e border-gold/25 shrink-0">
        <p className="numeric-display text-2xl leading-none text-navy">
          {d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}
        </p>
        <p className="mt-1.5 text-xs font-medium text-slate">{c.duration_minutes}m</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg text-navy truncate" dir="auto">
          <bdi>{localizedClassTitle(c, lang)}</bdi>
        </p>
        <p className="mt-1 truncate text-xs font-medium text-slate">
          {localizedRoomName(c.room, lang)} ·{" "}
          {c.instructor?.name
            ? localizedInstructorName(c.instructor.name, lang)
            : t("common.unassigned")}
        </p>
        <div className="flex gap-2 mt-3">
          <span className="rounded-full border border-gold/30 px-2.5 py-1 text-xs font-medium text-slate">
            {c.booked_count}/{c.capacity}
          </span>
          {c.waitlist_count > 0 && (
            <span className="rounded-full border border-gold/30 px-2.5 py-1 text-xs font-medium text-slate">
              {c.waitlist_count} {t("common.waiting")}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function CheckInScreen({
  classId,
  onBack,
  lang,
}: {
  classId: string;
  onBack: () => void;
  lang: "en" | "he" | "ar";
}) {
  const { locale } = useI18n();
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
    <AdminPageShell>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate transition-colors hover:text-navy"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t("attendance.allSessions")}
      </button>

      <div className="editorial-panel p-6">
        <p className="eyebrow">{t("attendance.checkIn")}</p>
        <h2 className="text-2xl sm:text-3xl font-semibold text-navy mt-2" dir="auto">
          <bdi>{localizedClassTitle(c, lang)}</bdi>
        </h2>
        <p className="text-sm text-slate mt-1">
          {start.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })} ·{" "}
          {localizedRoomName(c.room_obj?.name ?? c.room, lang)} ·{" "}
          {c.instructor?.name
            ? localizedInstructorName(c.instructor.name, lang)
            : t("common.unassigned")}
        </p>
        <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-gold/20 text-center">
          <KStat label={t("attendance.booked")} value={totalBooked} />
          <KStat label={t("attendance.checkedIn")} value={data.checked_in_count} />
          <KStat label={t("common.capacity")} value={c.capacity} />
        </div>
      </div>

      <div className="relative">
        <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate" />
        <input
          autoFocus
          className="editorial-input ps-11 text-base"
          placeholder={t("attendance.search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 && <Empty>{t("attendance.noMatch")}</Empty>}

      <div className="space-y-2">
        {filtered.map((b: any) => (
          <KioskRow
            key={b.id}
            b={b}
            lang={lang}
            onMark={(s) => mark.mutate({ bookingId: b.id, status: s })}
          />
        ))}
      </div>
    </AdminPageShell>
  );
}

function KStat({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="font-display text-3xl font-light text-navy">{value}</p>
      <p className="eyebrow mt-1">{label}</p>
    </div>
  );
}

function KioskRow({
  b,
  lang,
  onMark,
}: {
  b: any;
  lang: "en" | "he" | "ar";
  onMark: (s: string) => void;
}) {
  const m = b.member ?? {};
  const st = b.attendance_state;
  const checked = st === "checked_in" || st === "attended";
  return (
    <div className={`editorial-card p-4 ${checked ? "bg-gold/5" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg text-navy truncate">{m.name}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="text-xs font-medium text-slate">
              {m.remaining_credits ?? 0} {t("common.credits")}
            </span>
            {m.phone && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate">
                <Phone className="h-3 w-3" />
                <span dir="ltr" className="inline-block">
                  {m.phone}
                </span>
              </span>
            )}
            {m.is_first_timer && (
              <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 px-2 py-1 text-xs font-medium text-gold">
                <Sparkles className="h-2.5 w-2.5" /> {t("roster.first")}
              </span>
            )}
            {m.active_plan && (
              <span className="rounded-full border border-gold/30 px-2 py-1 text-xs font-medium text-slate">
                {getPlanDisplay(m.active_plan, lang).name}
              </span>
            )}
            {m.has_care_notes && (
              <span className="inline-flex items-center gap-1 rounded-full border border-gold/50 bg-gold/10 px-2 py-1 text-xs font-medium text-navy">
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
    "inline-flex items-center justify-center gap-1.5 rounded-xl border py-3 text-xs font-medium transition-colors";
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
