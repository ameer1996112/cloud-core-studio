import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_ACCESS_TOKEN_COOKIE } from "@/integrations/supabase/session-cookie";
import { listAvailableClasses } from "@/lib/member.functions";
import { deriveClassState, MemberEmptyState } from "@/components/member/PremiumClassCard";
import { VisualClassCard, ScheduleDaySection } from "@/components/visual/VisualClassCard";
import { ClassDetailSheet, deriveGuestClassState } from "@/components/member/ClassDetailSheet";
import { AppShell } from "@/components/app-shell/AppShell";
import {
  MemberScheduleFilterPanel,
  type DateScope,
} from "@/components/member/MemberScheduleFilterPanel";
import { WeeklyPromoBanner } from "@/components/member/WeeklyPromoBanner";
import { t, useI18n, type Lang } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { getMemberScheduleQueryKey, getViewerCacheKey } from "@/lib/memberQueryKeys";
import {
  localizedClassTitle,
  localizedFilterLabel,
  localizedInstructorName,
  localizedRoomName,
  localizedToneName,
} from "@/lib/localized-content";
import {
  buildAuthReturnToHref,
  buildMemberScheduleReturnTo,
  buildMemberScheduleUrl,
  readMemberScheduleClassId,
  syncGuestScheduleAuthIntent,
} from "@/lib/guest-auth-intent";

export const Route = createFileRoute("/member/schedule")({
  component: MemberSchedulePublic,
});

const GUEST_SCHEDULE_WINDOW_DAYS = 14;

type GuestScheduleCopy = {
  eyebrow: string;
  title: string;
  body: string;
  panelEyebrow: string;
  panelTitle: string;
  panelBody: string;
  scheduleHint: string;
  primaryCta: string;
  secondaryCta: string;
  statClasses: string;
  statWindow: string;
  statAccess: string;
};

const GUEST_SCHEDULE_COPY: Record<Lang, GuestScheduleCopy> = {
  en: {
    eyebrow: "Guest schedule preview",
    title: "See the studio rhythm before you sign in.",
    body: "Browse the next two weeks of movement, filter the live schedule, and step into Cloud & Core when you are ready to book.",
    panelEyebrow: "Schedule preview",
    panelTitle: "Current availability",
    panelBody:
      "Full classes stay visible here, and signing in is the next step before booking or waitlist access.",
    scheduleHint:
      "Use filters to scan the live schedule. Sign in only when you are ready to reserve.",
    primaryCta: "Sign in to book",
    secondaryCta: "Talk to support",
    statClasses: "Open classes",
    statWindow: "Preview window",
    statAccess: "Guest access",
  },
  he: {
    eyebrow: "תצוגת לו״ז לאורחות",
    title: "לראות את קצב הסטודיו עוד לפני ההתחברות.",
    body: "אפשר לעבור על השבועיים הקרובים, לסנן את הלו״ז החי, ולהתחבר ל-Cloud & Core כשתרצי להזמין.",
    panelEyebrow: "תצוגת לו״ז",
    panelTitle: "זמינות נוכחית",
    panelBody: "שיעורים מלאים נשארים גלויים כאן, והשלב הבא לפני הזמנה או רשימת המתנה הוא התחברות.",
    scheduleHint: "המסננים פתוחים לצפייה חיה. מתחברות רק כשמוכנות להשלים הזמנה.",
    primaryCta: "התחברות להזמנה",
    secondaryCta: "שיחה עם התמיכה",
    statClasses: "שיעורים פתוחים",
    statWindow: "חלון צפייה",
    statAccess: "גישת אורחת",
  },
  ar: {
    eyebrow: "معاينة جدول للضيفة",
    title: "شاهدي إيقاع الاستوديو قبل تسجيل الدخول.",
    body: "تصفحي الأسبوعين القادمين، صفّي الجدول المباشر، وادخلي إلى Cloud & Core عندما تكونين جاهزة للحجز.",
    panelEyebrow: "معاينة الجدول",
    panelTitle: "التوفر الحالي",
    panelBody:
      "تبقى الحصص الممتلئة ظاهرة هنا، وتسجيل الدخول هو الخطوة التالية قبل الحجز أو الانتظار.",
    scheduleHint:
      "استخدمي الفلاتر لمراجعة الجدول المباشر. سجلي الدخول فقط عندما تكونين جاهزة للحجز.",
    primaryCta: "تسجيل الدخول للحجز",
    secondaryCta: "التواصل مع الدعم",
    statClasses: "حصص متاحة",
    statWindow: "مدة المعاينة",
    statAccess: "دخول الضيفة",
  },
};

