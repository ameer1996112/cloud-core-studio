import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { todaysClasses, markAttendance } from "@/lib/admin.functions";
import { getClassRoster } from "@/lib/members.functions";
import { useRef, useState } from "react";
import {
  AdminPageShell,
  AdminPageHeader,
  AsyncState,
  Empty,
  PersistentAnnouncement,
} from "@/components/admin-shared";
import { AttendanceRosterList } from "@/components/admin/AttendanceRosterList";
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
import { t, useI18n, type Lang } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { getPlanDisplay } from "@/lib/planDisplay";
import { BidiValue } from "@/components/ui/bidi";
import {
  localizedClassTitle,
  localizedInstructorName,
  localizedRoomName,
} from "@/lib/localized-content";
import {
  deriveAttendanceRosterState,
  deriveAttendanceSaveState,
  getAttendanceStatusPresentation,
  type AttendanceSaveStatus,
  type AttendanceSourceStatus,
} from "@/lib/attendance-view-state";

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
          visual="attendance"
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
          <BidiValue kind="time-range">
            {d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}
          </BidiValue>
        </p>
        <p className="mt-1.5 text-xs font-medium text-slate">{c.duration_minutes}m</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="cc-card-title truncate" dir="auto">
          <bdi>{localizedClassTitle(c, lang)}</bdi>
        </p>
        <p className="mt-1 truncate text-xs font-medium text-slate">
          {localizedRoomName(c.room, lang)} ·{" "}
          {c.instructor?.name ? (
            <bdi>{localizedInstructorName(c.instructor.name, lang)}</bdi>
          ) : (
            t("common.unassigned")
          )}
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
  const attendancePendingRef = useRef(false);
  const [query, setQuery] = useState("");
  const [lastAttempt, setLastAttempt] = useState<AttendanceAttempt | null>(null);
  const [saveOutcome, setSaveOutcome] = useState<{
    status: Exclude<AttendanceSaveStatus, "idle" | "pending">;
    memberName?: string;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["kiosk-roster", classId],
    queryFn: () => rosterFn({ data: { classId } }),
  });

  const mark = useMutation({
    mutationFn: ({ bookingId, status }: AttendanceAttempt) =>
      markFn({ data: { bookingId, status } }),
    onSuccess: async (_, attempt) => {
      setSaveOutcome({ status: "saved", memberName: attempt.memberName });
      await qc.invalidateQueries({ queryKey: ["kiosk-roster", classId] });
    },
    onError: (_error: Error, attempt) => {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      setSaveOutcome({
        status: offline ? "offline-retry" : "save-failed",
        memberName: attempt.memberName,
      });
    },
    onSettled: () => {
      attendancePendingRef.current = false;
    },
  });

  const pendingBookingId = mark.isPending ? (mark.variables?.bookingId ?? null) : null;
  const currentSaveState = deriveAttendanceSaveState({
    status: mark.isPending ? "pending" : (saveOutcome?.status ?? "idle"),
    lang,
    memberName: mark.isPending ? mark.variables?.memberName : saveOutcome?.memberName,
  });

  if (isLoading || !data?.class) {
    return (
      <AdminPageShell>
        <AsyncState
          state={
            isLoading
              ? deriveAttendanceRosterState({ isLoading: true, roster: [], lang })
              : {
                  status: "error" as const,
                  title: t("admin.classes.failed"),
                  body: t("common.retry"),
                }
          }
        />
      </AdminPageShell>
    );
  }
  const c = data.class as any;
  const start = new Date(c.starts_at);
  const totalBooked = data.bookings.filter((b: any) => b.status === "booked").length;
  const saveAttendance = (attempt: AttendanceAttempt) => {
    if (attendancePendingRef.current) return;
    attendancePendingRef.current = true;
    setLastAttempt(attempt);
    setSaveOutcome(null);
    mark.mutate(attempt);
  };

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
          <BidiValue kind="time-range">
            {start.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}
          </BidiValue>{" "}
          · {localizedRoomName(c.room_obj?.name ?? c.room, lang)} ·{" "}
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

      {currentSaveState.status === "pending" ? (
        <div role="status" aria-live="polite" className="text-sm text-slate">
          {currentSaveState.label}
        </div>
      ) : null}

      {currentSaveState.outcome ? (
        <PersistentAnnouncement
          tone={currentSaveState.outcome.tone}
          title={currentSaveState.outcome.title}
        >
          <p>{currentSaveState.outcome.body}</p>
          {currentSaveState.outcome.retry && lastAttempt ? (
            <button
              type="button"
              onClick={() => saveAttendance(lastAttempt)}
              className="btn-outline mt-3"
            >
              {t("common.retry")}
            </button>
          ) : null}
        </PersistentAnnouncement>
      ) : null}

      <AttendanceRosterList
        roster={data.bookings}
        query={query}
        lang={lang}
        caption={t("attendance.checkIn")}
        getRowKey={(booking: any) => booking.id}
        empty={<Empty>{t("attendance.noMatch")}</Empty>}
        columns={[
          {
            id: "member",
            label: t("nav.members"),
            cell: (booking: any) => <RosterMemberDetails booking={booking} lang={lang} />,
          },
          {
            id: "status",
            label: t("common.status"),
            cell: (booking: any) => (
              <AttendanceStatusBadge status={booking.attendance_state} lang={lang} />
            ),
          },
          {
            id: "actions",
            label: t("attendance.checkIn"),
            cell: (booking: any) => (
              <AttendanceActions
                booking={booking}
                pendingBookingId={pendingBookingId}
                lang={lang}
                onMark={(status) =>
                  saveAttendance({
                    bookingId: booking.id,
                    status,
                    memberName: booking.member?.name,
                  })
                }
              />
            ),
          },
        ]}
      />
    </AdminPageShell>
  );
}

