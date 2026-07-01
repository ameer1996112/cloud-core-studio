import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MessageCircle, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyBookingsAll, memberCancelBooking, leaveWaitlist } from "@/lib/member.functions";
import { getPublicStudioSettings } from "@/lib/studioSettings.functions";
import { waUrl, buildIcs, downloadIcs } from "@/lib/messageTemplate";
import { formatDate, formatTime, MemberEmptyState } from "@/components/member/PremiumClassCard";
import { ClassDetailSheet } from "@/components/member/ClassDetailSheet";
import { LessonReservationCard } from "@/components/visual/VisualClassCard";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { studioImages, localizedAlt } from "@/lib/image-assets";
import { t, useI18n, getLocale } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  getMemberViewerCacheKey,
  isAuthenticatedMemberScheduleQueryKey,
} from "@/lib/memberQueryKeys";
import { localizedClassTitle, localizedOptionalInstructorName } from "@/lib/localized-content";

export const Route = createFileRoute("/_authenticated/member/bookings")({
  component: MyBookings,
});

type Tab = "upcoming" | "past" | "waitlist" | "cancelled";

function MyBookings() {
  const { dir } = useI18n();
  useDocumentTitle("page.bookings.title");
  const fetchAll = useServerFn(getMyBookingsAll);
  const fetchSettings = useServerFn(getPublicStudioSettings);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["my-bookings-all"],
    queryFn: () => fetchAll(),
  });
  const { data: settings } = useQuery({
    queryKey: ["public-studio-settings"],
    queryFn: () => fetchSettings(),
  });
  const [tab, setTab] = useState<Tab>("upcoming");
  const [confirmCancel, setConfirmCancel] = useState<any | null>(null);
  const [openClass, setOpenClass] = useState<string | null>(null);
  const [detailViewerCacheKey, setDetailViewerCacheKey] = useState<string | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: sessionData }) => {
      setDetailViewerCacheKey(getMemberViewerCacheKey(sessionData.session?.user?.id));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setDetailViewerCacheKey(getMemberViewerCacheKey(session?.user?.id));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const cancelFn = useServerFn(memberCancelBooking);
  const leaveFn = useServerFn(leaveWaitlist);

  const cancel = useMutation({
    mutationFn: (bookingId: string) => cancelFn({ data: { bookingId } }),
    onSuccess: (res: any) => {
      if (res.status === "cancelled") {
        toast.success(t("booking.cancelled"));
        qc.invalidateQueries({ queryKey: ["my-bookings-all"] });
        qc.invalidateQueries({ queryKey: ["member-home"] });
        qc.invalidateQueries({
          predicate: (query) => isAuthenticatedMemberScheduleQueryKey(query.queryKey),
        });
      } else if (res.status === "window_passed") {
        toast(t("bookings.windowPassed"));
      } else {
        toast(t("bookings.cancelError"));
      }
      setConfirmCancel(null);
    },
  });

  const leave = useMutation({
    mutationFn: (entryId: string) => leaveFn({ data: { entryId } }),
    onSuccess: () => {
      toast.success(t("bookings.leftWaitlist"));
      qc.invalidateQueries({ queryKey: ["my-bookings-all"] });
    },
  });

  const now = Date.now();
  const bookings = data?.bookings ?? [];
  const attMap = data?.attendanceByBooking ?? {};
  const upcoming = bookings.filter(
    (b: any) => b.status === "booked" && b.class && new Date(b.class.starts_at).getTime() >= now,
  );
  const past = bookings.filter(
    (b: any) =>
      b.class &&
      (b.status === "booked" || b.status === "attended") &&
      new Date(b.class.starts_at).getTime() < now,
  );
  const cancelled = bookings.filter((b: any) => b.status === "cancelled");
  const waitlist = data?.waitlist ?? [];

  const counts = {
    upcoming: upcoming.length,
    past: past.length,
    waitlist: waitlist.length,
    cancelled: cancelled.length,
  };
  const current =
    tab === "upcoming"
      ? upcoming
      : tab === "past"
        ? past
        : tab === "cancelled"
          ? cancelled
          : waitlist;

  return (
    <section dir={dir} className="member-page w-full space-y-6 pb-10">
      <div className="member-page-panel grid overflow-hidden md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="member-page-copy p-5 sm:p-8">
          <p className="member-eyebrow">{t("member.bookings.kicker")}</p>
          <h1 className="member-page-title mt-3">{t("nav.myBookings")}</h1>
          <p className="member-page-body mt-3">{t("member.bookings.body")}</p>
          <div className="member-stat-strip mt-6">
            <StatCell label={t("bookings.upcoming")} value={counts.upcoming} />
            <StatCell label={t("bookings.waitlist")} value={counts.waitlist} />
            <StatCell label={t("bookings.past")} value={counts.past} />
          </div>
        </div>
        <div className="relative min-h-[150px] sm:min-h-[180px] md:min-h-[190px] border-t border-gold/20 bg-sand/60 md:border-s md:border-t-0">
          <img
            src={studioImages.atmosphere.src}
            alt={localizedAlt(studioImages.atmosphere, getLocale())}
            loading="eager"
            className="absolute inset-0 h-full w-full object-cover outline outline-1 -outline-offset-1 outline-navy/10"
          />
        </div>
      </div>

      <div className="member-control-panel member-tab-bar no-scrollbar">
        {(["upcoming", "waitlist", "past", "cancelled"] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`member-tab-button ${
              tab === tabKey
                ? "member-tab-button-active"
                : "bg-transparent text-slate hover:bg-sand/60 hover:text-navy"
            }`}
          >
            {tabKey === "upcoming"
              ? t("bookings.upcoming")
              : tabKey === "waitlist"
                ? t("bookings.waitlist")
                : tabKey === "past"
                  ? t("bookings.past")
                  : t("bookings.cancelled")}{" "}
            <span className="member-tab-count">· {counts[tabKey]}</span>
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 skeleton-brand rounded-[var(--cc-radius-card)]" />
          ))}
        </div>
      )}

      {!isLoading && current.length === 0 && (
        <MemberEmptyState
          variant={tab === "upcoming" ? "bookings" : "cloudCard"}
          eyebrow={tab === "upcoming" ? t("member.empty.bookings.eyebrow") : undefined}
          title={
            tab === "upcoming"
              ? t("member.empty.bookings.title")
              : tab === "waitlist"
                ? t("member.empty.waitlist.title")
                : tab === "past"
                  ? t("member.empty.past.title")
                  : t("member.empty.cancelled.title")
          }
          body={
            tab === "upcoming"
              ? t("member.empty.bookings.body")
              : tab === "waitlist"
                ? t("member.empty.waitlist.body")
                : tab === "past"
                  ? t("member.empty.past.body")
                  : t("member.empty.cancelled.body")
          }
          primaryAction={
            tab === "upcoming"
              ? { label: t("member.browseSchedule"), to: "/member/schedule" }
              : undefined
          }
          illustration={tab === "upcoming" ? "cloudCardPreview" : "noBookings"}
        />
      )}

      <div className="space-y-3">
        {tab === "waitlist"
          ? waitlist.map((w: any) => (
              <WaitlistCard
                key={w.id}
                entry={w}
                onOpen={() => setOpenClass(w.class.id)}
                onLeave={() => leave.mutate(w.id)}
              />
            ))
          : current.map((b: any) => (
              <BookingCard
                key={b.id}
                booking={b}
                attendance={attMap[b.id]}
                onOpen={() => setOpenClass(b.class.id)}
                onCancel={tab === "upcoming" ? () => setConfirmCancel(b) : undefined}
                muted={tab !== "upcoming"}
                studio={settings ?? null}
              />
            ))}
      </div>

      <Dialog open={!!confirmCancel} onOpenChange={(v) => !v && setConfirmCancel(null)}>
        <DialogContent dir={dir} className="max-w-md bg-ivory border-gold/30">
          <DialogTitle className="font-display text-2xl text-navy">
            {t("bookings.cancelTitle")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("bookings.creditReturned", { count: confirmCancel?.credit_cost ?? 0 })}
          </DialogDescription>
          {confirmCancel && (
            <div className="space-y-4">
              <div className="member-card p-4">
                <p className="font-display text-lg text-navy">{confirmCancel.class.title}</p>
                <p className="text-xs text-slate mt-1">
                  {formatDate(confirmCancel.class.starts_at)} ·{" "}
                  {formatTime(confirmCancel.class.starts_at)}
                </p>
              </div>
              <p className="text-sm text-slate">
                {t("bookings.creditReturned", { count: confirmCancel.credit_cost })}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmCancel(null)}
                  className="btn-ghost flex-1 hover:btn-ghost-hover"
                >
                  {t("bookings.keep")}
                </button>
                <button
                  onClick={() => cancel.mutate(confirmCancel.id)}
                  disabled={cancel.isPending}
                  className="btn-navy flex-1 hover:btn-navy-hover"
                >
                  {cancel.isPending ? "…" : t("bookings.cancelBooking")}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ClassDetailSheet
        classId={openClass}
        open={!!openClass}
        onOpenChange={(v) => !v && setOpenClass(null)}
        viewerCacheKey={detailViewerCacheKey}
      />
    </section>
  );
}

function StatCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="member-stat-cell">
      <p className="member-eyebrow text-slate">{label}</p>
      <p className="numeric-display numeric-display-md mt-2">{value}</p>
    </div>
  );
}

function BookingCard({
  booking,
  attendance,
  onOpen,
  onCancel,
  muted,
  studio,
}: {
  booking: any;
  attendance?: { status: string; marked_at: string | null };
  onOpen: () => void;
  onCancel?: () => void;
  muted?: boolean;
  studio?: any;
}) {
  const cls = booking.class;
  if (!cls) return null;
  const startsAt = new Date(cls.starts_at);
  const deadline = new Date(
    startsAt.getTime() - (cls.cancellation_window_hours ?? 4) * 3600 * 1000,
  );
  const canCancel = Date.now() < deadline.getTime() && booking.status === "booked";
  const isUpcoming = startsAt.getTime() >= Date.now() && booking.status === "booked";
  const title = localizedClassTitle(cls);
  const instructor =
    localizedOptionalInstructorName(cls.instructor?.name) ?? t("member.noInstructor");
  const statusLabel =
    booking.status === "cancelled"
      ? t("bookings.cancelled")
      : attendance?.status === "attended"
        ? t("bookings.attended")
        : attendance?.status === "no_show"
          ? t("bookings.noShow")
          : t("bookings.confirmed");

  function addToCalendar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const ics = buildIcs({
      uid: booking.id,
      title,
      startsAt: cls.starts_at,
      durationMinutes: cls.duration_minutes,
      location: [t("member.locationStudio"), studio?.address].filter(Boolean).join(" · "),
      description: t("member.calendarDescription", {
        hours: cls.cancellation_window_hours,
        instructor,
      }),
      studioName: studio?.studio_name ?? null,
    });
    void downloadIcs(`${title.replace(/\s+/g, "-").toLowerCase()}.ics`, ics);
    toast.success(t("member.calendarReady"));
  }
  const contactUrl = waUrl({
    to: studio?.whatsapp_number ?? studio?.public_phone,
    text: t("member.bookingHelpMessage", {
      studio: studio?.studio_name ?? "Cloud & Core",
      className: title,
      date: formatDate(cls.starts_at),
      time: formatTime(cls.starts_at),
    }),
  });

  return (
    <LessonReservationCard
      cls={cls}
      state={
        booking.status === "cancelled"
          ? { kind: "cancelled" }
          : attendance?.status === "attended"
            ? { kind: "closed" }
            : { kind: "booked" }
      }
      statusLabel={statusLabel}
      onOpen={onOpen}
      muted={muted}
    >
      {isUpcoming && (
        <>
          <span className="basis-full text-xs text-slate leading-relaxed">
            {t("booking.cancelWindow", { hours: cls.cancellation_window_hours })}
          </span>
          <div className="lesson-reservation-card__action-row">
            <button
              onClick={addToCalendar}
              className="btn-ghost inline-flex min-h-10 items-center gap-1 px-0 text-xs hover:btn-ghost-hover"
            >
              <CalendarPlus className="h-3 w-3" /> {t("member.addCalendar")}
            </button>
            <span className="basis-full text-xs text-slate leading-relaxed">
              {t("member.calendarHelp")}
            </span>
            {canCancel && onCancel ? (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCancel();
                }}
                className="btn-ghost min-h-10 px-0 text-xs hover:btn-ghost-hover"
              >
                {t("common.cancel")}
              </button>
            ) : (
              <a
                href={contactUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="btn-ghost inline-flex min-h-10 items-center gap-1 px-0 text-xs hover:btn-ghost-hover"
              >
                <MessageCircle className="h-3 w-3" /> {t("member.contactStudio")}
              </a>
            )}
          </div>
        </>
      )}
    </LessonReservationCard>
  );
}

function WaitlistCard({
  entry,
  onOpen,
  onLeave,
}: {
  entry: any;
  onOpen: () => void;
  onLeave: () => void;
}) {
  const cls = entry.class;
  if (!cls) return null;
  return (
    <LessonReservationCard
      cls={cls}
      state={
        entry.status === "ready" || entry.status === "offered"
          ? { kind: "available", spotsLeft: 1 }
          : { kind: "waiting" }
      }
      statusLabel={entry.status === "offered" ? t("bookings.offered") : t("bookings.waitingNote")}
      onOpen={onOpen}
    >
      <button
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onLeave();
        }}
        className="btn-ghost min-h-10 px-0 text-xs hover:btn-ghost-hover"
      >
        {t("booking.leaveWaitlist")}
      </button>
    </LessonReservationCard>
  );
}
