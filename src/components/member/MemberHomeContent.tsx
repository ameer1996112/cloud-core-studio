import { PackageBookingGuide } from "./PackageBookingGuide";
import { useIsMobile } from "@/hooks/use-mobile";
import { STUDIO_TIMEZONE } from "@/lib/studio-time";
import {
  sourceTextAttributes,
  nextHomeBooking,
  membershipPresentation,
} from "@/lib/member-home-presentation";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Calendar, CreditCard, MessageCircle, ArrowRight, Megaphone, Heart } from "lucide-react";
import { t, useI18n } from "@/lib/i18n";
import { localizedClassTitle, localizedOptionalInstructorName } from "@/lib/localized-content";
import { getPlanDisplay } from "@/lib/planDisplay";
import { waUrl, buildIcs, downloadIcs } from "@/lib/messageTemplate";
import { toast } from "sonner";
import { deriveClassState } from "./PremiumClassCard";
import { BookingPass, StudioClassItem } from "./StudioClassItem";
import type { getMemberHome } from "@/lib/member.functions";
import type { PublicStudioSettings } from "@/lib/studioSettings.functions";
import { EditorialImage } from "@/components/visual/EditorialImage";

export type MemberHomeData = Awaited<ReturnType<typeof getMemberHome>>;
export type MemberHomeContentProps = {
  data?: MemberHomeData;
  settings?: PublicStudioSettings | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onOpenClass: (id: string) => void;
  promotion?: ReactNode;
};

