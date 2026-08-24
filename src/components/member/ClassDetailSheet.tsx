import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, CalendarPlus, Clock, MapPin, Sparkles, Users, X } from "lucide-react";
import { getClassDetail, joinWaitlist, leaveWaitlist } from "@/lib/member.functions";
import { bookClass } from "@/lib/cloud-core.functions";
import { recordMemberNotificationCampaignBooking } from "@/lib/memberNotifications.functions";
import { readCampaignAttribution } from "@/lib/memberNotificationsApi";
import { trackYogaPromo } from "@/lib/yogaPromo";
import { useYogaPromo } from "@/hooks/useYogaPromo";
import { YogaPromoBanner } from "@/components/member/YogaPromoBanner";
import {
  ClassImage,
  StateBadge,
  deriveClassState,
  formatTime,
  formatDate,
  type ClassState,
  type PremiumClassCardClass,
} from "./PremiumClassCard";
import { t, useI18n, type Lang } from "@/lib/i18n";
import {
  localizedClassMetadataChips,
  localizedClassTitle,
  localizedClassTitleParts,
  localizedOptionalInstructorName,
  localizedProgramDescription,
} from "@/lib/localized-content";
import { LtrInline, MixedLessonTitle } from "@/components/ui/bidi";
import { buildIcs, downloadIcs } from "@/lib/messageTemplate";
import { ClassArtTile, LessonAvailabilityMeter } from "@/components/visual/VisualClassCard";
import {
  formatDuration,
  formatSpots,
  getArtTileVariant,
  getFriendlyStudioLocation,
  getLessonVisualMode,
} from "@/lib/lesson-card-variants";
import { resolveClassImagePosition } from "@/lib/image-assets";
import {
  getClassDetailQueryKey,
  getFallbackViewerCacheKey,
  getMemberScheduleInvalidationTarget,
  isConcreteMemberViewerCacheKey,
  type ViewerContext,
} from "@/lib/memberQueryKeys";

type BookClassResult =
  | {
      status: "booked";
      booking_id: string;
      remaining_credits?: number | null;
      promotion_entitlement_id?: string | null;
    }
  | {
      status: "already_booked" | "full" | "insufficient_credits" | "no_active_package" | string;
      booking_id?: string | null;
      remaining_credits?: number | null;
    };

type JoinWaitlistResult = {
  status: "waiting" | "already_waiting" | string;
  position?: number | string | null;
};

type GuestDetailCtaModel =
  | { label: string; supportingCopy: string; to: "/auth"; disabled?: false }
  | { label: string; supportingCopy: string; disabled: true; to?: never };

function hasBookingId(res: BookClassResult): res is BookClassResult & { booking_id: string } {
  return res.status === "booked" && typeof res.booking_id === "string" && res.booking_id.length > 0;
}

// eslint-disable-next-line react-refresh/only-export-components
export function deriveGuestClassState(cls: PremiumClassCardClass): ClassState {
  if (cls.status === "cancelled") return { kind: "cancelled" };
  if (cls.status !== "scheduled") return { kind: "closed" };
  const spots = (cls.capacity ?? 0) - (cls.booked_count ?? 0);
  if (spots <= 0) return { kind: "full" };
  if (spots <= 2) return { kind: "almost", spotsLeft: spots };
  return { kind: "available", spotsLeft: spots };
}

// eslint-disable-next-line react-refresh/only-export-components
export function getGuestDetailCtaModel(state: ClassState, lang: Lang): GuestDetailCtaModel {
  if (state.kind === "closed" || state.kind === "cancelled") {
    return {
      label: t("booking.registrationClosed"),
      supportingCopy:
        lang === "he"
          ? "השיעור הזה לא פתוח להזמנה כרגע."
          : lang === "ar"
            ? "هذه الحصة غير متاحة للحجز الآن."
            : "This class is not open for booking right now.",
      disabled: true,
    };
  }

  if (state.kind === "full") {
    return {
      label:
        lang === "he"
          ? "התחברות לאפשרויות הזמנה"
          : lang === "ar"
            ? "سجلي الدخول لخيارات الحجز"
            : "Sign in for booking options",
      supportingCopy:
        lang === "he"
          ? "השיעור מלא כרגע. התחברות תאפשר לראות את אפשרויות ההזמנה הזמינות."
          : lang === "ar"
            ? "الحصة ممتلئة الآن. سيسمح لك تسجيل الدخول برؤية خيارات الحجز المتاحة."
            : "This class is currently full. Sign in to see the booking options available to you.",
      to: "/auth",
    };
  }

  return {
    label:
      lang === "he" ? "התחברות להזמנה" : lang === "ar" ? "سجلي الدخول للحجز" : "Sign in to book",
    supportingCopy:
      lang === "he"
        ? "הצפייה פתוחה לאורחות. מתחברות רק כשמוכנות להשלים הזמנה."
        : lang === "ar"
          ? "التصفح مفتوح للضيفات. سجلي الدخول فقط عندما تكونين جاهزة لإكمال الحجز."
          : "Guest browsing stays open. Sign in only when you are ready to complete a booking.",
    to: "/auth",
  };
}