function KStat({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="cc-metric-value text-3xl">{value}</p>
      <p className="eyebrow mt-1">{label}</p>
    </div>
  );
}

type AttendanceAttempt = {
  bookingId: string;
  status: "checked_in" | "attended" | "no_show";
  memberName?: string;
};

function RosterMemberDetails({ booking, lang }: { booking: any; lang: Lang }) {
  const member = booking.member ?? {};
  return (
    <div className="min-w-0">
      <p className="cc-card-title truncate">
        <bdi>{member.name}</bdi>
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate">
          {member.remaining_credits ?? 0} {t("common.credits")}
        </span>
        {member.phone ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate">
            <Phone className="h-3 w-3" />
            <BidiValue kind="phone">{member.phone}</BidiValue>
          </span>
        ) : null}
        {member.is_first_timer ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 px-2 py-1 text-xs font-medium text-gold">
            <Sparkles className="h-2.5 w-2.5" /> {t("roster.first")}
          </span>
        ) : null}
        {member.active_plan ? (
          <span className="rounded-full border border-gold/30 px-2 py-1 text-xs font-medium text-slate">
            {getPlanDisplay(member.active_plan, lang).name}
          </span>
        ) : null}
        {member.has_care_notes ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-gold/50 bg-gold/10 px-2 py-1 text-xs font-medium text-navy">
            <AlertTriangle className="h-2.5 w-2.5" /> {t("roster.care")}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function AttendanceStatusBadge({ status, lang }: { status: AttendanceSourceStatus; lang: Lang }) {
  const presentation = getAttendanceStatusPresentation(status, lang);
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${presentation.className}`}
    >
      {presentation.label}
    </span>
  );
}

function AttendanceActions({
  booking,
  pendingBookingId,
  lang,
  onMark,
}: {
  booking: any;
  pendingBookingId: string | null;
  lang: Lang;
  onMark: (status: AttendanceAttempt["status"]) => void;
}) {
  const status = booking.attendance_state;
  const saveState = deriveAttendanceSaveState({
    status: pendingBookingId ? "pending" : "idle",
    lang,
    memberName: pendingBookingId === booking.id ? booking.member?.name : undefined,
  });

  return (
    <div className="grid min-w-[17rem] grid-cols-3 gap-2">
      <KioskBtn
        active={status === "checked_in"}
        primary
        disabled={saveState.actionLocked}
        onClick={() => onMark("checked_in")}
      >
        <Clock className="h-4 w-4" /> {t("attendance.present")}
      </KioskBtn>
      <KioskBtn
        active={status === "attended"}
        disabled={saveState.actionLocked}
        onClick={() => onMark("attended")}
      >
        <CheckCircle2 className="h-4 w-4" /> {t("attendance.attended")}
      </KioskBtn>
      <KioskBtn
        active={status === "no_show"}
        disabled={saveState.actionLocked}
        onClick={() => onMark("no_show")}
      >
        <XCircle className="h-4 w-4" /> {t("attendance.noShow")}
      </KioskBtn>
    </div>
  );
}

function KioskBtn({
  active,
  primary,
  disabled,
  onClick,
  children,
}: {
  active?: boolean;
  primary?: boolean;
  disabled?: boolean;
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${cls} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {children}
    </button>
  );
}
