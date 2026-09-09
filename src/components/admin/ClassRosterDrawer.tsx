import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getClassRoster, searchMembersForClass } from "@/lib/members.functions";
import {
  adminCreateBooking,
  adminCancelBooking,
  adminCancelClass,
  markAttendance,
  rescheduleClass,
  waitlistPromote,
  waitlistRemove,
} from "@/lib/admin.functions";
import { waitlistOffer, logNotification, listMessageTemplates } from "@/lib/messages.functions";
import { getPublicStudioSettings } from "@/lib/studioSettings.functions";
import { renderTemplate, waUrl, formatClassDate, formatClassTime } from "@/lib/messageTemplate";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/error-messages";
import {
  CheckCircle2,
  Clock,
  XCircle,
  UserPlus,
  ArrowUpCircle,
  Trash2,
  AlertTriangle,
  Sparkles,
  Phone,
  Search,
  Send,
  MessageCircle,
  Bell,
  Eye,
  CalendarClock,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getLocale, labelForStatus, t, useI18n, type Lang } from "@/lib/i18n";
import { ClassMoodImage } from "@/components/visual/ClassMoodImage";
import { InstructorAvatar } from "@/components/visual/InstructorAvatar";
import {
  localizedClassTitle,
  localizedInstructorName,
  localizedRoomName,
} from "@/lib/localized-content";
import { formatStudioDateTimeInput, studioDateTimeInputToIso } from "@/lib/studio-time";
import { PersistentAnnouncement } from "@/components/ui/sonner";
import { deriveAttendanceSaveState, type AttendanceSaveStatus } from "@/lib/attendance-view-state";

type Props = { classId: string | null; onClose: () => void };
type AttendanceAttempt = {
  bookingId: string;
  status: "checked_in" | "attended" | "no_show";
  memberName?: string;
};

export function ClassRosterDrawer({ classId, onClose }: Props) {
  const open = !!classId;
  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <SheetContent
        side="end"
        className="staff-roster w-full sm:max-w-2xl overflow-y-auto bg-ivory p-0 h-dvh"
      >
        {classId && <RosterBody classId={classId} />}
      </SheetContent>
    </Sheet>
  );
}

