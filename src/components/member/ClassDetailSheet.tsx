import "@/components/member/design/reference-system.css";
import { BookingConfirmationContent } from "./BookingConfirmationContent";
import { ReviewButton } from "@/components/member/design/VisualSystem";
import { PackageBookingGuide } from "./PackageBookingGuide";
import { useDialogReturnFocus } from "@/hooks/use-dialog-return-focus";
import { deriveGuestClassState } from "./guest-class-state";
// eslint-disable-next-line react-refresh/only-export-components
export { deriveGuestClassState } from "./guest-class-state";
import { ClassDetailContent } from "./ClassDetailContent";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, X } from "lucide-react";
import { getClassDetail, joinWaitlist, leaveWaitlist } from "@/lib/member.functions";
import { bookClass } from "@/lib/cloud-core.functions";
import { recordMemberNotificationCampaignBooking } from "@/lib/memberNotifications.functions";
import { readCampaignAttribution } from "@/lib/memberNotificationsApi";
import { trackYogaPromo } from "@/lib/yogaPromo";
import { useYogaPromo } from "@/hooks/useYogaPromo";
import { YogaPromoBanner } from "@/components/member/YogaPromoBanner";
import {
  deriveClassState,
  formatTime,
  formatDate,
  type ClassState,
  type PremiumClassCardClass,
} from "./PremiumClassCard";
import { t, useI18n, type Lang } from "@/lib/i18n";
import { localizedClassTitle, localizedOptionalInstructorName } from "@/lib/localized-content";
import { LtrInline } from "@/components/ui/bidi";
import { buildIcs, downloadIcs } from "@/lib/messageTemplate";
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
  const returnFocus = useDialogReturnFocus();
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

  const { data, isLoading, isError, refetch } = useQuery({
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
        if ("promotion_entitlement_id" in res && res.promotion_entitlement_id) {
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
  const canUseYogaPromo = Boolean(
    !isGuestView &&
    yogaPromo.data?.creditAvailable &&
    yogaPromo.data.eligibleClassTypeId &&
    yogaPromo.data.eligibleClassTypeId === cls?.program_type?.id,
  );
  const isYogaPromoClass = Boolean(
    yogaPromo.data?.eligibleClassTypeId &&
    yogaPromo.data.eligibleClassTypeId === cls?.program_type?.id,
  );
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
        className="cc-review cc-dialog lesson-detail cc-reference ref-detail"
        {...returnFocus}
      >
        <DialogTitle className="sr-only">{t("booking.details")}</DialogTitle>
        <DialogDescription className="sr-only">{t("booking.bring")}</DialogDescription>
        <button
          onClick={() => onOpenChange(false)}
          aria-label={t("common.close")}
          className="ref-detail-close"
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
        ) : isError || (!isLoading && !cls) ? (
          <section className="p-6 pt-16 space-y-4 text-center" role="alert">
            <h2 className="text-xl font-semibold text-navy">{t("page.error.eyebrow")}</h2>
            <p className="text-slate">{t("page.error.body")}</p>
            <ReviewButton
              variant="primary"
              type="submit"
              className="btn-navy"
              onClick={() => void refetch()}
            >
              {t("common.retry")}
            </ReviewButton>
          </section>
        ) : isLoading || !cls ? (
          <div className="h-80 skeleton-brand" role="status" aria-label={t("common.loading")} />
        ) : (
          <ClassDetailContent
            cls={cls}
            state={state}
            guestNextStep={
              guestDetailCta
                ? { label: guestNextStepLabel(lang), value: guestDetailCta.label }
                : undefined
            }
            promotion={
              <>
                {" "}
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
                    <Sparkles
                      className="me-2 inline h-4 w-4 text-[var(--color-accent-text)]"
                      aria-hidden="true"
                    />
                    {t("promo.yoga.bookingEligible")}
                  </div>
                ) : null}
              </>
            }
            action={
              <>
                {guestDetailCta ? (
                  <>
                    {guestDetailCta.disabled ? (
                      <ReviewButton
                        variant="ghost"
                        type="submit"
                        disabled
                        className="btn-ghost w-full opacity-60 cursor-not-allowed"
                      >
                        {guestDetailCta.label}
                      </ReviewButton>
                    ) : (
                      <Link
                        to={guestDetailCta.to}
                        className="cc-button cc-button--primary btn-navy w-full hover:btn-navy-hover text-center justify-center flex items-center gap-2"
                      >
                        {guestDetailCta.label}
                      </Link>
                    )}
                    <p className="text-sm leading-6 text-slate">{guestDetailCta.supportingCopy}</p>
                  </>
                ) : data?.myBooking?.status === "booked" ? (
                  <Link
                    to="/member/bookings"
                    className="cc-button cc-button--primary btn-navy w-full hover:btn-navy-hover"
                  >
                    {t("booking.viewMine")}{" "}
                    <ArrowRight className="h-3 w-3 directional-icon-forward" />
                  </Link>
                ) : state?.kind === "waiting" && data?.myWaitlist?.id ? (
                  <ReviewButton
                    variant="ghost"
                    type="submit"
                    onClick={() => leave.mutate(data.myWaitlist!.id)}
                    className="btn-ghost w-full hover:btn-ghost-hover"
                  >
                    {t("booking.leaveWaitlist")}
                  </ReviewButton>
                ) : state?.kind === "waitlist_available" ? (
                  <ReviewButton
                    variant="primary"
                    type="submit"
                    onClick={() => join.mutate()}
                    disabled={join.isPending}
                    className="btn-navy w-full hover:btn-navy-hover disabled:opacity-60"
                  >
                    {join.isPending ? "…" : t("booking.joinWaitlist")}
                  </ReviewButton>
                ) : state?.kind === "package_required" ? (
                  <div className="detail-package-guide">
                    <PackageBookingGuide compact />
                    <Link
                      to="/member/packages"
                      className="cc-button cc-button--primary btn-navy w-full hover:btn-navy-hover"
                    >
                      {t("member.packageGuide.action")}
                    </Link>
                  </div>
                ) : state?.kind === "low_credits" ? (
                  <Link
                    to="/member/packages"
                    className="cc-button cc-button--primary btn-navy w-full hover:btn-navy-hover"
                  >
                    {t("class.cta.topUpCredits")}
                  </Link>
                ) : state?.kind === "closed" || state?.kind === "cancelled" ? (
                  <ReviewButton
                    variant="ghost"
                    type="submit"
                    disabled
                    className="btn-ghost w-full opacity-60 cursor-not-allowed"
                  >
                    {t("booking.registrationClosed")}
                  </ReviewButton>
                ) : (
                  <ReviewButton
                    variant="primary"
                    type="submit"
                    onClick={() => book.mutate()}
                    disabled={book.isPending}
                    className="btn-navy w-full hover:btn-navy-hover disabled:opacity-60"
                  >
                    {book.isPending ? t("booking.saving") : t("booking.bookCredit")}
                  </ReviewButton>
                )}
              </>
            }
          />
        )}
      </DialogContent>
    </Dialog>
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
    <BookingConfirmationContent
      cls={cls}
      confirmation={confirmation}
      onAddCalendar={addToCalendar}
      onDone={onDone}
    />
  );
}
