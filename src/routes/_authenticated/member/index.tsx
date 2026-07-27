import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  CreditCard,
  MessageCircle,
  Sparkles,
  Clock,
  ArrowRight,
  Megaphone,
} from "lucide-react";
import { getMemberHome } from "@/lib/member.functions";
import { getPublicStudioSettings } from "@/lib/studioSettings.functions";
import { waUrl, buildIcs, downloadIcs } from "@/lib/messageTemplate";
import {
  ClassImage,
  formatDate,
  formatDurationLabel,
  formatRelative,
  formatTime,
  deriveClassState,
  MemberEmptyState,
} from "@/components/member/PremiumClassCard";
import { VisualClassCard, VisualClassCardMini } from "@/components/visual/VisualClassCard";
import { ClassDetailSheet } from "@/components/member/ClassDetailSheet";
import { LANG_META, t, getLocale, useI18n } from "@/lib/i18n";
import { studioImages, localizedAlt } from "@/lib/image-assets";
import {
  localizedClassTitle,
  localizedClassTitleParts,
  localizedOptionalInstructorName,
} from "@/lib/localized-content";
import { getMemberViewerCacheKey } from "@/lib/memberQueryKeys";
import { getPlanDisplay } from "@/lib/planDisplay";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { AutoInline, LtrInline } from "@/components/ui/bidi";
import { WeeklyPromoBanner } from "@/components/member/WeeklyPromoBanner";

export const Route = createFileRoute("/_authenticated/member/")({
  component: MemberHome,
});

