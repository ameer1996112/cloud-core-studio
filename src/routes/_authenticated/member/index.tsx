import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Calendar,
  CreditCard,
  MessageCircle,
  Sparkles,
  Clock,
  MapPin,
  ArrowRight,
  Megaphone,
} from "lucide-react";
import { getMemberHome } from "@/lib/member.functions";
import { getPublicStudioSettings } from "@/lib/studioSettings.functions";
import { waUrl, buildIcs, downloadIcs } from "@/lib/messageTemplate";
import {
  ClassImage,
  formatDate,
  formatRelative,
  formatTime,
  deriveClassState,
  MemberEmptyState,
} from "@/components/member/PremiumClassCard";
import { VisualClassCard, VisualClassCardMini } from "@/components/visual/VisualClassCard";
import { ClassDetailSheet } from "@/components/member/ClassDetailSheet";
import { t, getLocale } from "@/lib/i18n";
import { studioImages, localizedAlt } from "@/lib/image-assets";

export const Route = createFileRoute("/_authenticated/member/")({
  head: () => ({ meta: [{ title: "בית — Cloud & Core" }] }),
  component: MemberHome,
});

function MemberHome() {
  const fetchHome = useServerFn(getMemberHome);
  const fetchSettings = useServerFn(getPublicStudioSettings);
  const { data, isLoading } = useQuery({ queryKey: ["member-home"], queryFn: () => fetchHome() });
  const { data: settings } = useQuery({
    queryKey: ["public-studio-settings"],
    queryFn: () => fetchSettings(),
  });
  const [openClass, setOpenClass] = useState<string | null>(null);

  const greetingName = data?.member?.name?.split(" ")[0] ?? t("member.friend");
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t("member.goodMorning")
      : hour < 18
        ? t("member.goodAfternoon")
        : t("member.goodEvening");

  // Hide internal E2E seed classes/instructors from the user-facing UI.
  const isDemoNoise = (c: any) =>
    !c || /^E2E\s/i.test(c.title ?? "") || /^E2E\s/i.test(c.instructor?.name ?? "");
  const recommended = (data?.recommended ?? []).filter((c: any) => !isDemoNoise(c));
  const upcomingBookings = (data?.upcoming ?? []).filter((b: any) => !isDemoNoise(b.class));
  const nextBooking = upcomingBookings[0] ?? null;
  const featuredClass = !nextBooking ? recommended[0] : null;
  const recommendedList = featuredClass ? recommended.slice(1) : recommended;

  return (
    <section className="space-y-6 sm:space-y-8 max-w-3xl mx-auto pb-6">
      {/* Subtle studio atmosphere band — no decoration, just place. */}
      <div className="member-studio-banner -mx-4 sm:mx-0 sm:rounded-[20px] bg-sand/60">
        <img
          src={(settings as any)?.hero_image_url || studioImages.atmosphere.src}
          alt={localizedAlt(studioImages.atmosphere, getLocale())}
          loading="eager"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-ivory/85 via-ivory/10 to-transparent"
          aria-hidden
        />
      </div>

      <div>
        <p className="member-eyebrow">{greeting}</p>
        <h1 className="member-headline mt-2 capitalize text-[32px] sm:text-[40px]">
          {greetingName}.
        </h1>
        <p className="text-sm text-slate mt-2">
          {settings?.welcome_text ?? t("member.welcomeBack")}
        </p>
      </div>

      {settings?.announcement_text && (
        <div className="member-card member-panel-powder p-5 flex gap-3 items-start">
          <Megaphone className="h-4 w-4 text-gold shrink-0 mt-1" />
          <p className="text-sm text-navy leading-relaxed">{settings.announcement_text}</p>
        </div>
      )}

      {/* Next booking — Cloud Card */}
      {isLoading ? (
        <div className="h-56 skeleton-brand rounded-[8px]" />
      ) : nextBooking ? (
        <NextBookingCard
          booking={nextBooking}
          studioName={settings?.studio_name ?? null}
          address={settings?.address ?? null}
        />
      ) : featuredClass ? (
        <section className="member-card member-panel-sand p-5 space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="member-eyebrow">{t("member.bookNext")}</p>
              <h2 className="font-display italic text-2xl text-navy mt-1">
                {t("member.keepPracticeMoving")}
              </h2>
            </div>
            <Link
              to="/member/schedule"
              className="member-eyebrow min-h-11 inline-flex items-center text-gold hover:text-navy"
            >
              {t("member.allSessions")} →
            </Link>
          </div>
          <VisualClassCard
            cls={featuredClass}
            state={deriveClassState(featuredClass, {
              booked: false,
              waiting: false,
              remainingCredits: data?.member?.remaining_credits ?? 0,
            })}
            onOpen={() => setOpenClass(featuredClass.id)}
            compact
          />
        </section>
      ) : (
        <MemberEmptyState
          title={t("member.home.emptyTitle")}
          body={t("member.home.emptyBody")}
          cta={{ label: t("member.browseSchedule"), to: "/member/schedule" }}
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
        <div className="flex items-baseline justify-between">
          <h2 className="font-display italic text-2xl text-navy">{t("member.forYou")}</h2>
          <Link
            to="/member/schedule"
            className="member-eyebrow min-h-11 inline-flex items-center text-gold hover:text-navy"
          >
            {t("member.allSessions")} →
          </Link>
        </div>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[128px] skeleton-brand rounded-[18px]" />
            ))}
          </div>
        ) : recommendedList.length === 0 ? (
          <p className="text-sm italic text-slate">{t("member.noCalendar")}</p>
        ) : (
          <div className="space-y-2.5">
            {recommendedList.slice(0, 3).map((c: any) => (
              <VisualClassCard
                key={c.id}
                cls={c}
                state={deriveClassState(c, {
                  booked: false,
                  waiting: false,
                  remainingCredits: data?.member?.remaining_credits ?? 0,
                })}
                onOpen={() => setOpenClass(c.id)}
                compact
              />
            ))}
          </div>
        )}
      </div>

      {/* Upcoming list preview */}
      {upcomingBookings.length > 1 && (
        <div className="space-y-3">
          <h2 className="font-display text-xl text-navy">{t("member.alsoComing")}</h2>
          <div className="space-y-2.5">
            {upcomingBookings.slice(1).map((b: any) => (
              <VisualClassCardMini
                key={b.id}
                cls={b.class}
                state={deriveClassState(b.class, {
                  booked: true,
                  waiting: false,
                  remainingCredits: data?.member?.remaining_credits ?? 0,
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
      />
    </section>
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
  const cls = booking.class;
  function addToCalendar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const ics = buildIcs({
      uid: booking.id,
      title: cls.title,
      startsAt: cls.starts_at,
      durationMinutes: cls.duration_minutes,
      location: [cls.room_ref?.name ?? cls.room, address].filter(Boolean).join(" · "),
      description: `Cancel up to ${cls.cancellation_window_hours}h before. Instructor: ${cls.instructor?.name ?? "—"}.`,
      studioName,
    });
    downloadIcs(`${cls.title.replace(/\s+/g, "-").toLowerCase()}.ics`, ics);
  }
  return (
    <Link
      to="/member/bookings"
      className="block member-card overflow-hidden hover:member-card-hover"
    >
      <ClassImage cls={cls} className="member-class-media">
        <div
          className="absolute inset-0 z-[2] pointer-events-none"
          aria-hidden
          style={{
            background:
              "linear-gradient(0deg, rgba(11,29,58,0.78) 0%, rgba(11,29,58,0.28) 48%, rgba(11,29,58,0.08) 100%)",
          }}
        />
        <div className="absolute top-4 left-5 right-5 z-10 text-ivory flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.3em]">{t("member.yourCloudCard")}</p>
          <span className="text-[10px] uppercase tracking-[0.25em] bg-white/85 text-navy px-2.5 py-1 rounded-full">
            {formatRelative(cls.starts_at)}
          </span>
        </div>
        <div className="absolute bottom-4 left-5 right-5 z-10 text-ivory">
          <p className="text-xs uppercase tracking-[0.25em] opacity-90">
            {formatDate(cls.starts_at)} · {formatTime(cls.starts_at)}
          </p>
          <p className="font-display text-3xl mt-1 leading-tight text-ivory drop-shadow-[0_1px_2px_rgba(11,29,58,0.65)]">
            {cls.title}
          </p>
        </div>
      </ClassImage>
      <div className="px-5 py-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3 w-3 text-gold" />
          {cls.room_ref?.name ?? cls.room ?? "—"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-gold" />
          {cls.instructor?.name ?? "—"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-gold" />
          {t("booking.cancelWindow", { hours: cls.cancellation_window_hours }).replace(/\.$/, "")}
        </span>
        <button
          onClick={addToCalendar}
          className="ml-auto member-eyebrow text-gold hover:text-navy"
        >
          {t("member.addCalendar")}
        </button>
      </div>
    </Link>
  );
}

function PackageMini({ activePlan, credits }: { activePlan: any; credits: number }) {
  return (
    <Link
      to="/member/packages"
      className="block member-card p-5 hover:member-card-hover relative overflow-hidden"
    >
      <span aria-hidden className="absolute inset-y-0 start-0 w-[3px] bg-gold/80" />
      <p className="member-eyebrow">{t("member.activePackage")}</p>
      <p className="font-display text-xl text-navy mt-1.5 leading-tight truncate">
        {activePlan?.plan?.name ?? t("member.noActivePackage")}
      </p>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="numeric-display text-3xl font-display text-navy">{credits}</p>
          <p className="text-[11px] text-slate mt-0.5">{t("member.creditsRemaining")}</p>
        </div>
        {activePlan?.expires_at && (
          <p className="text-[11px] text-slate text-end shrink-0">
            {t("member.expires")}
            <br />
            <span className="text-navy">
              {new Date(activePlan.expires_at).toLocaleDateString()}
            </span>
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
  const text = `Hi ${studioName ?? "the studio"} 👋\nThis is ${memberName ?? "a member"}.`;
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
        <ArrowRight className="h-3 w-3 text-gold" />
      </Link>
      <Link
        to="/member/packages"
        className="flex min-h-11 items-center justify-between text-sm text-navy py-2 border-b hairline"
      >
        <span className="inline-flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-gold" /> {t("member.buyPackage")}
        </span>
        <ArrowRight className="h-3 w-3 text-gold" />
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
        <ArrowRight className="h-3 w-3 text-gold" />
      </a>
    </div>
  );
}
