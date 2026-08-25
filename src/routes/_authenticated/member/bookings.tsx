import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MessageCircle, CalendarPlus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyBookingsAll, memberCancelBooking, leaveWaitlist } from "@/lib/member.functions";
import { getPublicStudioSettings } from "@/lib/studioSettings.functions";
import { waUrl, buildIcs, downloadIcs } from "@/lib/messageTemplate";
import { formatDate, formatTime, MemberEmptyState } from "@/components/member/PremiumClassCard";
import { ClassDetailSheet } from "@/components/member/ClassDetailSheet";
import { LessonReservationCard } from "@/components/visual/VisualClassCard";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { MemberPageIntro } from "@/components/member/MemberPage";
import {
  MemberSegmentedControl,
  memberSegmentIds,
} from "@/components/member/MemberSegmentedControl";
import { MemberRouteError, MemberRouteSkeleton } from "@/components/member/MemberRouteSkeleton";
import { t, useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  getMemberViewerCacheKey,
  isAuthenticatedMemberScheduleQueryKey,
} from "@/lib/memberQueryKeys";
import { localizedClassTitle, localizedOptionalInstructorName } from "@/lib/localized-content";
import {
  getMyPersonalConcierge,
  saveMyPersonalConciergePreference,
} from "@/lib/personalConcierge.functions";
import {
  personalConciergeOnboardingPreference,
  resolvePersonalConciergeOnboarding,
  type PersonalConciergeOnboardingChoice,
} from "@/lib/personalConciergeOnboarding";

export const Route = createFileRoute("/_authenticated/member/bookings")({
  component: MyBookings,
});

type Tab = "upcoming" | "past" | "waitlist" | "cancelled";

// eslint-disable-next-line react-refresh/only-export-components -- Public pure ordering seam.
export function sortUpcomingBookingsByStart<
  Booking extends { class?: { starts_at?: string | null } | null },
>(bookings: readonly Booking[]) {
  const startTime = (booking: Booking) => {
    const parsed = Date.parse(booking.class?.starts_at ?? "");
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
  };

  return [...bookings].sort((left, right) => startTime(left) - startTime(right));
}