export function MemberHomeContent({
  data,
  settings,
  isLoading,
  isError,
  onRetry,
  onOpenClass,
  promotion,
}: MemberHomeContentProps) {
  const { lang, dir } = useI18n();
  const isMobile = useIsMobile();
  const failed =
    isError || (!isLoading && (!data?.member || data.member.remaining_credits == null));
  const greetingName = data?.member?.name?.trim().split(/\s+/)[0];
  const upcoming = data?.upcoming ?? [];
  const next = nextHomeBooking(upcoming);
  const recommended = data?.recommended ?? [];
  const featuredRecommendation = !next ? recommended[0] : undefined;
  const moreClasses = recommended.filter((cls) => cls.id !== featuredRecommendation?.id);
  const credits = data?.member?.remaining_credits;
  const recommendationNeedsPackage =
    !!featuredRecommendation &&
    deriveClassState(featuredRecommendation, {
      booked: false,
      waiting: false,
      remainingCredits: credits ?? 0,
      hasActivePackage: !!data?.activePlan,
    }).kind === "package_required";
  const announcement = settings?.announcement_text?.trim();
  const welcome = settings?.welcome_text?.trim();
  const concierge = data?.concierge;
  const hour = new Date().getHours();
  const greeting = t(
    hour < 12 ? "member.goodMorning" : hour < 18 ? "member.goodAfternoon" : "member.goodEvening",
  );

  function addToCalendar() {
    if (!next) return;
    const cls = next.class;
    const title = localizedClassTitle(cls);
    const instructor =
      localizedOptionalInstructorName(cls.instructor?.name) ?? t("member.noInstructor");
    const ics = buildIcs({
      uid: next.id,
      title,
      startsAt: cls.starts_at,
      durationMinutes: cls.duration_minutes,
      location: [t("member.locationStudio"), settings?.address].filter(Boolean).join(" · "),
      description: t("member.calendarDescription", {
        hours: cls.cancellation_window_hours,
        instructor,
      }),
      studioName: settings?.studio_name ?? null,
    });
    void downloadIcs(`${title.replace(/\s+/g, "-").toLowerCase()}.ics`, ics);
    toast.success(t("member.calendarReady"));
  }

  return (
    <section className="member-page member-home-page reference-home home-refined" dir={dir}>
      <header className="home-greeting">
        <div className="home-welcome-copy">
          <h1>
            {greetingName ? (
              <>
                {t(lang === "en" ? "member.welcomeBackName" : "member.helloName")}{" "}
                <bdi>{greetingName}</bdi>
              </>
            ) : (
              t("nav.home")
            )}
          </h1>
          <p>{greeting}</p>
        </div>
        <div className="home-reference-banner">
          <EditorialImage
            scene="welcome-context"
            eager
            sizes="(min-width: 768px) 1060px, 100vw"
            className="home-welcome-photo"
          />
          <p className="home-banner-motto">
            Small steps.
            <br />
            Lasting change.
          </p>
          <Link
            to={
              recommendationNeedsPackage && !failed && !isLoading
                ? "/member/packages"
                : "/member/schedule"
            }
            className="home-welcome-action"
          >
            {t(
              recommendationNeedsPackage && !failed && !isLoading
                ? "member.packageGuide.action"
                : "member.browseSchedule",
            )}
            <ArrowRight size={18} className="directional-icon-forward" aria-hidden="true" />
          </Link>
        </div>
      </header>
      {failed ? (
        <section className="home-status" role="alert">
          <h2>{t("page.error.eyebrow")}</h2>
          <p>{t("page.error.body")}</p>
          <button className="home-primary" onClick={onRetry}>
            {t("common.retry")}
          </button>
        </section>
      ) : isLoading ? (
        <div
          className="home-loading"
          role="status"
          aria-label={t("common.loading")}
          aria-busy="true"
        >
          <div className="home-loading-main" />
          <div className="home-loading-summary" />
          <div className="home-loading-row" />
          <div className="home-loading-row" />
        </div>
      ) : data?.member && credits != null ? (
        <>
          <div className="home-primary-layout">
            <div className="home-main-column" dir={dir}>
              <section className="home-next">
                <h2>
                  {t(
                    next
                      ? "member.yourNextClass"
                      : featuredRecommendation
                        ? "member.chooseNextClass"
                        : "member.empty.bookings.title",
                  )}
                </h2>
                {next ? (
                  <BookingPass
                    cls={next.class}
                    state={deriveClassState(next.class, {
                      booked: true,
                      waiting: false,
                      remainingCredits: credits,
                    })}
                    timeZone={settings?.timezone}
                    action={
                      <Link to="/member/bookings" className="home-primary">
                        {t("member.viewBooking")}
                        <ArrowRight
                          size={16}
                          className="directional-icon-forward"
                          aria-hidden="true"
                        />
                      </Link>
                    }
                    secondaryAction={
                      <button
                        type="button"
                        onClick={addToCalendar}
                        className="home-text-action home-calendar-action"
                        aria-label={t("member.addCalendar")}
                        title={`${t("member.addCalendar")} - ${t("member.calendarHelp")}`}
                      >
                        <Calendar size={16} aria-hidden="true" />
                        <span>{t("member.addCalendar")}</span>
                      </button>
                    }
                    note={
                      <>
                        <p>
                          {t("booking.cancelWindow", {
                            hours: next.class.cancellation_window_hours,
                          })}
                        </p>
                      </>
                    }
                  />
                ) : featuredRecommendation ? (
                  <BookingPass
                    cls={featuredRecommendation}
                    showStatus={!recommendationNeedsPackage}
                    guidance={recommendationNeedsPackage ? <PackageBookingGuide /> : undefined}
                    secondaryAction={
                      recommendationNeedsPackage ? (
                        <button
                          type="button"
                          className="home-text-action"
                          aria-haspopup="dialog"
                          aria-label={`${t("member.viewClass")}: ${localizedClassTitle(featuredRecommendation)}`}
                          onClick={() => onOpenClass(featuredRecommendation.id)}
                        >
                          {t("member.viewClass")}
                        </button>
                      ) : undefined
                    }
                    state={deriveClassState(featuredRecommendation, {
                      booked: false,
                      waiting: false,
                      remainingCredits: credits,
                      hasActivePackage: !!data.activePlan,
                    })}
                    timeZone={settings?.timezone}
                    action={
                      recommendationNeedsPackage ? (
                        <Link to="/member/packages" className="home-primary package-booking-action">
                          {t("member.packageGuide.action")}
                          <ArrowRight
                            size={16}
                            className="directional-icon-forward"
                            aria-hidden="true"
                          />
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="home-primary"
                          onClick={() => onOpenClass(featuredRecommendation.id)}
                          aria-label={`${t("member.viewClass")}: ${localizedClassTitle(featuredRecommendation)}`}
                        >
                          {t("member.viewClass")}
                          <ArrowRight
                            size={16}
                            className="directional-icon-forward"
                            aria-hidden="true"
                          />
                        </button>
                      )
                    }
                  />
                ) : (
                  <div className="home-choose">
                    <div className="home-choose-copy">
                      {!data.activePlan && credits <= 0 ? (
                        <PackageBookingGuide />
                      ) : (
                        <p>{t("member.empty.bookings.body")}</p>
                      )}
                      <Link
                        to={
                          !data.activePlan && credits <= 0 ? "/member/packages" : "/member/schedule"
                        }
                        className="home-primary"
                      >
                        {t(
                          !data.activePlan && credits <= 0
                            ? "member.packageGuide.action"
                            : "member.browseSchedule",
                        )}
                        <ArrowRight
                          size={16}
                          className="directional-icon-forward"
                          aria-hidden="true"
                        />
                      </Link>
                    </div>
                  </div>
                )}
              </section>
              <nav className="home-reference-shortcuts" aria-label={t("member.quickActions")}>
                <Link to="/member/schedule">
                  <Calendar size={24} aria-hidden="true" />
                  {t("nav.schedule")}
                </Link>
                <Link to="/member/packages">
                  <CreditCard size={24} aria-hidden="true" />
                  {t("nav.plans")}
                </Link>
                <Link to="/member/bookings">
                  <Heart size={24} aria-hidden="true" />
                  {t("nav.bookings")}
                </Link>
              </nav>
            </div>
            <aside dir={dir} className="home-account" aria-label={t("nav.plans")}>
              <MembershipPass
                activePlan={data.activePlan}
                credits={credits}
                timeZone={settings?.timezone}
              />
              {(!featuredRecommendation || moreClasses.length > 0) && (
                <section className="home-discovery home-recommendations">
                  <div className="home-section-heading">
                    <h2>{t("member.forYou")}</h2>
                    <Link to="/member/schedule" className="home-text-action">
                      {t("member.allSessions")}
                      <ArrowRight
                        size={16}
                        className="directional-icon-forward"
                        aria-hidden="true"
                      />
                    </Link>
                  </div>
                  {moreClasses.length ? (
                    moreClasses.slice(0, 3).map((cls) => (
                      <StudioClassItem
                        thumbnail
                        compact
                        key={cls.id}
                        cls={cls}
                        timeZone={settings?.timezone}
                        state={deriveClassState(cls, {
                          booked: false,
                          waiting: false,
                          remainingCredits: credits,
                          hasActivePackage: !!data.activePlan,
                        })}
                        action={
                          <button
                            type="button"
                            onClick={() => onOpenClass(cls.id)}
                            className="home-text-action"
                            aria-label={`${t("member.viewClass")}: ${localizedClassTitle(cls)}`}
                          >
                            {t("member.viewClass")}
                            <ArrowRight
                              size={16}
                              className="directional-icon-forward"
                              aria-hidden="true"
                            />
                          </button>
                        }
                      />
                    ))
                  ) : (
                    <div className="home-empty">
                      <h3>{t("member.empty.schedule.title")}</h3>
                      <p>{t("member.empty.schedule.body")}</p>
                      <Link to="/member/schedule" className="home-text-action">
                        {t("member.browseSchedule")}
                      </Link>
                    </div>
                  )}
                </section>
              )}
              {upcoming.length > 1 && (
                <section className="home-discovery">
                  <h2>{t("member.alsoComing")}</h2>
                  {upcoming
                    .filter((b) => b.id !== next?.id)
                    .map((b) => (
                      <StudioClassItem
                        thumbnail
                        compact
                        key={b.id}
                        cls={b.class}
                        state={deriveClassState(b.class, {
                          booked: true,
                          waiting: false,
                          remainingCredits: credits,
                        })}
                        timeZone={settings?.timezone}
                        action={
                          <Link to="/member/bookings" className="home-text-action">
                            {t("member.viewBooking")}
                          </Link>
                        }
                      />
                    ))}
                </section>
              )}

              {!isMobile && (
                <div className="home-utilities">
                  <QuickActions
                    waNumber={settings?.whatsapp_number ?? settings?.public_phone ?? null}
                    studioName={settings?.studio_name ?? null}
                    memberName={data.member.name}
                  />
                </div>
              )}
            </aside>
          </div>
          {(announcement || welcome) && (
            <section className="home-announcement">
              <Megaphone size={20} strokeWidth={1.5} aria-hidden="true" />
              <div>
                <h2>{t("member.studioMessage")}</h2>
                {welcome && welcome !== announcement && (
                  <p {...sourceTextAttributes(welcome)}>{welcome}</p>
                )}
                {announcement && <p {...sourceTextAttributes(announcement)}>{announcement}</p>}
              </div>
            </section>
          )}
          {concierge && concierge.state !== "quiet" && (
            <section className="home-concierge">
              <p {...sourceTextAttributes(concierge.eyebrow)}>{concierge.eyebrow}</p>
              <h2 {...sourceTextAttributes(concierge.title)}>{concierge.title}</h2>
              <p {...sourceTextAttributes(concierge.note)}>{concierge.note}</p>
              <a
                href={concierge.primaryAction.to}
                className="home-text-action"
                {...sourceTextAttributes(concierge.primaryAction.label)}
              >
                {concierge.primaryAction.label}
              </a>
            </section>
          )}
          {isMobile && (
            <div className="home-utilities">
              <QuickActions
                waNumber={settings?.whatsapp_number ?? settings?.public_phone ?? null}
                studioName={settings?.studio_name ?? null}
                memberName={data.member.name}
              />
            </div>
          )}
          {promotion}
        </>
      ) : null}
    </section>
  );
}
function MembershipPass({
  activePlan,
  credits,
  timeZone,
}: {
  activePlan: MemberHomeData["activePlan"];
  credits: number;
  timeZone?: string;
}) {
  const { lang, locale } = useI18n();
  const { unlimited, expired } = membershipPresentation(activePlan);
  const planName = activePlan?.plan ? getPlanDisplay(activePlan.plan, lang).name : null;
  if (!activePlan)
    return (
      <Link to="/member/packages" className="home-package-summary">
        <CreditCard size={20} aria-hidden="true" />
        <span>
          <strong>{t("member.noActivePackage")}</strong>
          <span>
            {credits} {t("member.creditsRemaining")}
          </span>
        </span>
        <ArrowRight size={18} className="directional-icon-forward" aria-hidden="true" />
      </Link>
    );
  return (
    <Link
      to="/member/packages"
      className={`home-membership${!activePlan ? " home-membership-empty" : ""}`}
    >
      <div className="membership-identity">
        <p>{t(expired ? "member.membershipExpired" : "nav.plans")}</p>
        <h3>
          <bdi>{planName || t("member.noActivePackage")}</bdi>
        </h3>
      </div>
      <div className="membership-balance">
        {unlimited ? (
          <span className="membership-unlimited">{t("packages.unlimited")}</span>
        ) : (
          <>
            <strong>{credits}</strong>
            <span>{t("member.creditsRemaining")}</span>
          </>
        )}
      </div>
      <div className="membership-validity">
        {activePlan?.expires_at && (
          <p>
            {t("member.expires")}{" "}
            <bdi>
              {new Intl.DateTimeFormat(locale, {
                timeZone: timeZone ?? STUDIO_TIMEZONE,
                month: "short",
                day: "numeric",
                year: "numeric",
              }).format(new Date(activePlan.expires_at))}
            </bdi>
          </p>
        )}
        <span className="membership-action">
          {t(activePlan && !expired ? "member.home.packageDetails" : "packages.choosePackage")}
          <ArrowRight size={18} className="directional-icon-forward" aria-hidden="true" />
        </span>
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
    <div className="home-quick-actions space-y-3">
      <p className="member-eyebrow">{t("member.quickActions")}</p>

      <Link
        to="/member/packages"
        className="flex min-h-11 items-center justify-between text-sm text-navy py-2 border-b hairline"
      >
        <span className="inline-flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-[var(--color-accent-text)]" />{" "}
          {t("member.buyPackage")}
        </span>
        <ArrowRight className="h-3 w-3 text-[var(--color-accent-text)] directional-icon-forward" />
      </Link>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex min-h-11 items-center justify-between text-sm text-navy py-2"
      >
        <span className="inline-flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-[var(--color-accent-text)]" />{" "}
          {t("member.contactStudio")}
        </span>
        <ArrowRight className="h-3 w-3 text-[var(--color-accent-text)] directional-icon-forward" />
      </a>
    </div>
  );
}
