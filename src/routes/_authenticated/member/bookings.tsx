import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, Sparkles, MessageCircle, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { getMyBookingsAll, memberCancelBooking, leaveWaitlist } from "@/lib/member.functions";
import { getPublicStudioSettings } from "@/lib/studioSettings.functions";
import { waUrl, buildIcs, downloadIcs } from "@/lib/messageTemplate";
import {
  ClassImage,
  formatDate,
  formatDurationLabel,
  formatTime,
  MemberEmptyState,
  StateBadge,
} from "@/components/member/PremiumClassCard";
import { ClassDetailSheet } from "@/components/member/ClassDetailSheet";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { studioImages, localizedAlt } from "@/lib/image-assets";
import { t, useI18n, getLocale } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  localizedClassTitle,
  localizedClassTitleParts,
  localizedOptionalInstructorName,
} from "@/lib/localized-content";
import { LtrInline, MixedLessonTitle } from "@/components/ui/bidi";

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

  const cancelFn = useServerFn(memberCancelBooking);
  const leaveFn = useServerFn(leaveWaitlist);

  const cancel = useMutation({
    mutationFn: (bookingId: string) => cancelFn({ data: { bookingId } }),
    onSuccess: (res: any) => {
      if (res.status === "cancelled") {
        toast.success(t("bookings.toastCancelled"));
        qc.invalidateQueries({ queryKey: ["my-bookings-all"] });
        qc.invalidateQueries({ queryKey: ["member-home"] });
        qc.invalidateQueries({ queryKey: ["member-schedule"] });
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
        <div className="relative min-h-[150px] sm:min-h-[180px] md:min-h-[190px] bg-navy md:border-s md:border-gold/20">
          <img
            src={studioImages.brandBannerNavy.src}
            alt={localizedAlt(studioImages.brandBannerNavy, getLocale())}
            loading="eager"
            className="absolute inset-0 h-full w-full object-cover outline outline-1 -outline-offset-1 outline-ivory/10"
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
              <WaitlistCard key={w.id} entry={w} onLeave={() => leave.mutate(w.id)} />
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
  const { dir, lang } = useI18n();
  const cls = booking.class;
  if (!cls) return null;
  const startsAt = new Date(cls.starts_at);
  const deadline = new Date(
    startsAt.getTime() - (cls.cancellation_window_hours ?? 4) * 3600 * 1000,
  );
  const canCancel = Date.now() < deadline.getTime() && booking.status === "booked";
  const isUpcoming = startsAt.getTime() >= Date.now() && booking.status === "booked";
  const title = localizedClassTitle(cls);
  const titleParts = localizedClassTitleParts(cls, lang);
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
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`visual-class-card member-card group cursor-pointer overflow-hidden outline-none transition-[transform,box-shadow,opacity] hover:-translate-y-0.5 hover:member-card-hover focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory ${
        muted ? "opacity-80" : ""
      }`}
    >
      <div className="relative overflow-hidden bg-navy">
        <ClassImage cls={cls} className="member-class-media" />
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(11,29,58,0.06) 0%, rgba(11,29,58,0.10) 48%, rgba(11,29,58,0.34) 100%)",
          }}
        />
        <div className="absolute start-4 top-4 z-10 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-navy/68 px-3 py-1.5 text-xs font-semibold tabular-nums text-ivory shadow-[0_16px_30px_-24px_rgba(11,29,58,0.95)] backdrop-blur-md">
          <LtrInline>{formatTime(cls.starts_at)}</LtrInline>
          <span className="h-3 w-px bg-ivory/22" aria-hidden />
          <bdi className="font-medium text-ivory/72">
            {formatDurationLabel(cls.duration_minutes)}
          </bdi>
        </div>
        <div className="absolute end-4 top-4 z-10 flex flex-wrap justify-end gap-2">
          {attendance?.status === "attended" && (
            <span className="member-chip">{t("bookings.attended")}</span>
          )}
          {attendance?.status === "no_show" && (
            <span className="member-chip">{t("bookings.noShow")}</span>
          )}
          {booking.status === "cancelled" && (
            <span className="member-chip">{t("bookings.cancelled")}</span>
          )}
        </div>
      </div>

      <div className="bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,247,242,0.98))] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="member-eyebrow">
              <LtrInline>{formatDate(cls.starts_at)}</LtrInline>
            </p>
            <MixedLessonTitle
              as="h3"
              brand={titleParts.brand}
              program={titleParts.program}
              dir={dir}
              className="mt-1 font-sans text-[22px] font-semibold leading-tight tracking-normal text-navy"
            />
          </div>
          <span className="rounded-full border border-gold/30 bg-sand/45 px-3 py-1 text-xs font-medium text-slate">
            {statusLabel}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-slate">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3 text-gold" />
            {t("member.locationStudio")}
          </span>
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-gold" />
            {instructor}
          </span>
        </div>

        {isUpcoming && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t hairline pt-3">
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
        )}
      </div>
    </div>
  );
}

function WaitlistCard({ entry, onLeave }: { entry: any; onLeave: () => void }) {
  const { dir, lang } = useI18n();
  const cls = entry.class;
  if (!cls) return null;
  const title = localizedClassTitle(cls);
  const titleParts = localizedClassTitleParts(cls, lang);
  return (
    <div className="member-card overflow-hidden">
      <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[180px_1fr]">
        <ClassImage cls={cls} className="aspect-square sm:aspect-auto" />
        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-slate">
                <LtrInline>{formatDate(cls.starts_at)}</LtrInline>
                <span aria-hidden="true"> · </span>
                <LtrInline>{formatTime(cls.starts_at)}</LtrInline>
              </p>
              <MixedLessonTitle
                as="p"
                brand={titleParts.brand}
                program={titleParts.program}
                dir={dir}
                className="member-mixed-title mt-1 text-xl leading-tight text-navy"
              />
            </div>
            <StateBadge
              state={
                { kind: entry.status === "ready" ? "available" : "waiting", spotsLeft: 0 } as any
              }
            />
          </div>
          {entry.status === "offered" ? (
            <p className="text-xs text-navy">{t("bookings.offered")}</p>
          ) : (
            <p className="text-xs text-slate">{t("bookings.waitingNote")}</p>
          )}
          <div className="pt-2 border-t hairline flex justify-start">
            <button
              onClick={onLeave}
              className="border-b border-gold/40 text-xs font-medium text-navy hover:text-gold"
            >
              {t("booking.leaveWaitlist")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