function MyBookings() {
  const { dir, lang } = useI18n();
  useDocumentTitle("page.bookings.title");
  const fetchAll = useServerFn(getMyBookingsAll);
  const fetchSettings = useServerFn(getPublicStudioSettings);
  const fetchConcierge = useServerFn(getMyPersonalConcierge);
  const saveConciergePreference = useServerFn(saveMyPersonalConciergePreference);
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-bookings-all"],
    queryFn: () => fetchAll(),
  });
  const { data: settings } = useQuery({
    queryKey: ["public-studio-settings"],
    queryFn: () => fetchSettings(),
  });
  const { data: conciergeProfile } = useQuery({
    queryKey: ["personal-concierge"],
    queryFn: () => fetchConcierge(),
  });
  const [tab, setTab] = useState<Tab>("upcoming");
  const [confirmCancel, setConfirmCancel] = useState<any | null>(null);
  const [openClass, setOpenClass] = useState<string | null>(null);
  const [detailViewerCacheKey, setDetailViewerCacheKey] = useState<string | undefined>(undefined);
  const [onboardingResolvedLocally, setOnboardingResolvedLocally] = useState(false);

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

  const resolveOnboarding = useMutation({
    mutationFn: (
      resolution:
        | { kind: "choice"; choice: PersonalConciergeOnboardingChoice }
        | { kind: "deferred" },
    ) =>
      saveConciergePreference({
        data: personalConciergeOnboardingPreference(resolution),
      }),
    onSuccess: (_savedPreference, resolution) => {
      setOnboardingResolvedLocally(true);
      qc.invalidateQueries({ queryKey: ["personal-concierge"] });
      qc.invalidateQueries({ queryKey: ["member-home"] });
      toast.success(
        resolution.kind === "deferred"
          ? lang === "he"
            ? "אפשר לבחור בכל זמן דרך החשבון"
            : lang === "ar"
              ? "يمكنك الاختيار في أي وقت من حسابك"
              : "You can choose anytime from your account"
          : lang === "he"
            ? "ה־Concierge הותאם אלייך"
            : lang === "ar"
              ? "تم تخصيص خدمة الكونسيرج لك"
              : "Your Concierge is now tailored to you",
      );
    },
    onError: () => toast.error(t("profile.saveError")),
  });

  const now = Date.now();
  const bookings = data?.bookings ?? [];
  const attMap = data?.attendanceByBooking ?? {};
  const upcoming = sortUpcomingBookingsByStart(
    bookings.filter(
      (b: any) => b.status === "booked" && b.class && new Date(b.class.starts_at).getTime() >= now,
    ),
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
  const hasBookingsData = data != null;
  const isInitialLoading = isLoading && !hasBookingsData;
  const hasFatalError = isError && !hasBookingsData;
  const current =
    tab === "upcoming"
      ? upcoming
      : tab === "past"
        ? past
        : tab === "cancelled"
          ? cancelled
          : waitlist;
  const activePanelIds = memberSegmentIds("member-bookings", tab);
  const firstVisitBooking = data?.hasAttended === false ? upcoming[0] : null;
  const conciergeOnboarding = resolvePersonalConciergeOnboarding({
    conciergeAvailable: conciergeProfile?.available === true,
    hasUpcomingBooking: upcoming.length > 0,
    hasAttended: data?.hasAttended === true,
    preferences: conciergeProfile?.preferences ?? [],
  });
  const showConciergeOnboarding = conciergeOnboarding.visible && !onboardingResolvedLocally;
  const onboardingCopy =
    lang === "he"
      ? {
          eyebrow: "נעים להכיר",
          title: "איך תרצי שנלווה אותך?",
          body: "הכול כבר פועל אוטומטית. בחירה אחת תעזור לנו להתאים את הטון אלייך.",
          quiet: "רגוע ועדין",
          quietNote: "רק מה שחשוב, בזמן הנכון",
          balanced: "קצר וממוקד",
          balancedNote: "הכוונה ברורה בלי עומס",
          attentive: "מעודד ומלא אנרגיה",
          attentiveNote: "יותר חיזוקים והצעות אישיות",
          later: "אולי אחר כך",
        }
      : lang === "ar"
        ? {
            eyebrow: "سعداء بلقائك",
            title: "كيف تفضلين أن نرافقك؟",
            body: "كل شيء يعمل تلقائياً. اختيار واحد يساعدنا على ملاءمة أسلوب التواصل لك.",
            quiet: "هادئ ولطيف",
            quietNote: "المهم فقط، في الوقت المناسب",
            balanced: "قصير ومباشر",
            balancedNote: "توجيه واضح من دون إزعاج",
            attentive: "مشجع ومفعم بالطاقة",
            attentiveNote: "دعم واقتراحات شخصية أكثر",
            later: "ربما لاحقاً",
          }
        : {
            eyebrow: "Lovely to meet you",
            title: "How would you like us to support you?",
            body: "Everything already works automatically. One choice helps us match your tone.",
            quiet: "Calm and gentle",
            quietNote: "Only what matters, at the right time",
            balanced: "Short and focused",
            balancedNote: "Clear guidance without noise",
            attentive: "Encouraging and energetic",
            attentiveNote: "More encouragement and personal suggestions",
            later: "Maybe later",
          };
  const firstVisitCopy =
    lang === "he"
      ? {
          eyebrow: "לקראת הפעם הראשונה",
          title: "הכול מוכן לקראתך",
          arrival: "מומלץ להגיע 10 דקות לפני תחילת השיעור.",
          clothing: "כדאי להגיע בבגדים נוחים שמאפשרים תנועה חופשית.",
          expectation: "הצוות יקבל אותך, יציג את הסטודיו וילווה אותך בתחילת השיעור.",
          location: "מיקום",
        }
      : lang === "ar"
        ? {
            eyebrow: "استعداداً للمرة الأولى",
            title: "كل شيء جاهز لاستقبالك",
            arrival: "نوصي بالوصول قبل بداية الحصة بعشر دقائق.",
            clothing: "ارتدي ملابس مريحة تسمح لك بالحركة بحرية.",
            expectation: "سيستقبلك الفريق ويعرّفك على الاستوديو ويرافقك في بداية الحصة.",
            location: "المكان",
          }
        : {
            eyebrow: "Before your first visit",
            title: "Everything is ready for you",
            arrival: "Please arrive 10 minutes before class begins.",
            clothing: "Wear comfortable clothing that lets you move freely.",
            expectation:
              "The team will welcome you, show you the studio, and guide you into the class.",
            location: "Location",
          };

  return (
    <section dir={dir} className="member-page member-bookings-page w-full space-y-6 pb-10">
      <MemberPageIntro
        eyebrow={t("member.bookings.kicker")}
        title={t("nav.myBookings")}
        body={t("member.bookings.body")}
        aside={
          hasBookingsData ? (
            <div className="member-booking-counts">
              <StatCell label={t("bookings.upcoming")} value={counts.upcoming} />
              <StatCell label={t("bookings.waitlist")} value={counts.waitlist} />
            </div>
          ) : (
            <div className="member-booking-counts-placeholder" aria-hidden="true">
              <span className="skeleton-brand" />
              <span className="skeleton-brand" />
            </div>
          )
        }
      />

      {showConciergeOnboarding && (
        <section className="member-card overflow-hidden border-gold/30">
          <div className="bg-navy px-5 py-5 text-cream sm:px-7">
            <div className="flex items-center gap-2 text-gold">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                {onboardingCopy.eyebrow}
              </p>
            </div>
            <h2 className="mt-3 text-2xl font-semibold">{onboardingCopy.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-cream/75">{onboardingCopy.body}</p>
          </div>
          <div className="grid gap-3 bg-cream/70 p-5 sm:grid-cols-3 sm:p-7">
            {(
              [
                ["quiet", onboardingCopy.quiet, onboardingCopy.quietNote],
                ["balanced", onboardingCopy.balanced, onboardingCopy.balancedNote],
                ["attentive", onboardingCopy.attentive, onboardingCopy.attentiveNote],
              ] as const
            ).map(([choice, label, note]) => (
              <button
                key={choice}
                type="button"
                disabled={resolveOnboarding.isPending}
                onClick={() => resolveOnboarding.mutate({ kind: "choice", choice })}
                className="rounded-2xl border border-gold/25 bg-white p-4 text-start transition hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-sm disabled:opacity-50"
              >
                <span className="block font-semibold text-navy">{label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate">{note}</span>
              </button>
            ))}
            <button
              type="button"
              disabled={resolveOnboarding.isPending}
              onClick={() => resolveOnboarding.mutate({ kind: "deferred" })}
              className="member-concierge-defer-action min-h-11 text-sm text-slate underline-offset-4 hover:text-navy hover:underline sm:col-span-3"
            >
              {onboardingCopy.later}
            </button>
          </div>
        </section>
      )}

      {firstVisitBooking?.class && (
        <section className="member-card member-panel-sand p-5 sm:p-7">
          <p className="member-eyebrow">{firstVisitCopy.eyebrow}</p>
          <h2 className="member-section-title mt-2">{firstVisitCopy.title}</h2>
          <p className="mt-3 font-medium text-navy">
            {localizedClassTitle(firstVisitBooking.class)}
          </p>
          <p className="mt-1 text-sm text-slate">
            {formatDate(firstVisitBooking.class.starts_at)} ·{" "}
            {formatTime(firstVisitBooking.class.starts_at)}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[firstVisitCopy.arrival, firstVisitCopy.clothing, firstVisitCopy.expectation].map(
              (item) => (
                <div key={item} className="rounded-xl border border-gold/20 bg-white/70 p-4">
                  <p className="text-sm leading-6 text-slate">{item}</p>
                </div>
              ),
            )}
          </div>
          {(firstVisitBooking.class.room_ref?.name ||
            firstVisitBooking.class.room ||
            settings?.address) && (
            <p className="mt-4 text-sm text-slate">
              <span className="font-semibold text-navy">{firstVisitCopy.location}: </span>
              {firstVisitBooking.class.room_ref?.name ||
                firstVisitBooking.class.room ||
                settings?.address}
            </p>
          )}
          <p className="mt-5 text-xs text-slate">
            {lang === "he"
              ? "Cloud & Core Concierge"
              : lang === "ar"
                ? "كونسيرج Cloud & Core"
                : "Cloud & Core Concierge"}
          </p>
        </section>
      )}

      <MemberSegmentedControl
        baseId="member-bookings"
        label={t("nav.myBookings")}
        value={tab}
        onChange={setTab}
        dir={dir}
        items={[
          {
            value: "upcoming",
            label: t("bookings.upcoming"),
            count: hasBookingsData ? counts.upcoming : undefined,
          },
          {
            value: "waitlist",
            label: t("bookings.waitlist"),
            count: hasBookingsData ? counts.waitlist : undefined,
          },
          {
            value: "past",
            label: t("bookings.past"),
            count: hasBookingsData ? counts.past : undefined,
          },
          {
            value: "cancelled",
            label: t("bookings.cancelled"),
            count: hasBookingsData ? counts.cancelled : undefined,
          },
        ]}
      />

      <div
        id={activePanelIds.panelId}
        role="tabpanel"
        aria-labelledby={activePanelIds.tabId}
        aria-busy={isInitialLoading || undefined}
        tabIndex={0}
        className="member-bookings-panel"
      >
        {isInitialLoading ? <MemberRouteSkeleton route="bookings" /> : null}

        {hasFatalError ? <MemberRouteError onRetry={() => void refetch()} /> : null}

        {hasBookingsData && !hasFatalError && current.length === 0 && (
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

        {hasBookingsData && !hasFatalError && current.length > 0 ? (
          <div className="member-bookings-list">
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
        ) : null}
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
                <p className="font-display text-lg text-navy">
                  {localizedClassTitle(confirmCancel.class)}
                </p>
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
                  type="button"
                  onClick={() => setConfirmCancel(null)}
                  className="btn-ghost min-h-11 flex-1 hover:btn-ghost-hover"
                >
                  {t("bookings.keep")}
                </button>
                <button
                  type="button"
                  onClick={() => cancel.mutate(confirmCancel.id)}
                  disabled={cancel.isPending}
                  className="btn-navy min-h-11 flex-1 hover:btn-navy-hover"
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
              type="button"
              onClick={addToCalendar}
              className="member-booking-action btn-ghost inline-flex min-h-11 items-center gap-1 px-2 text-xs hover:btn-ghost-hover"
            >
              <CalendarPlus className="h-3 w-3" aria-hidden="true" /> {t("member.addCalendar")}
            </button>
            <span className="basis-full text-xs text-slate leading-relaxed">
              {t("member.calendarHelp")}
            </span>
            {canCancel && onCancel ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCancel();
                }}
                className="member-booking-action member-booking-action--cancel min-h-11 px-2 text-xs"
              >
                {t("common.cancel")}
              </button>
            ) : (
              <a
                href={contactUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="member-booking-action btn-ghost inline-flex min-h-11 items-center gap-1 px-2 text-xs hover:btn-ghost-hover"
              >
                <MessageCircle className="h-3 w-3" aria-hidden="true" /> {t("member.contactStudio")}
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
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onLeave();
        }}
        className="member-booking-action member-booking-action--cancel min-h-11 px-2 text-xs"
      >
        {t("booking.leaveWaitlist")}
      </button>
    </LessonReservationCard>
  );
}