function MemberHome() {
  const { lang, dir } = useI18n();
  useDocumentTitle("page.home.title");
  const fetchHome = useServerFn(getMemberHome);
  const fetchSettings = useServerFn(getPublicStudioSettings);
  const { data, isLoading } = useQuery({ queryKey: ["member-home"], queryFn: () => fetchHome() });
  const { data: settings } = useQuery({
    queryKey: ["public-studio-settings"],
    queryFn: () => fetchSettings(),
  });
  const [openClass, setOpenClass] = useState<string | null>(null);

  const greetingName = data?.member?.name?.trim().split(/\s+/)[0] ?? t("member.friend");
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t("member.goodMorning")
      : hour < 18
        ? t("member.goodAfternoon")
        : t("member.goodEvening");

  const isRtl = LANG_META[lang].dir === "rtl";
  const recommended = data?.recommended ?? [];
  const upcomingBookings = data?.upcoming ?? [];
  const detailViewerCacheKey = getMemberViewerCacheKey(data?.member?.id);
  const nextBooking = upcomingBookings[0] ?? null;
  const featuredClass = !nextBooking ? recommended[0] : null;
  const recommendedList = featuredClass ? recommended.slice(1) : recommended;
  const announcement = localizeAnnouncement(settings?.announcement_text);
  const concierge = data?.concierge;

  return (
    <section
      dir={dir}
      className="member-home-page member-page member-home-primary flex w-full flex-col space-y-0"
    >
      <div className="member-page-panel member-hero-panel grid overflow-hidden">
        <div className="member-page-copy member-hero-content p-5 sm:p-8 md:p-10">
          <p className="member-eyebrow">{greeting}</p>
          <h1 className="member-page-title member-hero-title mt-3" dir={dir}>
            {lang === "en" ? (
              <span className="member-hero-greeting-line" dir="ltr">
                <span className="member-hero-greeting-prefix" dir="ltr">
                  {t("member.welcomeBackName")}{" "}
                </span>
                <AutoInline className="member-hero-greeting-name">
                  <bdi>{greetingName}</bdi>
                </AutoInline>
              </span>
            ) : (
              <span className="member-hero-greeting-stack" dir="rtl">
                <span className="member-hero-greeting-prefix" dir="rtl">
                  {t("member.helloName")}
                </span>
                <AutoInline className="member-hero-greeting-name">
                  <bdi>{greetingName}</bdi>
                </AutoInline>
              </span>
            )}
          </h1>
          <p className="member-page-body mt-3">
            {settings?.welcome_text ?? t("member.welcomeBackStudio")}
          </p>
          <div className="member-stat-strip member-hero-stat-strip mt-6" dir={dir}>
            <StatCell
              label={t("member.stat.credits")}
              value={data?.member?.remaining_credits ?? 0}
            />
            <StatCell label={t("member.stat.bookings")} value={upcomingBookings.length} />
            <StatCell label={t("member.stat.available")} value={recommended.length} />
          </div>
        </div>
        <div className="member-hero-media relative min-h-[160px] sm:min-h-[190px] md:min-h-[220px]">
          <img
            src={(settings as any)?.hero_image_url || studioImages.atmosphere.src}
            alt={localizedAlt(studioImages.atmosphere, getLocale())}
            loading="eager"
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover outline outline-1 -outline-offset-1 outline-navy/10"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-navy/28 via-transparent to-ivory/20"
            aria-hidden
          />
        </div>
      </div>

      {concierge && concierge.state !== "quiet" && (
        <section className="member-card member-panel-sand relative overflow-hidden p-5 sm:p-7">
          <div
            className="pointer-events-none absolute -top-16 end-0 h-40 w-40 rounded-full bg-gold/10 blur-3xl"
            aria-hidden
          />
          <div className="relative max-w-2xl">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold" aria-hidden />
              <p className="member-eyebrow">{concierge.eyebrow}</p>
            </div>
            <h2 className="member-section-title mt-3">{concierge.title}</h2>
            <p className="member-page-body mt-2 max-w-xl">{concierge.note}</p>
            <a
              href={concierge.primaryAction.to}
              className="btn-navy hover:btn-navy-hover mt-5 inline-flex"
            >
              {concierge.primaryAction.label}
              <ArrowRight className={`h-3.5 w-3.5 ${isRtl ? "rotate-180" : ""}`} aria-hidden />
            </a>
            <p className="mt-4 text-xs text-slate">
              {lang === "he"
                ? "ירין | Cloud & Core"
                : lang === "ar"
                  ? "يارين | Cloud & Core"
                  : "Yareen | Cloud & Core"}
            </p>
          </div>
        </section>
      )}

      {announcement && (
        <div className="member-card member-panel-powder member-announcement-card p-4 sm:p-5 flex gap-3 items-start">
          <Megaphone className="h-4 w-4 text-gold shrink-0 mt-1" />
          <div className="member-announcement-copy space-y-1.5">
            <p className="text-sm font-semibold text-navy leading-snug">{announcement.title}</p>
            <p className="text-sm text-slate leading-relaxed">{announcement.body}</p>
          </div>
        </div>
      )}

      <WeeklyPromoBanner />

      {/* Next booking — Cloud Card */}
      {isLoading ? (
        <div className="h-56 skeleton-brand rounded-[var(--cc-radius-card)]" />
      ) : nextBooking ? (
        <section className="space-y-4">
          <div className="member-section-heading">
            <div>
              <p className="member-eyebrow">{t("member.bookNext")}</p>
              <h2 className="member-section-title mt-1">{t("member.yourNextClass")}</h2>
            </div>
            <DirectionalMemberLink to="/member/bookings">
              {t("member.viewBooking")}
            </DirectionalMemberLink>
          </div>
          <NextBookingCard
            booking={nextBooking}
            studioName={settings?.studio_name ?? null}
            address={settings?.address ?? null}
          />
        </section>
      ) : featuredClass ? (
        <section className="member-card member-panel-sand p-4 sm:p-6 space-y-4">
          <div className="member-section-heading">
            <div>
              <p className="member-eyebrow">{t("member.recommendedForYou")}</p>
              <h2 className="member-section-title mt-1">{t("member.keepPracticeMoving")}</h2>
            </div>
            <DirectionalMemberLink to="/member/schedule">
              {t("member.allSessions")}
            </DirectionalMemberLink>
          </div>
          <VisualClassCard
            cls={featuredClass}
            state={deriveClassState(featuredClass, {
              booked: false,
              waiting: false,
              remainingCredits: data?.member?.remaining_credits ?? 0,
              hasActivePackage: !!data?.activePlan,
            })}
            onOpen={() => setOpenClass(featuredClass.id)}
            variant="featured"
            index={0}
            context="memberHome"
            eager
          />
        </section>
      ) : (
        <MemberEmptyState
          variant="schedule"
          title={t("member.empty.schedule.title")}
          body={t("member.empty.schedule.body")}
          primaryAction={{ label: t("member.browseSchedule"), to: "/member/schedule" }}
        />
      )}

      {/* Package + credits */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PackageMini activePlan={data?.activePlan} credits={data?.member?.remaining_credits ?? 0} />
        <QuickActions
          waNumber={settings?.whatsapp_number ?? settings?.public_phone ?? null}
          studioName={settings?.studio_name ?? null}
          memberName={data?.member?.name ?? null}
        />
      </div>

      {/* Recommended */}
      <div className="space-y-4">
        <div className="member-section-heading">
          <h2 className="member-section-title">{t("member.forYou")}</h2>
          <DirectionalMemberLink to="/member/schedule">
            {t("member.allSessions")}
          </DirectionalMemberLink>
        </div>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[128px] skeleton-brand rounded-[var(--cc-radius-card)]" />
            ))}
          </div>
        ) : recommendedList.length === 0 ? (
          <MemberEmptyState
            variant="schedule"
            align="center"
            title={t("member.empty.schedule.title")}
            body={t("member.empty.schedule.body")}
            primaryAction={{ label: t("member.browseSchedule"), to: "/member/schedule" }}
          />
        ) : (
          <div className="space-y-2.5">
            {recommendedList.slice(0, 3).map((c: any, index: number, list: any[]) => (
              <VisualClassCard
                key={c.id}
                cls={c}
                state={deriveClassState(c, {
                  booked: false,
                  waiting: false,
                  remainingCredits: data?.member?.remaining_credits ?? 0,
                  hasActivePackage: !!data?.activePlan,
                })}
                onOpen={() => setOpenClass(c.id)}
                variant="standard"
                index={index + 1}
                previousLesson={index > 0 ? list[index - 1] : featuredClass}
                context="memberHome"
              />
            ))}
          </div>
        )}
      </div>

      {/* Upcoming list preview */}
      {upcomingBookings.length > 1 && (
        <div className="space-y-3">
          <div className="member-section-heading">
            <h2 className="member-section-title">{t("member.alsoComing")}</h2>
          </div>
          <div className="space-y-2.5">
            {upcomingBookings.slice(1).map((b: any) => (
              <VisualClassCardMini
                key={b.id}
                cls={b.class}
                state={deriveClassState(b.class, {
                  booked: true,
                  waiting: false,
                  remainingCredits: data?.member?.remaining_credits ?? 0,
                  hasActivePackage: !!data?.activePlan,
                })}
                to="/member/bookings"
              />
            ))}
          </div>
        </div>
      )}

      <ClassDetailSheet
        classId={openClass}
        open={!!openClass}
        onOpenChange={(v) => !v && setOpenClass(null)}
        viewerCacheKey={detailViewerCacheKey}
      />
    </section>
  );
}

