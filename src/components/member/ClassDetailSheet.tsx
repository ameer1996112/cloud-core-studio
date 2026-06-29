import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, CalendarPlus, Clock, MapPin, Sparkles, Users, X } from "lucide-react";
import { getClassDetail, joinWaitlist, leaveWaitlist } from "@/lib/member.functions";
import { bookClass } from "@/lib/cloud-core.functions";
import {
  ClassImage,
  deriveClassState,
  formatTime,
  formatDate,
  StateBadge,
  type PremiumClassCardClass,
} from "./PremiumClassCard";
import { t, useI18n } from "@/lib/i18n";
import {
  localizedClassMetadataChips,
  localizedClassTitle,
  localizedClassTitleParts,
  localizedOptionalInstructorName,
  localizedProgramDescription,
} from "@/lib/localized-content";
import { LtrInline, MixedLessonTitle } from "@/components/ui/bidi";
import { buildIcs, downloadIcs } from "@/lib/messageTemplate";
import { ClassArtTile } from "@/components/visual/VisualClassCard";
import {
  formatDuration,
  formatSpots,
  getArtTileVariant,
  getFriendlyStudioLocation,
  getLessonVisualMode,
} from "@/lib/lesson-card-variants";

type BookClassResult =
  | { status: "booked"; booking_id: string; remaining_credits?: number | null }
  | {
      status: "already_booked" | "full" | "insufficient_credits" | string;
      booking_id?: string | null;
      remaining_credits?: number | null;
    };

type JoinWaitlistResult = {
  status: "waiting" | "already_waiting" | string;
  position?: number | string | null;
};

function hasBookingId(res: BookClassResult): res is BookClassResult & { booking_id: string } {
  return res.status === "booked" && typeof res.booking_id === "string" && res.booking_id.length > 0;
}