const GUEST_SCHEDULE_STATS: Record<
  Lang,
  { windowValue: string; accessValue: string; accessNote: string }
> = {
  en: {
    windowValue: `${GUEST_SCHEDULE_WINDOW_DAYS} days`,
    accessValue: "Open preview",
    accessNote: "Public browsing now, sign-in ready booking when you want to reserve.",
  },
  he: {
    windowValue: `${GUEST_SCHEDULE_WINDOW_DAYS} ימים`,
    accessValue: "פתוחה",
    accessNote: "צפייה פתוחה עכשיו, והתחברות אחת כשרוצים לעבור להזמנה.",
  },
  ar: {
    windowValue: `${GUEST_SCHEDULE_WINDOW_DAYS} يومًا`,
    accessValue: "مفتوح",
    accessNote: "تصفح عام الآن، وتسجيل دخول جاهز عندما ترغبين في تثبيت الحجز.",
  },
};

type ScheduleClass = Parameters<typeof deriveClassState>[0];
type AuthSnapshot = { initialized: boolean; session: any | null };
type MemberSchedulePublicProps = {
  authSnapshot?: AuthSnapshot;
  selectedClassId?: string | null;
  onSelectedClassChange?: (classId: string | null) => void;
};
type MemberScheduleContentProps = {
  session: any;
  selectedClassId?: string | null;
  onSelectedClassChange?: (classId: string | null) => void;
  viewerCacheKey?: string;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function hasSupabaseAccessTokenCookie() {
  if (typeof document === "undefined") return false;

  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .some((part) => part.startsWith(`${SUPABASE_ACCESS_TOKEN_COOKIE}=`));
}

// eslint-disable-next-line react-refresh/only-export-components
export function getGuestOpenClassesCount(classes: ScheduleClass[]) {
  return classes.filter((cls) => {
    const state = deriveGuestClassState(cls);
    return state.kind === "available" || state.kind === "almost";
  }).length;
}

function MemberSchedulePublic({
  authSnapshot,
  selectedClassId,
  onSelectedClassChange,
}: MemberSchedulePublicProps = {}) {
  const { lang, dir } = useI18n();
  const isAuthSnapshotInitialized = authSnapshot?.initialized === true;
  const [session, setSession] = useState<any>(authSnapshot?.session ?? null);
  const [checkingSession, setCheckingSession] = useState(
    !isAuthSnapshotInitialized && hasSupabaseAccessTokenCookie(),
  );
  const guestCopy = GUEST_SCHEDULE_COPY[lang];
  const authHref = buildAuthReturnToHref(buildMemberScheduleReturnTo(selectedClassId));

  useEffect(() => {
    if (isAuthSnapshotInitialized) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => sub.subscription.unsubscribe();
  }, [isAuthSnapshotInitialized]);

  if (checkingSession && !session) {
    return (
      <section
        dir={dir}
        className="member-page w-full space-y-6 bg-ivory px-4 py-6 sm:px-6 lg:px-8"
      >
        <div className="member-page-panel p-5 sm:p-8">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(220px,300px)] md:items-end">
            <div className="space-y-3">
              <div className="h-3 w-28 skeleton-brand rounded-full" />
              <div className="h-12 max-w-lg skeleton-brand rounded-[var(--cc-radius-chip)]" />
              <div className="h-5 max-w-2xl skeleton-brand rounded-full" />
            </div>
            <div className="member-stat-strip">
              {[0, 1].map((index) => (
                <div
                  key={index}
                  className="h-[94px] skeleton-brand rounded-[var(--cc-radius-card)]"
                />
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-[148px] skeleton-brand rounded-[var(--cc-radius-card)]" />
          ))}
        </div>
      </section>
    );
  }

  if (session) {
    return (
      <AppShell role="member">
        <MemberScheduleContent
          session={session}
          selectedClassId={selectedClassId}
          onSelectedClassChange={onSelectedClassChange}
          viewerCacheKey={getViewerCacheKey(session)}
        />
      </AppShell>
    );
  }

  return (
    <div dir={dir} className="public-safe-page relative overflow-x-hidden bg-ivory text-navy">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(212,175,106,0.22),transparent_52%),linear-gradient(180deg,rgba(250,247,242,0.96)_0%,rgba(250,247,242,0.72)_42%,rgba(250,247,242,0)_100%)]"
      />
      <header className="public-safe-header sticky top-0 z-40 w-full border-b border-navy/8 bg-ivory/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <Link to="/auth" className="brand-wordmark text-xl text-navy" dir="ltr">
            Cloud &amp; Core
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/support"
              className="text-sm font-medium text-slate transition-colors hover:text-navy"
            >
              {t("legal.support")}
            </Link>
            <Link
              to={authHref}
              className="inline-flex min-h-9 items-center justify-center rounded-full border border-gold/40 bg-white px-4 text-xs font-semibold uppercase tracking-[0.18em] text-navy shadow-sm transition-colors hover:bg-gold/8"
            >
              {guestCopy.primaryCta}
            </Link>
          </div>
        </div>
      </header>

      <main className="public-safe-main relative mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-6 sm:px-6 lg:px-8">
        <section className="member-page-panel grid overflow-hidden lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <div className="member-page-copy p-5 sm:p-8 md:p-10">
            <p className="member-eyebrow">{guestCopy.eyebrow}</p>
            <h1 className="member-page-title mt-3">{guestCopy.title}</h1>
            <p className="member-page-body mt-3 max-w-2xl">{guestCopy.body}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link to={authHref} className="btn-primary hover:btn-primary-hover justify-center">
                {guestCopy.primaryCta}
              </Link>
              <Link to="/support" className="btn-outline hover:btn-outline-hover justify-center">
                {guestCopy.secondaryCta}
              </Link>
            </div>
          </div>
          <div className="relative min-h-[220px] border-t border-gold/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(232,223,209,0.58)_100%)] p-5 sm:p-8 lg:border-t-0 lg:border-s lg:p-10">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(212,175,106,0.16),transparent_30%),radial-gradient(circle_at_82%_82%,rgba(11,29,58,0.08),transparent_34%)]"
            />
            <div className="relative flex h-full flex-col justify-between gap-6">
              <div className="space-y-3">
                <p className="member-eyebrow text-slate">{guestCopy.panelEyebrow}</p>
                <p className="text-2xl font-semibold leading-tight text-navy sm:text-3xl">
                  {guestCopy.panelTitle}
                </p>
                <p className="member-page-body max-w-md">{guestCopy.panelBody}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[calc(var(--cc-radius-card)-2px)] border border-gold/20 bg-white/75 p-4 shadow-[0_24px_60px_-40px_rgba(11,29,58,0.4)] backdrop-blur-sm">
                  <p className="member-eyebrow text-slate">{guestCopy.statWindow}</p>
                  <p className="mt-2 text-lg font-semibold text-navy">
                    {GUEST_SCHEDULE_STATS[lang].windowValue}
                  </p>
                </div>
                <div className="rounded-[calc(var(--cc-radius-card)-2px)] border border-gold/20 bg-white/75 p-4 shadow-[0_24px_60px_-40px_rgba(11,29,58,0.4)] backdrop-blur-sm">
                  <p className="member-eyebrow text-slate">{guestCopy.statAccess}</p>
                  <p className="mt-2 text-lg font-semibold text-navy">
                    {GUEST_SCHEDULE_STATS[lang].accessValue}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate">
                    {GUEST_SCHEDULE_STATS[lang].accessNote}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <MemberScheduleContent
          session={null}
          selectedClassId={selectedClassId}
          onSelectedClassChange={onSelectedClassChange}
          viewerCacheKey="guest"
        />
      </main>
    </div>
  );
}