function guestNextStepLabel(lang: Lang) {
  if (lang === "he") return "השלב הבא";
  if (lang === "ar") return "الخطوة التالية";
  return "Next step";
}

// eslint-disable-next-line react-refresh/only-export-components
export function resolveDetailViewerState({
  viewerContext,
  viewerCacheKey,
  authViewerCacheKey,
}: {
  viewerContext: ViewerContext;
  viewerCacheKey?: string;
  authViewerCacheKey: string;
}) {
  if (viewerContext === "guest") {
    return {
      isGuestView: true,
      resolvedViewerCacheKey: "guest",
    };
  }

  return {
    isGuestView: false,
    resolvedViewerCacheKey: viewerCacheKey ?? authViewerCacheKey,
  };
}

function StudioLocationInline({ value }: { value: string }) {
  const match = value.match(/Cloud\s*&\s*Core/);
  if (!match || match.index === undefined) {
    return (
      <span dir="auto">
        <bdi>{value}</bdi>
      </span>
    );
  }

  const before = value.slice(0, match.index);
  const after = value.slice(match.index + match[0].length);
  return (
    <span>
      {before}
      <bdi dir="ltr" style={{ unicodeBidi: "isolate" }}>
        Cloud &amp; Core
      </bdi>
      {after}
    </span>
  );
}