function localizeAnnouncement(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) return null;
  return {
    title: t("member.studioMessage"),
    body: text,
  };
}

function StatCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="member-stat-cell">
      <p className="member-eyebrow text-slate">{label}</p>
      <p className="numeric-display numeric-display-md mt-2">{value}</p>
    </div>
  );
}

function DirectionalMemberLink({
  to,
  children,
}: {
  to: "/member/schedule" | "/member/bookings";
  children: React.ReactNode;
}) {
  const { lang } = useI18n();
  const isRtl = LANG_META[lang].dir === "rtl";
  const arrow = isRtl ? "←" : "→";

  return (
    <Link to={to} className="member-eyebrow member-link-action">
      <span>{children}</span>
      <span aria-hidden="true" className="shrink-0 text-sm leading-none">
        {arrow}
      </span>
    </Link>
  );
}

function NextBookingCard({
  booking,
  studioName,
  address,
}: {
  booking: any;
  studioName: string | null;
  address: string | null;
}) {
  const { lang, dir } = useI18n();
  const cls = booking.class;
  const title = localizedClassTitle(cls);
  const titleParts = localizedClassTitleParts(cls, lang);
  const heroTitle = titleParts.brand || title;
  const programName = titleParts.program || title;
  const instructor =
    localizedOptionalInstructorName(cls.instructor?.name) ?? t("member.noInstructor");
  const creditCost = cls.credit_cost ?? 1;
  const creditLabel =
    creditCost === 1
      ? t("member.oneCredit")
      : t("admin.classes.creditValue", { count: creditCost });
  const dateLabel = formatDate(cls.starts_at);
  const timeLabel = formatTime(cls.starts_at);
  const durationLabel = formatDurationLabel(cls.duration_minutes);

  function addToCalendar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const ics = buildIcs({
      uid: booking.id,
      title,
      startsAt: cls.starts_at,
      durationMinutes: cls.duration_minutes,
      location: [t("member.locationStudio"), address].filter(Boolean).join(" · "),
      description: t("member.calendarDescription", {
        hours: cls.cancellation_window_hours,
        instructor,
      }),
      studioName,
    });
    void downloadIcs(`${title.replace(/\s+/g, "-").toLowerCase()}.ics`, ics);
    toast.success(t("member.calendarReady"));
  }
  return (
    <article
      dir={dir}
      className="member-cloud-card member-card overflow-hidden"
      aria-label={t("member.yourCloudCard")}
    >
      <ClassImage cls={cls} className="member-class-media">
        <div
          className="absolute inset-0 z-[2] pointer-events-none"
          aria-hidden
          style={{
            background:
              "linear-gradient(0deg, rgba(11,29,58,0.82) 0%, rgba(11,29,58,0.38) 46%, rgba(11,29,58,0.08) 100%)",
          }}
        />
        <div
          dir={dir}
          className="absolute top-4 inset-x-5 z-10 flex items-start justify-between gap-3 text-ivory"
        >
          <div className="text-start">
            <p className="text-xs font-semibold">{t("member.yourCloudCard")}</p>
            <p className="mt-0.5 text-[11px] font-medium text-ivory/78">
              {t("member.cloudCardHelper")}
            </p>
          </div>
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-gold/25 bg-navy/68 px-3 py-1.5 text-xs font-semibold tracking-normal text-ivory shadow-[0_16px_30px_-24px_rgba(11,29,58,0.95)] backdrop-blur-md">
            <Clock className="h-3.5 w-3.5 text-gold" />
            {formatRelative(cls.starts_at)}
          </span>
        </div>
        <div dir={dir} className="absolute bottom-5 inset-x-5 z-10 text-ivory text-start">
          <p className="text-xs font-semibold opacity-90">
            <LtrInline>{dateLabel}</LtrInline>
            <span aria-hidden="true"> · </span>
            <LtrInline>{timeLabel}</LtrInline>
          </p>
          <h3 className="member-cloud-card-title mt-1 text-ivory">
            <bdi>{heroTitle}</bdi>
          </h3>
        </div>
      </ClassImage>

      <div className="member-cloud-card-body">
        <div className="member-cloud-card-summary">
          <span className="member-chip">{programName}</span>
          <span className="member-cloud-card-detail">
            <Sparkles className="h-3.5 w-3.5 text-gold" />
            {t("common.with")} <bdi>{instructor}</bdi>
          </span>
          <span className="member-cloud-card-detail" dir="ltr">
            <LtrInline>{timeLabel}</LtrInline>
            <span aria-hidden="true"> · </span>
            <bdi>{durationLabel}</bdi>
          </span>
          <span className="member-cloud-card-detail">{creditLabel}</span>
        </div>

        <div className="member-cloud-card-note">
          <Clock className="h-3.5 w-3.5 text-gold" />
          <p>{t("booking.cancelWindow", { hours: cls.cancellation_window_hours })}</p>
        </div>

        <div className="member-cloud-card-actions">
          <button onClick={addToCalendar} className="btn-navy min-h-11 px-5">
            <Calendar className="h-4 w-4" aria-hidden="true" />
            {t("member.addCalendar")}
          </button>
          <Link to="/member/bookings" className="btn-ghost min-h-11 px-5">
            {t("booking.viewBookings")}
          </Link>
        </div>
        <p className="member-cloud-card-helper">{t("member.calendarHelp")}</p>
      </div>
    </article>
  );
}