export function MemberScheduleContent({
  session,
  selectedClassId,
  onSelectedClassChange,
  viewerCacheKey,
}: MemberScheduleContentProps) {
  const { lang, dir } = useI18n();
  useDocumentTitle("page.schedule.title");
  const fetchSchedule = useServerFn(listAvailableClasses);
  const resolvedViewerCacheKey = viewerCacheKey ?? getViewerCacheKey(session);
  const initialSelectedClassId =
    selectedClassId === undefined && typeof window !== "undefined"
      ? readMemberScheduleClassId(window.location.href)
      : null;
  const { data, isLoading } = useQuery({
    queryKey: getMemberScheduleQueryKey(resolvedViewerCacheKey),
    queryFn: () => fetchSchedule({ data: { days: 14 } }),
  });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<{
    level?: string;
    energy?: string;
    instructor?: string;
    room?: string;
  }>({});
  const [dateScope, setDateScope] = useState<DateScope>("all");
  const [uncontrolledOpenClass, setUncontrolledOpenClass] = useState<string | null>(
    initialSelectedClassId,
  );
  const openClass = selectedClassId === undefined ? uncontrolledOpenClass : selectedClassId;
  const guestAuthHref = buildAuthReturnToHref(buildMemberScheduleReturnTo(openClass));
  const setOpenClass = (classId: string | null) => {
    if (selectedClassId === undefined) {
      setUncontrolledOpenClass(classId);
      return;
    }
    onSelectedClassChange?.(classId);
  };

  useEffect(() => {
    if (selectedClassId !== undefined || typeof window === "undefined") return;

    window.history.replaceState(
      window.history.state,
      "",
      buildMemberScheduleUrl(window.location.href, openClass),
    );
  }, [openClass, selectedClassId]);

  useEffect(() => {
    if (session || typeof window === "undefined") return;

    syncGuestScheduleAuthIntent(window.sessionStorage, openClass);
  }, [openClass, session]);

  const classes = useMemo(() => data?.classes ?? [], [data?.classes]);
  const member = data?.member;
  const booked = data?.bookingsByClass ?? {};
  const waiting = data?.waitlistByClass ?? {};
  const guestCopy = session ? null : GUEST_SCHEDULE_COPY[lang];
  const guestStats = session ? null : GUEST_SCHEDULE_STATS[lang];

  const levels = Array.from(
    new Set(classes.map((c: any) => c.program_type?.level).filter(Boolean)),
  );
  const energies = Array.from(new Set(classes.map((c: any) => c.energy).filter(Boolean)));
  const instructors = Array.from(
    new Set(classes.map((c: any) => c.instructor?.name).filter(Boolean)),
  );
  const rooms = Array.from(
    new Set(classes.map((c: any) => c.room_ref?.name ?? c.room).filter(Boolean)),
  );

  const filtered = useMemo(() => {
    const now = startOfDay(new Date());
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);
    return classes.filter((c: any) => {
      const d = new Date(c.starts_at);
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
  }, [classes, dateScope, filter, search]);
  const guestOpenClassesCount = session ? 0 : getGuestOpenClassesCount(filtered);

  const groups = new Map<string, any[]>();
  for (const c of filtered) {
    const key = startOfDay(new Date(c.starts_at)).toISOString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  const hasNoClasses = classes.length === 0;
  const guestStatCells =
    guestCopy && guestStats
      ? [
          { label: guestCopy.statClasses, value: guestOpenClassesCount },
          {
            label: guestCopy.statWindow,
            value: guestStats.windowValue,
            valueClassName: "text-lg sm:text-xl",
          },
          {
            label: guestCopy.statAccess,
            value: guestStats.accessValue,
            valueClassName: "text-lg sm:text-xl",
          },
        ]
      : [];
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
    <section dir={dir} className="member-page w-full space-y-6 pb-10">
      <div className="member-page-panel p-5 sm:p-8">
        <div
          className={`grid gap-6 ${session ? "md:grid-cols-[minmax(0,1fr)_minmax(220px,300px)] md:items-end" : "md:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] md:items-center"}`}
        >
          <div className="member-page-copy">
            {session ? (
              <>
                <p className="member-eyebrow">{t("member.schedule.kicker")}</p>
                <h1 className="member-page-title mt-3">{t("nav.schedule")}</h1>
                <p className="member-page-body mt-3">{t("member.schedule.body")}</p>
              </>
            ) : (
              <>
                <p className="member-eyebrow">{t("nav.schedule")}</p>
                <p className="member-page-body mt-2 max-w-2xl">{guestCopy?.scheduleHint}</p>
              </>
            )}
          </div>
          <div className="member-stat-strip" dir={dir}>
            {session ? (
              <>
                <StatCell label={t("member.stat.available")} value={filtered.length} />
                <StatCell label={t("member.stat.credits")} value={member?.remaining_credits ?? 0} />
              </>
            ) : (
              guestStatCells.map((stat) => (
                <StatCell
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  valueClassName={stat.valueClassName}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <WeeklyPromoBanner onThisWeekClick={() => setDateScope("week")} />

      <MemberScheduleFilterPanel
        dir={dir}
        lang={lang}
        search={search}
        onSearchChange={setSearch}
        dateScope={dateScope}
        onDateScopeChange={setDateScope}
        filters={[
          {
            key: "level",
            label: t("member.filter.level"),
            options: levels,
            value: filter.level,
            formatOption: (value) => localizedFilterLabel(value, lang),
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

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[148px] skeleton-brand rounded-[var(--cc-radius-card)]" />
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <MemberEmptyState
          variant="schedule"
          title={hasNoClasses ? t("member.empty.schedule.title") : t("member.noSessions")}
          body={hasNoClasses ? t("member.empty.schedule.body") : t("member.clearFilters")}
          primaryAction={emptyStatePrimaryAction}
          secondaryAction={emptyStateSecondaryAction}
        />
      )}

      {!isLoading &&
        Array.from(groups.entries()).map(([key, items]) => (
          <ScheduleDaySection key={key} date={new Date(key)} count={items.length}>
            {items.map((c: any, index: number) => (
              <VisualClassCard
                key={c.id}
                cls={c}
                state={cardStateFor(c)}
                onOpen={() => setOpenClass(c.id)}
                variant="standard"
                index={index}
                previousLesson={index > 0 ? items[index - 1] : null}
                roomCount={rooms.length}
                context="memberSchedule"
                eager={index === 0}
              />
            ))}
          </ScheduleDaySection>
        ))}

      <ClassDetailSheet
        classId={openClass}
        open={!!openClass}
        onOpenChange={(v) => !v && setOpenClass(null)}
        viewerContext={session ? "member" : "guest"}
        viewerCacheKey={resolvedViewerCacheKey}
      />
    </section>
  );
}

function StatCell({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="member-stat-cell">
      <p className="member-eyebrow text-slate">{label}</p>
      <p className={`numeric-display numeric-display-md mt-2 ${valueClassName ?? ""}`.trim()}>
        {value}
      </p>
    </div>
  );
}
