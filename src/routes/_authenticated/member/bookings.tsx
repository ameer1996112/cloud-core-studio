import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Clock, MapPin, Sparkles, MessageCircle, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { getMyBookingsAll, memberCancelBooking, leaveWaitlist } from "@/lib/member.functions";
import { getPublicStudioSettings } from "@/lib/studioSettings.functions";
import { waUrl, buildIcs, downloadIcs } from "@/lib/messageTemplate";
import {
  ClassImage,
  formatDate,
  formatTime,
  MemberEmptyState,
  StateBadge,
} from "@/components/member/PremiumClassCard";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { studioImages, localizedAlt } from "@/lib/image-assets";
import { t, useI18n, getLocale } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/member/bookings")({
  head: () => ({ meta: [{ title: "ההזמנות שלי — Cloud & Core" }] }),
  component: MyBookings,
});

type Tab = "upcoming" | "past" | "waitlist" | "cancelled";

function MyBookings() {
  useI18n();
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
  // Hide internal E2E seed classes from the user-facing UI.
  const isDemoNoise = (c: any) =>
    !c || /^E2E\s/i.test(c.title ?? "") || /^E2E\s/i.test(c.instructor?.name ?? "");
  const bookings = (data?.bookings ?? []).filter((b: any) => !isDemoNoise(b.class));
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
  const waitlist = (data?.waitlist ?? []).filter((w: any) => !isDemoNoise(w.class));

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
    <section className="space-y-6 pb-10 max-w-3xl mx-auto">
      {/* Cloud Card premium navy banner */}
      <div className="relative -mx-4 sm:mx-0 overflow-hidden sm:rounded-[20px] aspect-[21/8] max-h-[180px] bg-navy">
        <img
          src={studioImages.brandBannerNavy.src}
          alt={localizedAlt(studioImages.brandBannerNavy, getLocale())}
          loading="eager"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 border-b border-gold/30">
        {(["upcoming", "waitlist", "past", "cancelled"] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`px-4 py-2 text-[11px] uppercase tracking-[0.22em] -mb-px border-b-2 transition ${
              tab === tabKey
                ? "border-gold text-navy"
                : "border-transparent text-slate hover:text-navy"
            }`}
          >
            {tabKey === "upcoming"
              ? t("bookings.upcoming")
              : tabKey === "waitlist"
                ? t("bookings.waitlist")
                : tabKey === "past"
                  ? t("bookings.past")
                  : t("bookings.cancelled")}{" "}
            <span className="text-slate">· {counts[tabKey]}</span>
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 skeleton-brand rounded-[8px]" />
          ))}
        </div>
      )}

      {!isLoading && current.length === 0 && (
        <MemberEmptyState
          title={
            tab === "upcoming"
              ? t("bookings.emptyUpcoming")
              : tab === "waitlist"
                ? t("bookings.emptyWaitlist")
                : tab === "past"
                  ? t("bookings.emptyPast")
                  : t("bookings.emptyCancelled")
          }
          body={t("bookings.emptyBody")}
          cta={
            tab === "upcoming"
              ? { label: t("member.browseSchedule"), to: "/member/schedule" }
              : undefined
          }
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
                onCancel={tab === "upcoming" ? () => setConfirmCancel(b) : undefined}
                muted={tab !== "upcoming"}
                studio={settings ?? null}
              />
            ))}
      </div>

      <Dialog open={!!confirmCancel} onOpenChange={(v) => !v && setConfirmCancel(null)}>
        <DialogContent className="max-w-md bg-ivory border-gold/30">
          <DialogTitle className="font-display italic text-2xl text-navy">
            {t("bookings.cancelTitle")}
          </DialogTitle>
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
    </section>
  );
}

function BookingCard({
  booking,
  attendance,
  onCancel,
  muted,
  studio,
}: {
  booking: any;
  attendance?: { status: string; marked_at: string | null };
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

  function addToCalendar() {
    const ics = buildIcs({
      uid: booking.id,
      title: cls.title,
      startsAt: cls.starts_at,
      durationMinutes: cls.duration_minutes,
      location: [cls.room_ref?.name ?? cls.room, studio?.address].filter(Boolean).join(" · "),
      description: `Cancel up to ${cls.cancellation_window_hours}h before. Instructor: ${cls.instructor?.name ?? "—"}.`,
      studioName: studio?.studio_name ?? null,
    });
    downloadIcs(`${cls.title.replace(/\s+/g, "-").toLowerCase()}.ics`, ics);
  }
  const contactUrl = waUrl({
    to: studio?.whatsapp_number ?? studio?.public_phone,
    text: `Hi ${studio?.studio_name ?? "the studio"}, I need help with my booking for ${cls.title} on ${formatDate(cls.starts_at)} at ${formatTime(cls.starts_at)}.`,
  });

  return (
    <div
      className={`visual-class-card relative aspect-[16/9] min-h-[220px] max-h-[360px] overflow-hidden rounded-[24px] bg-navy shadow-[0_16px_36px_-18px_rgba(11,29,58,0.45)] ${muted ? "opacity-80" : ""}`}
    >
      <ClassImage cls={cls} className="absolute inset-0 h-full w-full" />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(var(--ovr-dir, to left), rgba(11,29,58,0.20) 0%, rgba(11,29,58,0.62) 45%, rgba(11,29,58,0.92) 100%)",
        }}
      />
      <div
        className="relative h-full p-4 text-ivory flex flex-col gap-2"
        style={{ maxWidth: "68%", marginInlineEnd: "auto" }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] tracking-[0.18em] text-ivory/75 tabular-nums">
              {formatDate(cls.starts_at)} · {formatTime(cls.starts_at)}
            </p>
            <p className="font-display text-[20px] leading-tight mt-1 truncate text-ivory drop-shadow-[0_1px_2px_rgba(11,29,58,0.55)]">
              {cls.title}
            </p>
          </div>
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
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ivory/85">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3 text-gold" />
            {cls.room_ref?.name ?? cls.room ?? "סטודיו Cloud & Core"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-gold" />
            {cls.instructor?.name ?? "—"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3 text-gold" />
            {cls.duration_minutes}m
          </span>
        </div>
        {isUpcoming && (
          <div className="mt-auto pt-2 border-t border-ivory/15 flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={addToCalendar}
              className="inline-flex items-center gap-1 text-[10px] tracking-[0.18em] text-gold hover:text-ivory"
            >
              <CalendarPlus className="h-3 w-3" /> {t("member.addCalendar")}
            </button>
            {canCancel && onCancel ? (
              <button
                onClick={onCancel}
                className="text-[10px] tracking-[0.18em] text-ivory/90 hover:text-gold border-b border-ivory/40"
              >
                Cancel
              </button>
            ) : (
              <a
                href={contactUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] tracking-[0.18em] text-gold hover:text-ivory"
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
  const cls = entry.class;
  if (!cls) return null;
  return (
    <div className="member-card overflow-hidden">
      <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[180px_1fr]">
        <ClassImage cls={cls} className="aspect-square sm:aspect-auto" />
        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate">
                {formatDate(cls.starts_at)} · {formatTime(cls.starts_at)}
              </p>
              <p className="font-display text-xl text-navy leading-tight mt-1">{cls.title}</p>
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
          <div className="pt-2 border-t hairline flex justify-end">
            <button
              onClick={onLeave}
              className="text-[10px] uppercase tracking-[0.22em] text-gold hover:text-navy border-b border-gold/40"
            >
              {t("booking.leaveWaitlist")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