export function ClassDetailSheet({
  classId,
  open,
  onOpenChange,
  viewerContext = "member",
  viewerCacheKey,
}: {
  classId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  viewerContext?: ViewerContext;
  viewerCacheKey?: string;
}) {
  const { dir, lang } = useI18n();
  const fetchDetail = useServerFn(getClassDetail);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const yogaPromo = useYogaPromo();
  const [confirmation, setConfirmation] = useState<null | { bookingId: string; remaining: number }>(
    null,
  );
  const [authViewerCacheKey, setAuthViewerCacheKey] = useState(
    viewerCacheKey ?? getFallbackViewerCacheKey(viewerContext),
  );
  const { isGuestView, resolvedViewerCacheKey } = resolveDetailViewerState({
    viewerContext,
    viewerCacheKey,
    authViewerCacheKey,
  });
  const detailQueryEnabled =
    !!classId && open && (isGuestView || isConcreteMemberViewerCacheKey(resolvedViewerCacheKey));

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthViewerCacheKey(
        data.session?.user?.id
          ? `member:${data.session.user.id}`
          : getFallbackViewerCacheKey(viewerContext),
      );
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthViewerCacheKey(
        session?.user?.id ? `member:${session.user.id}` : getFallbackViewerCacheKey(viewerContext),
      );
    });
    return () => sub.subscription.unsubscribe();
  }, [viewerContext]);

  const { data, isLoading } = useQuery({
    queryKey: getClassDetailQueryKey(classId, resolvedViewerCacheKey),
    queryFn: () => fetchDetail({ data: { classId: classId! } }),
    enabled: detailQueryEnabled,
  });

  const bookFn = useServerFn(bookClass);
  const recordCampaignBooking = useServerFn(recordMemberNotificationCampaignBooking);
  const joinFn = useServerFn(joinWaitlist);
  const leaveFn = useServerFn(leaveWaitlist);

  const book = useMutation({
    mutationFn: () => {
      if (canUseYogaPromo) {
        trackYogaPromo("yoga_promo_booking_started", { class_id: classId });
      }
      return bookFn({ data: { classId: classId! } });
    },
    onSuccess: (res: BookClassResult) => {
      if (hasBookingId(res)) {
        if (res.promotion_entitlement_id) {
          trackYogaPromo("yoga_promo_credit_redeemed", {
            class_id: classId,
            booking_id: res.booking_id,
          });
        }
        const attribution =
          typeof window === "undefined"
            ? null
            : readCampaignAttribution(
                window.localStorage.getItem("cc-member-campaign-attribution"),
              );
        if (attribution) {
          void recordCampaignBooking({
            data: { campaignId: attribution.campaignId, bookingId: res.booking_id },
          }).catch((error) => console.warn("campaign_booking_attribution_failed", error));
        }
        toast.success(t("booking.confirmed"));
        setConfirmation({ bookingId: res.booking_id, remaining: res.remaining_credits ?? 0 });
        qc.invalidateQueries({ queryKey: ["member-home"] });
        qc.invalidateQueries(
          getMemberScheduleInvalidationTarget(viewerContext, resolvedViewerCacheKey),
        );
        qc.invalidateQueries({ queryKey: ["my-bookings-all"] });
        qc.invalidateQueries({ queryKey: ["studio-pulse"] });
      } else if (res.status === "already_booked") {
        toast(t("booking.toast.already"));
      } else if (res.status === "full") {
        toast(t("booking.toast.full"));
      } else if (res.status === "no_active_package") {
        toast(t("booking.choosePackage"));
        navigate({ to: "/member/packages" });
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
        qc.invalidateQueries({
          queryKey: getClassDetailQueryKey(classId, resolvedViewerCacheKey),
        });
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
      qc.invalidateQueries({
        queryKey: getClassDetailQueryKey(classId, resolvedViewerCacheKey),
      });
      qc.invalidateQueries({ queryKey: ["my-bookings-all"] });
    },
  });

  const cls = data?.cls;
  const matchesYogaPromoClass = Boolean(
    yogaPromo.data?.eligibleClassId && yogaPromo.data.eligibleClassId === cls?.id,
  );
  const canUseYogaPromo = Boolean(
    !isGuestView && yogaPromo.data?.creditAvailable && matchesYogaPromoClass,
  );
  const isYogaPromoClass = matchesYogaPromoClass;
  const title = cls ? localizedClassTitle(cls) : "";
  const titleParts = cls ? localizedClassTitleParts(cls, lang) : null;
  const instructor = cls ? localizedOptionalInstructorName(cls.instructor?.name) : null;
  const metaChips = cls ? localizedClassMetadataChips(cls) : [];
  const programDescription = cls ? localizedProgramDescription(cls.program_type) : null;
  const spotsLeft = cls ? Math.max(0, cls.capacity - cls.booked_count) : 0;
  const detailVisualMode = cls
    ? getLessonVisualMode({ index: 0, lesson: cls, variant: "featured", context: "classDetail" })
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
  const instructorDescriptor = instructor
    ? lang === "he"
      ? `בהנחיית ${instructor}`
      : lang === "ar"
        ? `مع ${instructor}`
        : `With ${instructor}`
    : null;
  const state = cls
    ? isGuestView
      ? deriveGuestClassState(cls)
      : deriveClassState(cls, {
          booked: data?.myBooking?.status === "booked",
          waiting: data?.myWaitlist?.status === "waiting" || data?.myWaitlist?.status === "ready",
          remainingCredits: canUseYogaPromo
            ? Math.max(data?.member?.remaining_credits ?? 0, cls.credit_cost)
            : (data?.member?.remaining_credits ?? 0),
          hasActivePackage: canUseYogaPromo || data?.hasActivePackage,
        })
    : null;
  const guestDetailCta = isGuestView && state ? getGuestDetailCtaModel(state, lang) : null;

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
        className="lesson-detail w-[calc(100vw-1rem)] max-w-3xl max-h-[calc(100dvh-1rem)] p-0 overflow-hidden gap-0 bg-ivory border-gold/30 shadow-[0_34px_90px_-42px_rgba(11,29,58,0.95),0_0_0_1px_rgba(212,175,106,0.18)]"
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
              <MixedLessonTitle
                as="h2"
                brand={titleParts?.brand ?? null}
                program={titleParts?.program ?? title}
                dir={dir}
                className="lesson-detail__title member-mixed-title"
              />
              <div className="lesson-detail__meta-line">
                <span className="lesson-detail__time" dir="ltr">
                  <LtrInline>{formatDate(cls.starts_at)}</LtrInline>
                </span>
                <span aria-hidden="true">·</span>
                <span className="lesson-detail__time" dir="ltr">
                  <LtrInline>{formatTime(cls.starts_at)}</LtrInline>
                </span>
                <span aria-hidden="true">·</span>
                <span>{durationLabel}</span>
                <span aria-hidden="true">·</span>
                <span>{spotsLabel}</span>
              </div>
              <div className="lesson-detail__descriptor">
                {instructorDescriptor ? (
                  <>
                    <span dir="auto">
                      <bdi>{instructorDescriptor}</bdi>
                    </span>
                    <span aria-hidden="true">·</span>
                  </>
                ) : null}
                <StudioLocationInline value="Cloud & Core Studio" />
              </div>
              <div dir={dir} className="lesson-chip-row lesson-chip-row-hero">
                {metaChips.slice(0, 3).map((chip) => (
                  <span key={chip} className="member-class-meta-chip" dir="auto">
                    <bdi>{chip}</bdi>
                  </span>
                ))}
              </div>
              <LessonAvailabilityMeter
                capacity={cls.capacity}
                bookedCount={cls.booked_count}
                lang={lang}
                dir={dir}
              />
            </div>

            <div className="lesson-detail__body">
              <div className="lesson-detail__visual">
                {detailVisualMode === "image" ? (
                  <>
                    <ClassImage
                      cls={cls}
                      variant="hero"
                      eager
                      imagePosition={resolveClassImagePosition(cls)}
                      className="lesson-detail__image"
                    />
                    <div
                      className="pointer-events-none absolute inset-0 z-10"
                      style={{
                        background:
                          "linear-gradient(to top, rgba(11,29,58,0.42) 0%, transparent 42%)",
                      }}
                      aria-hidden
                    />
                    {state && (
                      <div className="lesson-detail__visual-chip">
                        <StateBadge state={state} />
                      </div>
                    )}
                  </>
                ) : (
                  <ClassArtTile
                    programType={cls.program_type}
                    tone={cls.energy}
                    lang={lang}
                    variant={artTileVariant}
                  />
                )}
              </div>

              <div className="lesson-detail__info-grid">
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
                    value={<StudioLocationInline value={locationLabel} />}
                  />
                  <Stat
                    icon={<Users className="h-3 w-3 text-gold" />}
                    label={t("common.spots")}
                    value={spotsLabel}
                  />
                  {guestDetailCta ? (
                    <Stat
                      icon={<Sparkles className="h-3 w-3 text-gold" />}
                      label={guestNextStepLabel(lang)}
                      value={guestDetailCta.label}
                    />
                  ) : (
                    <Stat
                      icon={<Sparkles className="h-3 w-3 text-gold" />}
                      label={t("common.credits")}
                      value={creditLabel}
                    />
                  )}
                </div>

                {programDescription && (
                  <section className="lesson-detail__section lesson-detail__program">
                    <p>{programDescription}</p>
                  </section>
                )}
              </div>

              <div className="lesson-detail__section lesson-detail__notes">
                <p className="member-eyebrow">{t("booking.notes")}</p>
                <p className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-gold" />{" "}
                  {t("booking.cancelWindow", { hours: cls.cancellation_window_hours })}
                </p>
                <p>{t("booking.bring")}</p>
              </div>

              {isYogaPromoClass ? (
                <YogaPromoBanner
                  status={yogaPromo.data}
                  loading={yogaPromo.isLoading}
                  claimPending={yogaPromo.claim.isPending}
                  publicAudience={isGuestView}
                  onClaim={
                    isGuestView
                      ? () => navigate({ to: "/auth" })
                      : yogaPromo.data?.eligible
                        ? () => yogaPromo.claim.mutate()
                        : undefined
                  }
                  className="rounded-2xl"
                />
              ) : null}

              {canUseYogaPromo ? (
                <div className="rounded-2xl border border-gold/45 bg-gold/10 px-4 py-3 text-sm font-semibold leading-6 text-navy">
                  <Sparkles className="me-2 inline h-4 w-4 text-gold" aria-hidden="true" />
                  {t("promo.yoga.bookingEligible")}
                </div>
              ) : null}

              <div className="lesson-detail__cta">
                {guestDetailCta ? (
                  <>
                    {guestDetailCta.disabled ? (
                      <button disabled className="btn-ghost w-full opacity-60 cursor-not-allowed">
                        {guestDetailCta.label}
                      </button>
                    ) : (
                      <Link
                        to={guestDetailCta.to}
                        className="btn-navy w-full hover:btn-navy-hover text-center justify-center flex items-center gap-2"
                      >
                        {guestDetailCta.label}
                      </Link>
                    )}
                    <p className="text-sm leading-6 text-slate">{guestDetailCta.supportingCopy}</p>
                  </>
                ) : data?.myBooking?.status === "booked" ? (
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
                ) : state?.kind === "package_required" ? (
                  <Link to="/member/packages" className="btn-navy w-full hover:btn-navy-hover">
                    {t("booking.choosePackage")}
                  </Link>
                ) : state?.kind === "low_credits" ? (
                  <Link to="/member/packages" className="btn-navy w-full hover:btn-navy-hover">
                    {t("class.cta.topUpCredits")}
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

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
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
