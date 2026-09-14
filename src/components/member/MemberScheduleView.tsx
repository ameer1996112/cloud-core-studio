import { AtelierPageHeading } from "@/components/member/design/AtelierPageHeading";
import { ReviewButton } from "@/components/member/design/VisualSystem";
import { ScheduleDateStrip } from "./ScheduleDateStrip";
import { studioDateKey } from "@/lib/member-schedule-date";
import { Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { t, useI18n } from "@/lib/i18n";
import { deriveClassState, MemberEmptyState } from "./PremiumClassCard";
import { ScheduleDaySection } from "@/components/visual/VisualClassCard";
import { StudioClassItem, type StudioClass } from "./StudioClassItem";
import { deriveGuestClassState } from "./guest-class-state";
import { MemberScheduleFilterPanel, type DateScope } from "./MemberScheduleFilterPanel";
import { WeeklyPromoBanner } from "./WeeklyPromoBanner";
import {
  localizedClassTitle,
  localizedLevelName,
  localizedToneName,
  localizedRoomName,
  localizedInstructorName,
} from "@/lib/localized-content";
import { buildAuthReturnToHref, buildMemberScheduleReturnTo } from "@/lib/guest-auth-intent";
import type { listAvailableClasses } from "@/lib/member.functions";
import { GUEST_SCHEDULE_COPY } from "./guest-schedule-copy";
type ScheduleClass = StudioClass;
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function MemberScheduleView({
  data,
  isLoading,
  session,
  openClass,
  setOpenClass,
  promotion,
  isError = false,
  onRetry,
}: {
  data?: Awaited<ReturnType<typeof listAvailableClasses>>;
  isLoading: boolean;
  session: boolean;
  isError?: boolean;
  onRetry?: () => void;
  openClass: string | null;
  setOpenClass: (id: string | null) => void;
  promotion?: ReactNode;
}) {
  const { lang, dir } = useI18n();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<{
    level?: string;
    energy?: string;
    instructor?: string;
    room?: string;
  }>({});
  const [dateScope, setDateScope] = useState<DateScope>("all");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const guestAuthHref = buildAuthReturnToHref(buildMemberScheduleReturnTo(openClass));
  const classes = useMemo(() => data?.classes ?? [], [data?.classes]);
  const hasBlockingError = isError && !data;
  const staleScheduleCopy = {
    he: "לא הצלחנו לעדכן את הלוח. מוצגים השיעורים מהעדכון האחרון; הזמינות עשויה להשתנות.",
    ar: "تعذّر تحديث الجدول. نعرض الحصص من آخر تحديث؛ قد يتغيّر توفر الأماكن.",
    en: "The schedule could not refresh. Showing the last loaded classes; availability may have changed.",
  };
  const member = data?.member;
  const booked = data?.bookingsByClass ?? {};
  const waiting = data?.waitlistByClass ?? {};
  const guestCopy = session ? null : GUEST_SCHEDULE_COPY[lang];

  const levels = Array.from(
    new Set<string>(classes.map((c: any) => c.program_type?.level).filter(Boolean)),
  );
  const energies = Array.from(new Set<string>(classes.map((c: any) => c.energy).filter(Boolean)));
  const instructors = Array.from(
    new Set<string>(classes.map((c: any) => c.instructor?.name).filter(Boolean)),
  );
  const rooms = Array.from(
    new Set<string>(classes.map((c: any) => c.room_ref?.name ?? c.room).filter(Boolean)),
  );

  const filtered = useMemo(() => {
    const now = startOfDay(new Date());
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);
    return classes.filter((c: any) => {
      const d = new Date(c.starts_at);
      if (selectedDay && studioDateKey(d) !== selectedDay) return false;
      if (dateScope === "today" && (d < now || d >= tomorrow)) return false;
      if (dateScope === "tomorrow") {
        const t2 = new Date(tomorrow);
        t2.setDate(tomorrow.getDate() + 1);
        if (d < tomorrow || d >= t2) return false;
      }
      if (dateScope === "week" && (d < now || d >= weekEnd)) return false;
      if (filter.level && c.program_type?.level !== filter.level) return false;
      if (filter.energy && c.energy !== filter.energy) return false;
      if (filter.instructor && c.instructor?.name !== filter.instructor) return false;
      if (filter.room && (c.room_ref?.name ?? c.room) !== filter.room) return false;
      if (search && !localizedClassTitle(c).toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [classes, dateScope, filter, search, selectedDay]);

  const groups = new Map<string, any[]>();
  for (const c of filtered) {
    const key = startOfDay(new Date(c.starts_at)).toISOString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  const hasNoClasses = classes.length === 0;
  const emptyStatePrimaryAction = hasNoClasses
    ? { label: t("legal.support"), to: "/support" as const }
    : !session
      ? { label: guestCopy!.primaryCta, to: guestAuthHref }
      : undefined;
  const emptyStateSecondaryAction =
    hasNoClasses && !session ? { label: guestCopy!.primaryCta, to: guestAuthHref } : undefined;
  const cardStateFor = (cls: ScheduleClass) =>
    session
      ? deriveClassState(cls, {
          booked: !!booked[cls.id],
          waiting: !!waiting[cls.id],
          remainingCredits: member?.remaining_credits ?? 0,
          hasActivePackage: data?.hasActivePackage,
        })
      : deriveGuestClassState(cls);

  return (
    <section dir={dir} className="member-page aura-schedule-page">
      {promotion}
      <AtelierPageHeading
        title={t("nav.schedule")}
        image="/images/editorial/studio-sanctuary-v1.png"
      >
        {!session && <p>{guestCopy?.scheduleHint}</p>}
      </AtelierPageHeading>
      <div className="schedule-reading-surface">
        <div className="schedule-control-region">
          <ScheduleDateStrip
            offset={weekOffset}
            selected={selectedDay}
            onOffsetChange={setWeekOffset}
            onSelect={(day) => {
              setSelectedDay(day);
              setDateScope("all");
            }}
          />
          <MemberScheduleFilterPanel
            dir={dir}
            lang={lang}
            search={search}
            onSearchChange={setSearch}
            dateScope={dateScope}
            onDateScopeChange={(scope) => {
              setDateScope(scope);
              setSelectedDay(null);
            }}
            filters={[
              {
                key: "level",
                label: t("member.filter.level"),
                options: levels,
                value: filter.level,
                formatOption: (value) => localizedLevelName(value, null, lang),
              },
              {
                key: "energy",
                label: t("member.filter.energy"),
                options: energies,
                value: filter.energy,
                formatOption: (value) => localizedToneName(value, undefined, lang),
              },
              ...(rooms.length > 1
                ? [
                    {
                      key: "room" as const,
                      label: t("common.room"),
                      options: rooms,
                      value: filter.room,
                      formatOption: (value: string) =>
                        localizedRoomName({ name: value }, value) ?? value,
                    },
                  ]
                : []),
              {
                key: "instructor",
                label: t("common.with"),
                options: instructors,
                value: filter.instructor,
                formatOption: (value) => localizedInstructorName(value),
              },
            ]}
            onFilterChange={(key, value) => setFilter((current) => ({ ...current, [key]: value }))}
          />
        </div>
        <div className="aura-schedule-results">
          {isLoading && (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[148px] skeleton-brand rounded-[var(--cc-radius-card)]" />
              ))}
            </div>
          )}

          {isError && (
            <section role="alert" className="home-status">
              <h2>{t("page.error.eyebrow")}</h2>
              <p>{data ? staleScheduleCopy[lang] : t("page.error.body")}</p>
              <ReviewButton
                variant="primary"
                type="submit"
                className="home-primary"
                onClick={onRetry}
              >
                {t("common.retry")}
              </ReviewButton>
            </section>
          )}
          {!isLoading && !hasBlockingError && filtered.length === 0 && (
            <MemberEmptyState
              variant="schedule"
              illustration={null}
              eyebrow=""
              align="start"
              title={hasNoClasses ? t("member.empty.schedule.title") : t("member.noSessions")}
              body={hasNoClasses ? t("member.empty.schedule.body") : t("member.clearFilters")}
              primaryAction={emptyStatePrimaryAction}
              secondaryAction={emptyStateSecondaryAction}
            />
          )}

          {!isLoading &&
            !hasBlockingError &&
            Array.from(groups.entries()).map(([key, items]) => (
              <ScheduleDaySection key={key} date={new Date(key)} count={items.length}>
                {items.map((c: ScheduleClass) => (
                  <StudioClassItem
                    thumbnail
                    inlineStatus
                    key={c.id}
                    showRoom={false}
                    metadata={
                      ["package_required", "low_credits"].includes(cardStateFor(c).kind) &&
                      c.capacity != null &&
                      c.booked_count != null ? (
                        <span>
                          {t(
                            deriveGuestClassState(c).kind === "almost"
                              ? "schedule.availability.few"
                              : "schedule.availability.open",
                          )}
                        </span>
                      ) : undefined
                    }
                    cls={c}
                    state={cardStateFor(c)}
                    showDate={false}
                    timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
                    secondaryAction={
                      session &&
                      ["low_credits", "package_required"].includes(cardStateFor(c).kind) ? (
                        <Link to="/member/packages" className="home-text-action">
                          {t(
                            cardStateFor(c).kind === "package_required"
                              ? "class.cta.choosePackage"
                              : "class.cta.topUpCredits",
                          )}
                        </Link>
                      ) : undefined
                    }
                    action={
                      <ReviewButton
                        type="button"
                        aria-haspopup="dialog"
                        aria-label={`${t("member.viewClass")}: ${localizedClassTitle(c)}`}
                        onClick={() => setOpenClass(c.id)}
                      >
                        {t("member.viewClass")}
                      </ReviewButton>
                    }
                  />
                ))}
              </ScheduleDaySection>
            ))}

          {!isLoading && !hasBlockingError && (
            <div className="aura-schedule-totals">
              <span>
                <strong>
                  {session
                    ? filtered.length
                    : filtered.filter((c: ScheduleClass) =>
                        ["available", "almost"].includes(deriveGuestClassState(c).kind),
                      ).length}
                </strong>{" "}
                {session ? t("member.stat.available") : guestCopy?.statClasses}
              </span>
              {session && member?.remaining_credits != null && (
                <span>
                  <strong>
                    {member.remaining_credits >= 999
                      ? t("packages.unlimited")
                      : member.remaining_credits}
                  </strong>{" "}
                  {t("member.stat.credits")}
                </span>
              )}
            </div>
          )}
          <WeeklyPromoBanner onThisWeekClick={() => setDateScope("week")} />
        </div>
      </div>
    </section>
  );
}