export function ClassDetailSheet({
  classId,
  open,
  onOpenChange,
}: {
  classId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { dir, lang } = useI18n();
  const fetchDetail = useServerFn(getClassDetail);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirmation, setConfirmation] = useState<null | { bookingId: string; remaining: number }>(
    null,
  );

  const { data, isLoading } = useQuery({
    queryKey: ["class-detail", classId],
    queryFn: () => fetchDetail({ data: { classId: classId! } }),
    enabled: !!classId && open,
  });

  const bookFn = useServerFn(bookClass);
  const joinFn = useServerFn(joinWaitlist);
  const leaveFn = useServerFn(leaveWaitlist);

  const book = useMutation({
    mutationFn: () => bookFn({ data: { classId: classId! } }),
    onSuccess: (res: BookClassResult) => {
      if (hasBookingId(res)) {
        toast.success(t("booking.confirmed"));
        setConfirmation({ bookingId: res.booking_id, remaining: res.remaining_credits ?? 0 });
        qc.invalidateQueries({ queryKey: ["member-home"] });
        qc.invalidateQueries({ queryKey: ["member-schedule"] });
        qc.invalidateQueries({ queryKey: ["my-bookings-all"] });
        qc.invalidateQueries({ queryKey: ["studio-pulse"] });
      } else if (res.status === "already_booked") {
        toast(t("booking.toast.already"));
      } else if (res.status === "full") {
        toast(t("booking.toast.full"));
      } else if (res.status === "insufficient_credits") {
        toast(t("booking.toast.credits"));
      } else {
        toast(t("booking.toast.error"));
      }
    },
    onError: (err) => {
      console.error("[booking] bookClass failed", err);
      toast.error(t("booking.toast.error"));
    },
  });

  const join = useMutation({
    mutationFn: () => joinFn({ data: { classId: classId! } }),
    onSuccess: (res: JoinWaitlistResult) => {
      if (res.status === "waiting" || res.status === "already_waiting") {
        toast.success(t("booking.toast.waiting", { position: res.position }));
        qc.invalidateQueries({ queryKey: ["class-detail", classId] });
        qc.invalidateQueries({ queryKey: ["my-bookings-all"] });
      } else {
        toast(t("booking.toast.waitlistError"));
      }
    },
  });

  const leave = useMutation({
    mutationFn: (entryId: string) => leaveFn({ data: { entryId } }),
    onSuccess: () => {
      toast.success(t("booking.toast.left"));
      qc.invalidateQueries({ queryKey: ["class-detail", classId] });
      qc.invalidateQueries({ queryKey: ["my-bookings-all"] });
    },
  });

  const cls = data?.cls;
  const title = cls ? localizedClassTitle(cls) : "";
  const titleParts = cls ? localizedClassTitleParts(cls, lang) : null;
  const instructor = cls ? localizedOptionalInstructorName(cls.instructor?.name) : null;
  const metaChips = cls ? localizedClassMetadataChips(cls) : [];
  const programDescription = cls ? localizedProgramDescription(cls.program_type) : null;
  const spotsLeft = cls ? Math.max(0, cls.capacity - cls.booked_count) : 0;
  const detailVisualMode = cls
    ? getLessonVisualMode({ index: 0, lesson: cls, variant: "hero", context: "detail" })
    : "artTile";
  const artTileVariant = cls ? getArtTileVariant(cls, 0) : "a";
  const locationLabel = getFriendlyStudioLocation(lang);
  const durationLabel = cls ? formatDuration(cls.duration_minutes, lang) : "";
  const spotsLabel = cls ? formatSpots(spotsLeft, cls.capacity, lang) : "";
  const creditLabel = cls
    ? cls.credit_cost === 1
      ? t("member.oneCredit")
      : `${cls.credit_cost} ${t("common.credits")}`
    : "";
  const state = cls
    ? deriveClassState(cls, {
        booked: data?.myBooking?.status === "booked",
        waiting: data?.myWaitlist?.status === "waiting" || data?.myWaitlist?.status === "ready",
        remainingCredits: data?.member?.remaining_credits ?? 0,
      })
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setConfirmation(null);
        onOpenChange(v);
      }}
    >
      <DialogContent
        dir={dir}
        className="lesson-detail w-[calc(100vw-1rem)] max-w-2xl max-h-[calc(100dvh-1rem)] p-0 overflow-hidden gap-0 bg-ivory border-gold/30 shadow-[0_34px_90px_-42px_rgba(11,29,58,0.95),0_0_0_1px_rgba(212,175,106,0.18)]"
      >
        <DialogTitle className="sr-only">{t("booking.details")}</DialogTitle>
        <DialogDescription className="sr-only">{t("booking.bring")}</DialogDescription>
        <button
          onClick={() => onOpenChange(false)}
          aria-label={t("common.close")}
          className="absolute top-4 end-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-gold/35 bg-ivory/95 shadow-[0_18px_34px_-24px_rgba(11,29,58,0.75)] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-white"
        >
          <X className="h-4 w-4 text-navy" />
        </button>

        {confirmation && cls ? (
          <ConfirmationView
            cls={cls}
            confirmation={confirmation}
            onDone={() => {
              setConfirmation(null);
              onOpenChange(false);
              navigate({ to: "/member/bookings" });
            }}
          />
        ) : isLoading || !cls ? (
          <div className="h-80 skeleton-brand" />
        ) : (
          <>
            <div className="lesson-detail__summary">
              <div className="min-w-0">
                <div className="lesson-detail__meta-line">
                  <span className="lesson-detail__time" dir="ltr">
                    <LtrInline>{formatDate(cls.starts_at)}</LtrInline>
                    <span aria-hidden="true"> · </span>
                    <LtrInline>{formatTime(cls.starts_at)}</LtrInline>
                  </span>
                  {metaChips[0] ? (
                    <span className="member-class-meta-chip" dir="auto">
                      <bdi>{metaChips[0]}</bdi>
                    </span>
                  ) : null}
                </div>
                <MixedLessonTitle
                  as="h2"
                  brand={titleParts?.brand ?? null}
                  program={titleParts?.program ?? title}
                  dir={dir}
                  className="lesson-detail__title member-mixed-title mt-3 text-[clamp(1.75rem,7vw,2.55rem)] leading-[1.02] text-navy text-balance"
                />
              </div>
              {state && <StateBadge state={state} />}
            </div>

            <div className="lesson-detail__visual">
              {detailVisualMode === "image" ? (
                <ClassImage cls={cls} variant="hero" eager className="lesson-detail__image">
                  <div
                    className="absolute inset-0 z-[2] bg-linear-to-t from-navy/45 via-transparent to-transparent pointer-events-none"
                    aria-hidden
                  />
                </ClassImage>
              ) : (
                <ClassArtTile
                  programType={cls.program_type}
                  tone={cls.energy}
                  lang={lang}
                  variant={artTileVariant}
                />
              )}
            </div>

            <div className="lesson-detail__body">
              <div className="lesson-detail__key-card">
                <Stat
                  icon={<Clock className="h-3 w-3 text-gold" />}
                  label={t("common.when")}
                  value={`${formatTime(cls.starts_at)} · ${durationLabel}`}
                />
                {instructor && (
                  <Stat
                    icon={<Sparkles className="h-3 w-3 text-gold" />}
                    label={t("common.with")}
                    value={instructor}
                  />
                )}
                <Stat
                  icon={<MapPin className="h-3 w-3 text-gold" />}
                  label={t("common.where")}
                  value={locationLabel}
                />
                <Stat
                  icon={<Users className="h-3 w-3 text-gold" />}
                  label={t("common.spots")}
                  value={spotsLabel}
                />
                <Stat
                  icon={<Sparkles className="h-3 w-3 text-gold" />}
                  label={t("common.credits")}
                  value={creditLabel}
                />
              </div>

              <section className="lesson-detail__section">
                <div className="lesson-chip-row lesson-chip-row-hero">
                  {metaChips.map((chip) => (
                    <span key={chip} className="member-class-meta-chip" dir="auto">
                      <bdi>{chip}</bdi>
                    </span>
                  ))}
                </div>
                {programDescription && (
                  <p className="mt-3 text-sm text-slate leading-relaxed">{programDescription}</p>
                )}
              </section>

              <div className="lesson-detail__section lesson-detail__notes">
                <p className="member-eyebrow">{t("booking.notes")}</p>
                <p className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-gold" />{" "}
                  {t("booking.cancelWindow", { hours: cls.cancellation_window_hours })}
                </p>
                <p>{t("booking.bring")}</p>
              </div>

              <div className="lesson-detail__cta">
                {data?.myBooking?.status === "booked" ? (
                  <Link to="/member/bookings" className="btn-navy w-full hover:btn-navy-hover">
                    {t("booking.viewMine")}{" "}
                    <ArrowRight className="h-3 w-3 directional-icon-forward" />
                  </Link>
                ) : state?.kind === "waiting" && data?.myWaitlist?.id ? (
                  <button
                    onClick={() => leave.mutate(data.myWaitlist!.id)}
                    className="btn-ghost w-full hover:btn-ghost-hover"
                  >
                    {t("booking.leaveWaitlist")}
                  </button>
                ) : state?.kind === "waitlist_available" ? (
                  <button
                    onClick={() => join.mutate()}
                    disabled={join.isPending}
                    className="btn-navy w-full hover:btn-navy-hover disabled:opacity-60"
                  >
                    {join.isPending ? "…" : t("booking.joinWaitlist")}
                  </button>
                ) : state?.kind === "low_credits" ? (
                  <Link to="/member/packages" className="btn-navy w-full hover:btn-navy-hover">
                    {t("booking.choosePackage")}
                  </Link>
                ) : state?.kind === "closed" || state?.kind === "cancelled" ? (
                  <button disabled className="btn-ghost w-full opacity-60 cursor-not-allowed">
                    {t("booking.registrationClosed")}
                  </button>
                ) : (
                  <button
                    onClick={() => book.mutate()}
                    disabled={book.isPending}
                    className="btn-navy w-full hover:btn-navy-hover disabled:opacity-60"
                  >
                    {book.isPending ? t("booking.saving") : t("booking.bookCredit")}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="lesson-detail__stat">
      <p className="member-eyebrow flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-display text-base text-navy truncate">{value}</p>
    </div>
  );
}

function ConfirmationView({
  cls,
  confirmation,
  onDone,
}: {
  cls: PremiumClassCardClass;
  confirmation: { bookingId: string; remaining: number };
  onDone: () => void;
}) {
  const code = confirmation.bookingId.slice(0, 6).toUpperCase();
  const title = localizedClassTitle(cls);
  const instructor = localizedOptionalInstructorName(cls.instructor?.name);

  function addToCalendar() {
    const ics = buildIcs({
      uid: confirmation.bookingId,
      title,
      startsAt: cls.starts_at,
      durationMinutes: cls.duration_minutes,
      location: t("member.locationStudio"),
      description: t("member.calendarDescription", {
        hours: cls.cancellation_window_hours,
        instructor: instructor ?? t("member.noInstructor"),
      }),
      studioName: "Cloud & Core",
    });
    void downloadIcs(`${title.replace(/\s+/g, "-").toLowerCase()}.ics`, ics);
    toast.success(t("member.calendarReady"));
  }

  return (
    <div className="p-6 sm:p-8 space-y-5">
      <div className="text-center space-y-3">
        <div className="member-panel-powder mx-auto h-14 w-14 rounded-full flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-gold" />
        </div>
        <p className="text-xs font-medium text-slate">{t("booking.cloudCard")}</p>
        <h2 className="font-display text-3xl text-navy leading-tight">{t("booking.saved")}</h2>
      </div>

      {/* The card itself — premium, print-friendly look */}
      <div
        className="relative overflow-hidden rounded-2xl border border-gold/40 bg-ivory shadow-[0_1px_0_rgba(212,175,106,0.4),0_24px_60px_-30px_rgba(11,29,58,0.35)]"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(183,204,230,0.18), rgba(232,223,209,0.25) 60%, rgba(212,175,106,0.12))",
        }}
      >
        <div className="absolute inset-x-5 top-0 h-px bg-gold/30" />
        <div className="px-5 sm:px-6 py-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate">{t("bookings.confirmed")}</p>
              <p className="font-display text-2xl text-navy mt-1 leading-tight truncate" dir="auto">
                <bdi>{title}</bdi>
              </p>
            </div>
            <div className="shrink-0 text-end">
              <p className="text-xs font-medium text-slate">{t("common.code")}</p>
              <p className="font-mono text-sm text-navy mt-0.5">{code}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <CardField
              label={t("common.when")}
              value={`${formatDate(cls.starts_at)} · ${formatTime(cls.starts_at)}`}
            />
            <CardField
              label={t("common.duration")}
              value={t("member.durationMinutes", { count: cls.duration_minutes })}
            />
            <CardField label={t("common.where")} value={t("member.locationStudio")} />
            {instructor && <CardField label={t("common.with")} value={instructor} />}
          </div>

          <div className="flex items-center justify-between border-t hairline pt-3 text-xs text-slate">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-gold" />
              {t("booking.cancelWindow", { hours: cls.cancellation_window_hours }).replace(
                /\.$/,
                "",
              )}
            </span>
            <span className="text-navy">
              {t("booking.left", { count: confirmation.remaining })}
            </span>
          </div>
        </div>
        <div className="absolute inset-x-5 bottom-0 h-px bg-gold/30" />
      </div>

      <p className="text-center text-xs text-slate font-display">{t("booking.savedLine")}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <button onClick={addToCalendar} className="btn-outline w-full justify-center">
          <CalendarPlus className="h-3 w-3" /> {t("member.addCalendar")}
        </button>
        <button onClick={onDone} className="btn-navy w-full justify-center hover:btn-navy-hover">
          {t("booking.myBookings")} <ArrowRight className="h-3 w-3 directional-icon-forward" />
        </button>
      </div>
    </div>
  );
}

function CardField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate">{label}</p>
      <p className="font-display text-sm text-navy mt-0.5 truncate">{value}</p>
    </div>
  );
}
