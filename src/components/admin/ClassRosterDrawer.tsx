import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getClassRoster, searchMembersForClass } from "@/lib/members.functions";
import {
  adminCreateBooking,
  adminCancelBooking,
  markAttendance,
  waitlistPromote,
  waitlistRemove,
} from "@/lib/admin.functions";
import { waitlistOffer, logNotification, listMessageTemplates } from "@/lib/messages.functions";
import { getPublicStudioSettings } from "@/lib/studioSettings.functions";
import { renderTemplate, waUrl, formatClassDate, formatClassTime } from "@/lib/messageTemplate";
import { useState } from "react";
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
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getLocale, labelForStatus, t, useI18n } from "@/lib/i18n";
import { ClassMoodImage } from "@/components/visual/ClassMoodImage";
import { InstructorAvatar } from "@/components/visual/InstructorAvatar";
import {
  localizedClassTitle,
  localizedInstructorName,
  localizedRoomName,
} from "@/lib/localized-content";

type Props = { classId: string | null; onClose: () => void };

export function ClassRosterDrawer({ classId, onClose }: Props) {
  const open = !!classId;
  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <SheetContent side="end" className="w-full sm:max-w-2xl overflow-y-auto bg-ivory p-0 h-dvh">
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
  const markFn = useServerFn(markAttendance);
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
    mutationFn: (v: { bookingId: string; status: any }) => markFn({ data: v }),
    onSuccess: () => invalidate(),
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

      {/* Header */}
      <SheetHeader className="px-5 sm:px-6 pt-4 sm:pt-5 pb-5 border-b border-gold/20 bg-ivory shrink-0 text-start">
        <p className="eyebrow">{t("roster.title")}</p>
        <SheetTitle className="font-display text-2xl sm:text-3xl font-light text-navy leading-tight">
          <span dir="auto">
            <bdi>{classTitle}</bdi>
          </span>
        </SheetTitle>
        <p className="text-sm text-slate mt-1">
          {start.toLocaleDateString(getLocale(), {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}{" "}
          · {start.toLocaleTimeString(getLocale(), { hour: "numeric", minute: "2-digit" })} ·{" "}
          {c.duration_minutes} {t("common.minutes")}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-slate">
          <span className="btn-ghost px-2.5 py-1">{roomName}</span>
          <span className="btn-ghost inline-flex items-center gap-2 px-2.5 py-1">
            <InstructorAvatar
              name={c.instructor?.name}
              photoUrl={c.instructor?.photo_url}
              size="xs"
            />
            {instructorName}
          </span>
          <span
            className={`inline-flex min-h-9 items-center rounded-full px-2.5 py-1 ${
              full ? "bg-navy text-ivory" : "border border-gold/30 bg-white/80 text-navy"
            }`}
          >
            {c.booked_count}/{c.capacity} · {full ? t("common.full") : t("common.open")}
          </span>
          {c.waitlist_count > 0 && (
            <span className="inline-flex min-h-9 items-center rounded-full border border-gold bg-gold/10 px-2.5 py-1 text-navy">
              {c.waitlist_count} {t("common.waiting")}
            </span>
          )}
          {c.status !== "scheduled" && (
            <span className="inline-flex min-h-9 items-center rounded-full bg-sand px-2.5 py-1 text-slate">
              {labelForStatus(c.status)}
            </span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {isAdmin ? (
            <Link
              to="/admin/classes/$id"
              params={{ id: classId }}
              className="btn-ghost text-xs hover:btn-ghost-hover"
            >
              {t("roster.editor")}
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate">
              <Eye className="h-3 w-3" /> {t("roster.readOnly")}
            </span>
          )}
          {isAdmin && (
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
              <Bell className="h-3 w-3" /> {t("roster.prepareReminders")}
            </button>
          )}
        </div>
      </SheetHeader>

      {/* Add member — admin only */}
      {isAdmin && (
        <div className="px-5 sm:px-6 py-4 border-b border-gold/15">
          {!adding ? (
            <button
              onClick={() => setAdding(true)}
              className="btn-outline inline-flex items-center gap-2 px-3 py-2 text-xs hover:btn-outline-hover"
            >
              <UserPlus className="h-3.5 w-3.5" /> {t("roster.addMember")}
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
              <div className="max-h-56 overflow-y-auto rounded-xl border border-gold/20 divide-y divide-gold/10">
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
                    <span className="text-sm text-navy">{m.name}</span>
                    <span className="text-xs font-medium text-slate">
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
          <span className="text-xs font-medium text-slate">
            {t("roster.checkedIn", { count: data.checked_in_count })}
          </span>
        </div>

        {data.bookings.length === 0 && (
          <p className="font-display text-slate text-center py-8">{t("roster.noBookings")}</p>
        )}
        <div className="space-y-2">
          {data.bookings.map((b: any) => (
            <RosterRow
              key={b.id}
              b={b}
              isAdmin={isAdmin}
              onMark={(s) => mark.mutate({ bookingId: b.id, status: s })}
              onCancel={() => cancelBooking.mutate(b.id)}
              onReminder={() => prepareReminderFor(b.member.id, b.member.name, b.member.phone)}
            />
          ))}
        </div>
      </div>

      {/* Waitlist */}
      {data.waitlist.length > 0 && (
        <div className="px-5 sm:px-6 py-5 border-t border-gold/15">
          <h3 className="section-title mb-4">
            {t("roster.waitlist")} (
            {
              data.waitlist.filter((w: any) => w.status === "waiting" || w.status === "offered")
                .length
            }
            )
          </h3>
          <div className="space-y-2">
            {data.waitlist.map((w: any, i: number) => (
              <div
                key={w.id}
                className="editorial-card p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-display text-base text-navy">{w.member?.name}</p>
                  <p className="mt-1 text-xs font-medium text-slate">
                    #{i + 1} · {labelForStatus(w.status)} · {w.member?.remaining_credits ?? 0}{" "}
                    {t("common.credits")}
                  </p>
                </div>
                {isAdmin && (w.status === "waiting" || w.status === "offered") && (
                  <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                    {w.status === "waiting" && (
                      <button
                        onClick={() => offer.mutate(w.id)}
                        title="Mark as offered"
                        className="btn-outline inline-flex h-9 items-center gap-1 px-2.5 text-xs hover:btn-outline-hover"
                      >
                        <Bell className="h-3.5 w-3.5" /> {t("roster.offer")}
                      </button>
                    )}
                    <button
                      onClick={() =>
                        prepareWaitlistOffer(w.member.id, w.member.name, w.member.phone, i + 1)
                      }
                      title="Copy/open WhatsApp"
                      className="btn-outline inline-flex h-9 w-9 items-center justify-center p-0 hover:btn-outline-hover"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => promote.mutate(w.id)}
                      title="Promote to booking"
                      className="btn-outline inline-flex h-9 w-9 items-center justify-center p-0 hover:btn-outline-hover"
                    >
                      <ArrowUpCircle className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeWait.mutate(w.id)}
                      title="Remove from waitlist"
                      className="btn-ghost inline-flex h-9 w-9 items-center justify-center p-0 hover:btn-ghost-hover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RosterRow({
  b,
  isAdmin,
  onMark,
  onCancel,
  onReminder,
}: {
  b: any;
  isAdmin: boolean;
  onMark: (s: string) => void;
  onCancel: () => void;
  onReminder: () => void;
}) {
  const m = b.member ?? {};
  const st = b.attendance_state;
  return (
    <div className="editorial-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to="/admin/members/$id"
              params={{ id: m.id }}
              className="font-display text-base text-navy hover:text-gold truncate"
            >
              {m.name}
            </Link>
            {m.is_first_timer && (
              <span className="btn-outline inline-flex min-h-7 items-center gap-1 px-1.5 py-0.5 text-xs">
                <Sparkles className="h-2.5 w-2.5" /> {t("roster.first")}
              </span>
            )}
            {m.has_care_notes && (
              <span className="chip-warn">
                <AlertTriangle className="h-2.5 w-2.5" /> {t("roster.care")}
              </span>
            )}

            {m.active_plan && (
              <span className="inline-flex min-h-7 items-center rounded-full border border-gold/30 px-1.5 py-0.5 text-xs font-medium text-slate">
                {m.active_plan.name}
              </span>
            )}
          </div>
          <p className="mt-1 flex items-center gap-3 text-xs text-slate">
            {m.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {m.phone}
              </span>
            )}
            <span>
              {m.remaining_credits ?? 0} {t("common.credits")}
            </span>
            <span className="font-medium">· {labelForStatus(st)}</span>
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <AttBtn
            active={st === "checked_in"}
            title={t("roster.checkIn")}
            onClick={() => onMark("checked_in")}
          >
            <Clock className="h-4 w-4" />
          </AttBtn>
          <AttBtn
            active={st === "attended"}
            title={t("attendance.attended")}
            onClick={() => onMark("attended")}
          >
            <CheckCircle2 className="h-4 w-4" />
          </AttBtn>
          <AttBtn
            active={st === "no_show"}
            title={t("attendance.noShow")}
            onClick={() => onMark("no_show")}
          >
            <XCircle className="h-4 w-4" />
          </AttBtn>
          {isAdmin && (
            <button
              title={t("roster.prepareReminder")}
              onClick={onReminder}
              className="btn-ghost inline-flex h-9 w-9 items-center justify-center p-0 hover:btn-ghost-hover"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
          )}
          {isAdmin && b.status === "booked" && (
            <button
              title={t("roster.removeRefund")}
              onClick={() => {
                if (confirm(t("roster.confirmRemove"))) onCancel();
              }}
              className="btn-ghost inline-flex h-9 w-9 items-center justify-center p-0 text-destructive/80 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AttBtn({ active, onClick, title, children }: any) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
        active
          ? "bg-navy border-navy text-ivory"
          : "border-gold/25 text-slate hover:border-gold hover:text-navy"
      }`}
    >
      {children}
    </button>
  );
}