function PackageMini({ activePlan, credits }: { activePlan: any; credits: number }) {
  const { lang, locale } = useI18n();
  const planName = activePlan?.plan ? getPlanDisplay(activePlan.plan, lang).name : null;
  const summary = planName
    ? t("member.planWithCredits", { plan: planName, count: credits })
    : credits > 0
      ? t("member.creditsAvailable", { count: credits })
      : t("member.noActivePackage");
  return (
    <Link
      to="/member/packages"
      className="block member-card p-5 hover:member-card-hover relative overflow-hidden"
    >
      <span aria-hidden className="absolute inset-y-0 start-0 w-[3px] bg-gold/80" />
      <p className="member-eyebrow">{t("member.activePackage")}</p>
      <p className="font-display text-xl text-navy mt-1.5 leading-tight truncate">{summary}</p>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="numeric-display text-3xl font-display text-navy">{credits}</p>
          <p className="mt-0.5 text-xs text-slate">{t("member.creditsRemaining")}</p>
        </div>
        {activePlan?.expires_at && (
          <p className="shrink-0 text-end text-xs text-slate">
            {t("member.expires")}
            <br />
            <LtrInline className="text-navy">
              {new Date(activePlan.expires_at).toLocaleDateString(locale, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </LtrInline>
          </p>
        )}
      </div>
    </Link>
  );
}

function QuickActions({
  waNumber,
  studioName,
  memberName,
}: {
  waNumber: string | null;
  studioName: string | null;
  memberName: string | null;
}) {
  const text = t("member.contactMessage", {
    studio: studioName ?? "Cloud & Core",
    member: memberName ?? t("member.friend"),
  });
  const url = waUrl({ to: waNumber, text });
  return (
    <div className="member-card p-5 space-y-3">
      <p className="member-eyebrow">{t("member.quickActions")}</p>
      <Link
        to="/member/schedule"
        className="flex min-h-11 items-center justify-between text-sm text-navy py-2 border-b hairline"
      >
        <span className="inline-flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gold" /> {t("member.bookClass")}
        </span>
        <ArrowRight className="h-3 w-3 text-gold directional-icon-forward" />
      </Link>
      <Link
        to="/member/packages"
        className="flex min-h-11 items-center justify-between text-sm text-navy py-2 border-b hairline"
      >
        <span className="inline-flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-gold" /> {t("member.buyPackage")}
        </span>
        <ArrowRight className="h-3 w-3 text-gold directional-icon-forward" />
      </Link>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex min-h-11 items-center justify-between text-sm text-navy py-2"
      >
        <span className="inline-flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-gold" /> {t("member.contactStudio")}
        </span>
        <ArrowRight className="h-3 w-3 text-gold directional-icon-forward" />
      </a>
    </div>
  );
}