function RosterBody({ classId }: { classId: string }) {
  const { lang } = useI18n();
  const qc = useQueryClient();
  const rosterFn = useServerFn(getClassRoster);
  const searchFn = useServerFn(searchMembersForClass);
  const createFn = useServerFn(adminCreateBooking);
  const cancelFn = useServerFn(adminCancelBooking);
  const cancelClassFn = useServerFn(adminCancelClass);
  const rescheduleFn = useServerFn(rescheduleClass);
  const markFn = useServerFn(markAttendance);
  const attendancePendingRef = useRef(false);
  const promoteFn = useServerFn(waitlistPromote);
  const removeWaitFn = useServerFn(waitlistRemove);
  const offerFn = useServerFn(waitlistOffer);
  const settingsFn = useServerFn(getPublicStudioSettings);
  const templatesFn = useServerFn(listMessageTemplates);
  const logFn = useServerFn(logNotification);
  const { data: settings } = useQuery({
    queryKey: ["public-studio-settings"],
    queryFn: () => settingsFn(),
  });
  const { data: templates } = useQuery({
    queryKey: ["msg-templates"],
    queryFn: () => templatesFn(),
  });
  const { data: viewer } = useQuery({
    queryKey: ["viewer-role"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) return { role: null as string | null };
      const { data: p } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      return { role: (p?.role as string | null) ?? null };
    },
  });
  const isAdmin = viewer?.role === "admin";

  const { data, isLoading } = useQuery({
    queryKey: ["class-roster", classId],
    queryFn: () => rosterFn({ data: { classId } }),
  });

  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [editingTime, setEditingTime] = useState(false);
  const [nextStartsAt, setNextStartsAt] = useState("");
  const [lastAttendanceAttempt, setLastAttendanceAttempt] = useState<AttendanceAttempt | null>(
    null,
  );
  const [attendanceOutcome, setAttendanceOutcome] = useState<{
    status: Exclude<AttendanceSaveStatus, "idle" | "pending">;
    memberName?: string;
  } | null>(null);
  const { data: candidates } = useQuery({
    queryKey: ["roster-search", classId, search],
    queryFn: () => searchFn({ data: { classId, query: search } }),
    enabled: adding,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["class-roster", classId] });
    qc.invalidateQueries({ queryKey: ["admin-calendar"] });
    qc.invalidateQueries({ queryKey: ["admin-today"] });
    qc.invalidateQueries({ queryKey: ["studio-pulse"] });
  }

  const addBooking = useMutation({
    mutationFn: (memberId: string) => createFn({ data: { classId, memberId, override: false } }),
    onSuccess: (r: any) => {
      if (r?.status === "booked") {
        toast.success(t("roster.added"));
        setAdding(false);
        setSearch("");
        invalidate();
      } else if (r?.status === "already_booked") toast(t("roster.already"));
      else if (r?.status === "full") toast.error(t("roster.full"));
      else if (r?.status === "insufficient_credits") toast.error(t("roster.noCredits"));
      else toast.error(friendlyErrorMessage(r, t("roster.couldntAdd")));
    },
    onError: (e) => toast.error(friendlyErrorMessage(e, t("roster.couldntAdd"))),
  });

  const cancelBooking = useMutation({
    mutationFn: (bookingId: string) => cancelFn({ data: { bookingId, refund: true } }),
    onSuccess: () => {
      toast.success(t("roster.removed"));
      invalidate();
    },
  });

  const mark = useMutation({
    mutationFn: ({ bookingId, status }: AttendanceAttempt) =>
      markFn({ data: { bookingId, status } }),
    onSuccess: (_, attempt) => {
      setAttendanceOutcome({ status: "saved", memberName: attempt.memberName });
      invalidate();
    },
    onError: (_error: Error, attempt) => {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      setAttendanceOutcome({
        status: offline ? "offline-retry" : "save-failed",
        memberName: attempt.memberName,
      });
    },
    onSettled: () => {
      attendancePendingRef.current = false;
    },
  });

  const promote = useMutation({
    mutationFn: (entryId: string) => promoteFn({ data: { entryId } }),
    onSuccess: (r: any) => {
      if (r?.status === "booked" || r?.status === "already_booked") {
        toast.success(t("roster.promoted"));
        invalidate();
      } else toast.error(friendlyErrorMessage(r, t("roster.couldntPromote")));
    },
  });
  const removeWait = useMutation({
    mutationFn: (entryId: string) => removeWaitFn({ data: { entryId } }),
    onSuccess: () => invalidate(),
  });
  const offer = useMutation({
    mutationFn: (entryId: string) => offerFn({ data: { entryId } }),
    onSuccess: (r: any) => {
      if (r?.status === "offered") {
        toast.success(t("roster.offered"));
        invalidate();
      } else toast.error(friendlyErrorMessage(r, t("roster.couldntOffer")));
    },
  });

  const reschedule = useMutation({
    mutationFn: () =>
      rescheduleFn({
        data: { id: classId, startsAt: studioDateTimeInputToIso(nextStartsAt) },
      }),
    onSuccess: () => {
      toast.success(t("roster.timeChanged"));
      setEditingTime(false);
      invalidate();
    },
    onError: (error) => toast.error(friendlyErrorMessage(error, t("admin.classes.failed"))),
  });

  const cancelClass = useMutation({
    mutationFn: () =>
      cancelClassFn({
        data: {
          classId,
          reason: null,
          notifyMembers: true,
          refundCredits: true,
        },
      }),
    onSuccess: () => {
      toast.success(t("admin.classDetail.cancelSuccess"));
      invalidate();
    },
    onError: (error) => toast.error(friendlyErrorMessage(error, t("admin.classes.failed"))),
  });

  function prepareReminderFor(memberId: string, memberName: string, phone: string | null) {
    const c = data?.class as any;
    if (!c) return;
    const tpl =
      (templates ?? []).find(
        (t: any) => t.active && t.trigger_type === "class_reminder" && t.channel === "whatsapp",
      ) ?? (templates ?? []).find((t: any) => t.active && t.channel === "whatsapp");
    if (!tpl) {
      toast.error(t("roster.noTemplate"));
      return;
    }
    const tz = settings?.timezone ?? "Asia/Jerusalem";
    const text = renderTemplate(tpl.body, {
      member_name: memberName?.split(" ")[0] ?? "there",
      studio_name: settings?.studio_name ?? "the studio",
      studio_phone: settings?.public_phone ?? "",
      studio_whatsapp: settings?.whatsapp_number ?? "",
      class_name: c.title,
      class_date: formatClassDate(c.starts_at, tz),
      class_time: formatClassTime(c.starts_at, tz),
      room_name: c.room_obj?.name ?? c.room,
      instructor_name: c.instructor?.name ?? "your instructor",
      cancellation_deadline: `${c.cancellation_window_hours ?? 4}h`,
    });
    window.open(waUrl({ to: phone, text }), "_blank", "noopener");
    logFn({
      data: {
        templateId: tpl.id,
        templateKey: tpl.key,
        triggerType: "class_reminder",
        channel: "whatsapp",
        recipientMemberId: memberId,
        generatedText: text,
        subject: null,
        status: "opened",
        relatedClassId: classId,
        relatedBookingId: null,
        relatedMemberPlanId: null,
      },
    }).catch(() => {});
  }

  function prepareWaitlistOffer(
    memberId: string,
    memberName: string,
    phone: string | null,
    position: number,
  ) {
    const c = data?.class as any;
    if (!c) return;
    const tpl =
      (templates ?? []).find(
        (t: any) => t.active && t.trigger_type === "waitlist_spot" && t.channel === "whatsapp",
      ) ?? (templates ?? []).find((t: any) => t.active && t.channel === "whatsapp");
    if (!tpl) {
      toast.error(t("roster.noTemplate"));
      return;
    }
    const tz = settings?.timezone ?? "Asia/Jerusalem";
    const text = renderTemplate(tpl.body, {
      member_name: memberName?.split(" ")[0] ?? "there",
      studio_name: settings?.studio_name ?? "the studio",
      class_name: c.title,
      class_date: formatClassDate(c.starts_at, tz),
      class_time: formatClassTime(c.starts_at, tz),
      waitlist_position: position,
    });
    window.open(waUrl({ to: phone, text }), "_blank", "noopener");
    logFn({
      data: {
        templateId: tpl.id,
        templateKey: tpl.key,
        triggerType: "waitlist_spot",
        channel: "whatsapp",
        recipientMemberId: memberId,
        generatedText: text,
        subject: null,
        status: "opened",
        relatedClassId: classId,
        relatedBookingId: null,
        relatedMemberPlanId: null,
      },
    }).catch(() => {});
  }

  if (isLoading || !data?.class) {
    return (
      <div className="p-8">
        <div className="skeleton-brand h-6 w-40 mb-4" />
        <div className="skeleton-brand h-4 w-64 mb-2" />
        <div className="skeleton-brand h-4 w-48" />
      </div>
    );
  }

  const c = data.class as any;
  const start = new Date(c.starts_at);
  const full = c.booked_count >= c.capacity;
  const classTitle = localizedClassTitle(c, lang);
  const roomName = localizedRoomName(c.room_obj?.name ?? c.room, lang);
  const instructorName = c.instructor?.name
    ? localizedInstructorName(c.instructor.name, lang)
    : t("common.unassigned");
  const pendingBookingId = mark.isPending ? (mark.variables?.bookingId ?? null) : null;
  const attendanceSaveState = deriveAttendanceSaveState({
    status: mark.isPending ? "pending" : (attendanceOutcome?.status ?? "idle"),
    lang,
    memberName: mark.isPending ? mark.variables?.memberName : attendanceOutcome?.memberName,
  });

  const saveAttendance = (attempt: AttendanceAttempt) => {
    if (attendancePendingRef.current) return;
    attendancePendingRef.current = true;
    setLastAttendanceAttempt(attempt);
    setAttendanceOutcome(null);
    mark.mutate(attempt);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Image / accent strip */}
      <div className="relative h-28 sm:h-32 overflow-hidden border-b border-gold/20 shrink-0">
        <ClassMoodImage
          title={c.title}
          imageUrl={c.image_url}
          className="absolute inset-0 h-full w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ivory via-ivory/50 to-transparent" />
      </div>

      {/* Header Info Block */}
      <SheetHeader className="px-5 sm:px-6 pt-5 pb-5 border-b border-gold/20 bg-ivory shrink-0 text-start">
        <div className="flex justify-between items-start gap-4">
          <div>
            <p className="eyebrow mb-1">{t("roster.title")}</p>
            <SheetTitle className="font-display text-2xl sm:text-3xl font-light text-navy leading-tight">
              <span dir="auto">
                <bdi>{classTitle}</bdi>
              </span>
            </SheetTitle>
          </div>
          <div className="shrink-0">
            <span
              className={`inline-flex min-h-7 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                c.status === "cancelled"
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : c.status === "closed"
                    ? "bg-sand text-slate border border-slate/20"
                    : full
                      ? "bg-navy text-ivory"
                      : "bg-green-50 text-green-700 border border-green-200"
              }`}
            >
              {c.status === "cancelled"
                ? t("state.cancelled")
                : c.status === "closed"
                  ? t("state.closed")
                  : full
                    ? t("common.full")
                    : t("common.open")}
            </span>
          </div>
        </div>

        {/* Studio operations summary metadata grid */}
        <div className="grid grid-cols-2 gap-4 mt-4 bg-card backdrop-blur-sm rounded-xl p-3.5 border border-gold/10">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate">
              {t("admin.classes.time")}
            </p>
            <p className="font-display text-sm text-navy font-medium mt-0.5" dir="ltr">
              {start.toLocaleDateString(getLocale(), {
                weekday: "short",
                month: "numeric",
                day: "numeric",
              })}{" "}
              · {start.toLocaleTimeString(getLocale(), { hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate">
              {t("admin.classes.durationMin")}
            </p>
            <p className="font-display text-sm text-navy font-medium mt-0.5">
              {c.duration_minutes} {t("common.minutes")}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate">{t("common.room")}</p>
            <p className="font-display text-sm text-navy font-medium mt-0.5">{roomName}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate">
              {t("admin.classes.instructor")}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <InstructorAvatar
                name={c.instructor?.name}
                photoUrl={c.instructor?.photo_url}
                size="xs"
              />
              <span className="font-display text-sm text-navy font-medium">{instructorName}</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate">
              {t("admin.classes.capacityPlaces")}
            </p>
            <p className="font-display text-sm text-navy font-medium mt-0.5">
              {c.booked_count} / {c.capacity}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate">
              {t("roster.waitlist")}
            </p>
            <p className="font-display text-sm text-navy font-medium mt-0.5">
              {c.waitlist_count} {t("common.waiting")}
            </p>
          </div>
        </div>

        {/* Consolidated Action Row */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-1">
          {isAdmin && (
            <>
              <Link
                to="/admin/classes/$id"
                params={{ id: classId }}
                className="btn-navy inline-flex h-9 items-center gap-1.5 px-4 text-xs hover:btn-navy-hover"
              >
                {t("roster.editor")}
              </Link>
              {c.status === "scheduled" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setNextStartsAt(formatStudioDateTimeInput(c.starts_at));
                      setEditingTime((current) => !current);
                    }}
                    className="btn-outline inline-flex h-9 items-center gap-1.5 px-3 text-xs hover:btn-outline-hover"
                  >
                    <CalendarClock className="h-3.5 w-3.5 text-[var(--color-accent-text)]" />
                    {t("roster.changeTime")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(t("roster.cancelClassConfirm"))) cancelClass.mutate();
                    }}
                    disabled={cancelClass.isPending}
                    className="btn-outline inline-flex h-9 items-center gap-1.5 border-red-300 px-3 text-xs text-red-700 hover:bg-red-50"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    {t("admin.classDetail.cancelClass")}
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  const booked = data.bookings.filter((b: any) => b.status === "booked");
                  if (booked.length === 0) {
                    toast(t("roster.noBooked"));
                    return;
                  }
                  booked.forEach((b: any) =>
                    prepareReminderFor(b.member.id, b.member.name, b.member.phone),
                  );
                  toast.success(t("roster.prepared", { count: booked.length }));
                }}
                className="btn-outline inline-flex h-9 items-center gap-1.5 px-3 text-xs hover:btn-outline-hover"
              >
                <Bell className="h-3.5 w-3.5 text-[var(--color-accent-text)]" />{" "}
                {t("roster.prepareReminders")}
              </button>
            </>
          )}
        </div>
        {isAdmin && editingTime && c.status === "scheduled" && (
          <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-gold/20 bg-card p-3">
            <label className="min-w-56 flex-1 text-start">
              <span className="mb-1 block text-xs font-medium text-slate">
                {t("roster.newTime")}
              </span>
              <input
                type="datetime-local"
                value={nextStartsAt}
                onChange={(event) => setNextStartsAt(event.target.value)}
                className="editorial-input"
              />
            </label>
            <button
              type="button"
              onClick={() => reschedule.mutate()}
              disabled={!nextStartsAt || reschedule.isPending}
              className="btn-navy h-10 px-4 text-xs hover:btn-navy-hover"
            >
              {reschedule.isPending ? t("common.saving") : t("roster.saveTime")}
            </button>
          </div>
        )}
      </SheetHeader>

      {/* Add member — admin only */}
      {isAdmin && (
        <div className="px-5 sm:px-6 py-4 border-b border-gold/15 bg-card">
          {!adding ? (
            <button
              onClick={() => setAdding(true)}
              className="btn-outline inline-flex items-center gap-2 px-3 py-2 text-xs hover:btn-outline-hover"
            >
              <UserPlus className="h-3.5 w-3.5 text-[var(--color-accent-text)]" />{" "}
              {t("roster.addMember")}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("roster.search")}
                  className="editorial-input ps-10"
                />
              </div>
              <div className="max-h-56 overflow-y-auto rounded-xl border border-gold/20 divide-y divide-gold/10 bg-card">
                {(candidates ?? []).length === 0 && (
                  <p className="p-4 text-xs italic text-slate font-display">
                    {t("roster.noMatches")}
                  </p>
                )}
                {(candidates ?? []).map((m: any) => (
                  <button
                    key={m.id}
                    onClick={() => addBooking.mutate(m.id)}
                    disabled={addBooking.isPending}
                    className="w-full text-start p-3 flex items-center justify-between hover:bg-gold/5 disabled:opacity-50"
                  >
                    <span className="text-sm text-navy font-medium">{m.name}</span>
                    <span className="text-xs font-medium text-slate bg-sand/35 px-2 py-0.5 rounded-full">
                      {m.remaining_credits}{" "}
                      {m.remaining_credits === 1 ? t("common.credit") : t("common.credits")}
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setAdding(false);
                  setSearch("");
                }}
                className="btn-ghost text-xs hover:btn-ghost-hover"
              >
                {t("common.cancel")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Roster */}
      <div className="px-5 sm:px-6 py-5">
        <div className="flex items-end justify-between mb-4">
          <h3 className="section-title">
            {t("roster.booked")} ({data.bookings.filter((b) => b.status === "booked").length})
          </h3>
          <span className="text-xs font-semibold text-[var(--color-accent-text)] bg-gold/10 px-2.5 py-1 rounded-full">
            {t("roster.checkedIn", { count: data.checked_in_count })}
          </span>
        </div>

        {attendanceSaveState.status === "pending" ? (
          <p role="status" aria-live="polite" className="mb-4 text-sm text-slate">
            {attendanceSaveState.label}
          </p>
        ) : null}
        {attendanceSaveState.outcome ? (
          <PersistentAnnouncement
            tone={attendanceSaveState.outcome.tone}
            title={attendanceSaveState.outcome.title}
            className="mb-4"
          >
            <p>{attendanceSaveState.outcome.body}</p>
            {attendanceSaveState.outcome.retry && lastAttendanceAttempt ? (
              <button
                type="button"
                onClick={() => saveAttendance(lastAttendanceAttempt)}
                className="btn-outline mt-3"
              >
                {t("common.retry")}
              </button>
            ) : null}
          </PersistentAnnouncement>
        ) : null}

        {data.bookings.length === 0 && (
          <p className="font-display text-slate text-center py-8">{t("roster.noBookings")}</p>
        )}
        <div className="space-y-3">
          {data.bookings.map((b: any) => (
            <RosterRow
              key={b.id}
              b={b}
              isAdmin={isAdmin}
              actionLocked={Boolean(pendingBookingId)}
              onMark={(status) =>
                saveAttendance({
                  bookingId: b.id,
                  status,
                  memberName: b.member?.name,
                })
              }
              onCancel={() => cancelBooking.mutate(b.id)}
              onReminder={() => prepareReminderFor(b.member.id, b.member.name, b.member.phone)}
            />
          ))}
        </div>
      </div>

      {/* Waitlist */}
      <div className="px-5 sm:px-6 py-5 border-t border-gold/15 bg-card">
        <h3 className="section-title mb-4">
          {t("roster.waitlist")} (
          {
            data.waitlist.filter((w: any) => w.status === "waiting" || w.status === "offered")
              .length
          }
          )
        </h3>

        {data.waitlist.length === 0 ? (
          <div className="border border-dashed border-gold/30 rounded-xl p-6 text-center bg-card">
            <Clock className="h-5 w-5 text-gold/60 mx-auto mb-2" />
            <p className="font-display text-sm font-medium text-navy">
              {lang === "he"
                ? "אין ממתינים כרגע"
                : lang === "ar"
                  ? "لا يوجد أحد في قائمة الانتظار حالياً"
                  : "No waitlisted members yet"}
            </p>
            <p className="text-xs text-slate mt-1 max-w-[280px] mx-auto leading-relaxed">
              {lang === "he"
                ? "אם השיעור יתמלא, חברים יוכלו להצטרף לרשימת ההמתנה."
                : lang === "ar"
                  ? "إذا امتلأ الفصل، سيتمكن الأعضاء من الانضمام إلى قائمة الانتظار."
                  : "If the class fills up, members will be able to join the waitlist."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.waitlist.map((w: any, i: number) => (
              <div
                key={w.id}
                className="editorial-card p-4 flex items-center justify-between gap-3 border border-gold/15 rounded-xl bg-card text-start"
              >
                <div className="min-w-0">
                  <p className="font-display text-base font-medium text-navy">{w.member?.name}</p>
                  <p className="mt-1 text-xs text-slate">
                    #{i + 1} · {localizeRosterStatus(w.status, lang)} ·{" "}
                    {w.member?.remaining_credits ?? 0} {t("common.credits")}
                  </p>
                </div>
                {isAdmin && (w.status === "waiting" || w.status === "offered") && (
                  <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                    {w.status === "waiting" && (
                      <button
                        onClick={() => offer.mutate(w.id)}
                        title="Mark as offered"
                        className="btn-outline inline-flex h-9 items-center gap-1 px-2.5 text-xs hover:btn-outline-hover rounded-full"
                      >
                        <Bell className="h-3.5 w-3.5 text-[var(--color-accent-text)]" />{" "}
                        {t("roster.offer")}
                      </button>
                    )}
                    <button
                      onClick={() =>
                        prepareWaitlistOffer(w.member.id, w.member.name, w.member.phone, i + 1)
                      }
                      title="Copy/open WhatsApp"
                      className="btn-outline inline-flex h-11 w-11 items-center justify-center p-0 hover:btn-outline-hover rounded-full"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => promote.mutate(w.id)}
                      title="Promote to booking"
                      className="btn-outline inline-flex h-11 w-11 items-center justify-center p-0 hover:btn-outline-hover rounded-full"
                    >
                      <ArrowUpCircle className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeWait.mutate(w.id)}
                      title="Remove from waitlist"
                      className="btn-ghost inline-flex h-9 w-9 items-center justify-center p-0 hover:btn-ghost-hover rounded-full text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RosterRow({
  b,
  isAdmin,
  actionLocked,
  onMark,
  onCancel,
  onReminder,
}: {
  b: any;
  isAdmin: boolean;
  actionLocked: boolean;
  onMark: (status: AttendanceAttempt["status"]) => void;
  onCancel: () => void;
  onReminder: () => void;
}) {
  const { lang } = useI18n();
  const m = b.member ?? {};
  const st = b.attendance_state;

  return (
    <div className="editorial-card p-4 hover:border-gold/30 transition-all hover:shadow-[0_4px_12px_rgba(11,29,58,0.03)] bg-card rounded-xl border border-gold/15">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Member Details */}
        <div className="min-w-0 flex-1 space-y-1.5 text-start">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to="/admin/members/$id"
              params={{ id: m.id }}
              className="font-display text-base font-medium text-navy hover:text-[var(--color-accent-text)] transition-colors truncate"
            >
              {m.name}
            </Link>

            {m.is_first_timer && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-accent-text)] border border-gold/25">
                <Sparkles className="h-2.5 w-2.5" /> {t("roster.first")}
              </span>
            )}
            {m.has_care_notes && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600 border border-red-200">
                <AlertTriangle className="h-2.5 w-2.5" /> {t("roster.care")}
              </span>
            )}
            {m.active_plan && (
              <span className="inline-flex items-center rounded-full bg-sand/40 border border-gold/20 px-2 py-0.5 text-[10px] font-medium text-slate">
                {m.active_plan.name}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate">
            {m.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3 text-gold/80" />
                <span dir="ltr">{m.phone}</span>
              </span>
            )}
            <span className="text-slate">·</span>
            <span>
              {m.remaining_credits ?? 0} {t("common.credits")}
            </span>
            <span className="text-slate">·</span>
            <span
              className={`font-semibold ${
                st === "attended"
                  ? "text-green-700"
                  : st === "no_show"
                    ? "text-red-700"
                    : "text-navy"
              }`}
            >
              {localizeRosterStatus(st || "booked", lang)}
            </span>
          </div>
        </div>

        {/* Actions Row */}
        <div className="flex items-center gap-1.5 shrink-0 justify-end">
          {/* Quick Attendance Buttons */}
          <AttBtn
            active={st === "checked_in"}
            title={t("roster.checkIn")}
            disabled={actionLocked}
            onClick={() => onMark("checked_in")}
          >
            <Clock className="h-4 w-4" />
          </AttBtn>
          <AttBtn
            active={st === "attended"}
            title={t("attendance.attended")}
            disabled={actionLocked}
            onClick={() => onMark("attended")}
          >
            <CheckCircle2 className="h-4 w-4" />
          </AttBtn>
          <AttBtn
            active={st === "no_show"}
            title={t("attendance.noShow")}
            disabled={actionLocked}
            onClick={() => onMark("no_show")}
          >
            <XCircle className="h-4 w-4" />
          </AttBtn>

          <div className="h-5 w-px bg-gold/20 mx-1" />

          {/* WhatsApp Reminder */}
          {isAdmin && (
            <button
              title={t("roster.prepareReminder")}
              onClick={onReminder}
              className="btn-outline inline-flex h-11 w-11 items-center justify-center p-0 hover:btn-outline-hover rounded-full"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
          )}

          {/* View Member Profile */}
          <Link
            to="/admin/members/$id"
            params={{ id: m.id }}
            aria-label={`${t("common.member")}: ${m.name}`}
            className="btn-outline inline-flex h-11 w-11 items-center justify-center p-0 hover:btn-outline-hover rounded-full text-slate"
          >
            <Eye className="h-4 w-4" />
          </Link>

          {/* Cancel/Remove Booking */}
          {isAdmin && b.status === "booked" && (
            <button
              title={t("roster.removeRefund")}
              onClick={() => {
                if (confirm(t("roster.confirmRemove"))) onCancel();
              }}
              className="btn-ghost inline-flex h-9 w-9 items-center justify-center p-0 text-red-600 hover:bg-red-50 rounded-full"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AttBtn({ active, onClick, title, children, disabled }: any) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors cursor-pointer ${
        active
          ? "bg-navy border-navy text-ivory font-semibold"
          : "border-gold/25 text-slate hover:border-gold hover:text-navy"
      }`}
    >
      {children}
    </button>
  );
}

function localizeRosterStatus(status: string | null | undefined, lang: Lang): string {
  if (!status) return "—";
  const map: Record<string, Record<Lang, string>> = {
    booked: { en: "Confirmed", he: "מאושר", ar: "مؤكد" },
    attended: { en: "Attended", he: "נכח/ה", ar: "حضر" },
    no_show: { en: "No Show", he: "לא הגיע/ה", ar: "لم يحضر" },
    cancelled: { en: "Cancelled", he: "בוטל", ar: "ملغي" },
    waiting: { en: "Waiting", he: "ממתין/ה", ar: "في الانتظار" },
    offered: { en: "Offered", he: "ממתין/ה (הצעה)", ar: "في الانتظار (معروض)" },
    pending: { en: "Pending", he: "ממתין/ה", ar: "قيد الانتظار" },
    checked_in: { en: "Checked In", he: "נרשם/ה", ar: "تم التسجيل" },
  };
  return map[status.toLowerCase()]?.[lang] ?? labelForStatus(status);
}
