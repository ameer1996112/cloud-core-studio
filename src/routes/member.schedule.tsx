import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect, useSyncExternalStore } from "react";
import { RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listAvailableClasses } from "@/lib/member.functions";
import { deriveClassState, MemberEmptyState } from "@/components/member/PremiumClassCard";
import { VisualClassCard, ScheduleDaySection } from "@/components/visual/VisualClassCard";
import { ClassDetailSheet, deriveGuestClassState } from "@/components/member/ClassDetailSheet";
import { AppShell } from "@/components/app-shell/AppShell";
import { PublicShell } from "@/components/public/PublicShell";
import {
  MemberScheduleFilterPanel,
  type DateScope,
} from "@/components/member/MemberScheduleFilterPanel";
import { WeeklyPromoBanner } from "@/components/member/WeeklyPromoBanner";
import { MemberPageIntro } from "@/components/member/MemberPage";
import { MemberRouteError, MemberRouteSkeleton } from "@/components/member/MemberRouteSkeleton";
import { t, useI18n, type Lang } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { getMemberScheduleQueryKey, getViewerCacheKey } from "@/lib/memberQueryKeys";
import {
  localizedClassTitle,
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
import { getScheduleEmptyStateKind } from "@/lib/member-ui";
import { getLocalizedIntensity } from "@/lib/lesson-card-variants";

export const Route = createFileRoute("/member/schedule")({
  validateSearch: (search: Record<string, unknown>) => ({
    program: typeof search.program === "string" ? search.program : undefined,
  }),
  component: MemberSchedulePublic,
});

const LOCATION_CHANGE_EVENT = "cc:locationchange";

function subscribeToLocationChange(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const pushState = window.history.pushState;
  const replaceState = window.history.replaceState;
  const notify = () => listener();
  const wrap =
    (method: typeof window.history.pushState) =>
    (...args: Parameters<typeof window.history.pushState>) => {
      method.apply(window.history, args);
      window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
    };
  const wrappedPushState = wrap(pushState);
  const wrappedReplaceState = wrap(replaceState);
  window.history.pushState = wrappedPushState;
  window.history.replaceState = wrappedReplaceState;
  window.addEventListener("popstate", notify);
  window.addEventListener(LOCATION_CHANGE_EVENT, notify);
  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener(LOCATION_CHANGE_EVENT, notify);
    if (window.history.pushState === wrappedPushState) window.history.pushState = pushState;
    if (window.history.replaceState === wrappedReplaceState)
      window.history.replaceState = replaceState;
  };
}

function readPromotionProgram() {
  return typeof window === "undefined"
    ? undefined
    : (new URL(window.location.href).searchParams.get("program") ?? undefined);
}

function usePromotionProgramSearch() {
  return useSyncExternalStore(subscribeToLocationChange, readPromotionProgram, () => undefined);
}

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
  promotionProgram?: string;
};
type MemberScheduleContentProps = {
  session: any;
  selectedClassId?: string | null;
  onSelectedClassChange?: (classId: string | null) => void;
  viewerCacheKey?: string;
  promotionProgram?: string;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
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
  promotionProgram,
}: MemberSchedulePublicProps = {}) {
  const { lang, dir } = useI18n();
  const routePromotionProgram = usePromotionProgramSearch();
  const resolvedPromotionProgram = promotionProgram ?? routePromotionProgram;
  const isAuthSnapshotInitialized = authSnapshot?.initialized === true;
  const [session, setSession] = useState<any>(authSnapshot?.session ?? null);
  const [checkingSession, setCheckingSession] = useState(!isAuthSnapshotInitialized);
  const guestCopy = GUEST_SCHEDULE_COPY[lang];
  const authHref = buildAuthReturnToHref(
    buildMemberScheduleReturnTo(
      selectedClassId,
      typeof window === "undefined" ? "" : window.location.search,
    ),
  );

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
      <PublicShell mainClassName="member-page w-full space-y-6 bg-ivory px-4 py-6 sm:px-6 lg:px-8">
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
      </PublicShell>
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
          promotionProgram={resolvedPromotionProgram}
        />
      </AppShell>
    );
  }

  return (
    <PublicShell mainClassName="public-safe-page relative overflow-x-hidden bg-ivory text-navy">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_top,var(--cc-alpha-gold-22),transparent_52%),linear-gradient(180deg,var(--cc-alpha-ivory-96)_0%,var(--cc-alpha-ivory-72)_42%,transparent_100%)]"
      />
      <div
        data-guest-flow-step="heading"
        className="public-safe-main relative mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-6 sm:px-6 lg:px-8"
      >
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
          <div className="relative min-h-[220px] border-t border-gold/15 bg-[linear-gradient(180deg,var(--cc-alpha-white-92)_0%,color-mix(in_srgb,var(--color-sand)_58%,transparent)_100%)] p-5 sm:p-8 lg:border-t-0 lg:border-s lg:p-10">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,var(--cc-alpha-gold-18),transparent_30%),radial-gradient(circle_at_82%_82%,var(--cc-alpha-navy-08),transparent_34%)]"
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
                <div className="rounded-[calc(var(--cc-radius-card)-2px)] border border-gold/20 bg-white/75 p-4 shadow-[0_24px_60px_-40px_var(--cc-alpha-navy-38)] backdrop-blur-sm">
                  <p className="member-eyebrow text-slate">{guestCopy.statWindow}</p>
                  <p className="mt-2 text-lg font-semibold text-navy">
                    {GUEST_SCHEDULE_STATS[lang].windowValue}
                  </p>
                </div>
                <div className="rounded-[calc(var(--cc-radius-card)-2px)] border border-gold/20 bg-white/75 p-4 shadow-[0_24px_60px_-40px_var(--cc-alpha-navy-38)] backdrop-blur-sm">
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
          promotionProgram={resolvedPromotionProgram}
        />
      </div>
    </PublicShell>
  );
}

export function MemberScheduleContent({
  session,
  selectedClassId,
  onSelectedClassChange,
  viewerCacheKey,
  promotionProgram,
}: MemberScheduleContentProps) {
  const { lang, dir } = useI18n();
  const programs = useMemo(
    () =>
      (promotionProgram ?? "")
        .split(",")
        .map((program) => program.trim())
        .filter(Boolean),
    [promotionProgram],
  );
  useDocumentTitle("page.schedule.title");
  const fetchSchedule = useServerFn(listAvailableClasses);
  const resolvedViewerCacheKey = viewerCacheKey ?? getViewerCacheKey(session);
  const initialSelectedClassId =
    selectedClassId === undefined && typeof window !== "undefined"
      ? readMemberScheduleClassId(window.location.href)
      : null;
  const { data, isLoading, isError, refetch } = useQuery({
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
  const clearAllFilters = () => {
    setSearch("");
    setDateScope("all");
    setFilter({});
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("program");
      window.history.replaceState(window.history.state, "", url);
    }
  };
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
  const hasScheduleData = data != null;
  const isInitialLoading = isLoading && !hasScheduleData;
  const fatalError = isError && !hasScheduleData;
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
      if (programs.length && !programs.includes(c.program_type?.slug)) return false;
      if (filter.level && c.program_type?.level !== filter.level) return false;
      if (filter.energy && c.energy !== filter.energy) return false;
      if (filter.instructor && c.instructor?.name !== filter.instructor) return false;
      if (filter.room && (c.room_ref?.name ?? c.room) !== filter.room) return false;
      if (search && !localizedClassTitle(c).toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [classes, dateScope, filter, programs, search]);
  const guestOpenClassesCount = session ? 0 : getGuestOpenClassesCount(filtered);

  const groups = new Map<string, any[]>();
  for (const c of filtered) {
    const key = startOfDay(new Date(c.starts_at)).toISOString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  const hasNoClasses = classes.length === 0;
  const contentFilterCount =
    (search.trim() ? 1 : 0) +
    Object.values(filter).filter(Boolean).length +
    (programs.length ? 1 : 0);
  const emptyStateKind = getScheduleEmptyStateKind(
    classes.length,
    filtered.length,
    contentFilterCount,
  );
  const emptyTitle =
    emptyStateKind === "filtered"
      ? t("member.schedule.empty.filtered.title")
      : t("member.schedule.empty.inventory.title");
  const emptyBody =
    emptyStateKind === "filtered"
      ? t("member.schedule.empty.filtered.body")
      : t("member.schedule.empty.inventory.body");
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

  const filterPanel = (
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
          formatOption: (value) => getLocalizedIntensity(value, lang),
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
                formatOption: (value: string) => localizedRoomName({ name: value }, value) ?? value,
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
      onClearAll={clearAllFilters}
    />
  );

  const scheduleSections = Array.from(groups.entries()).map(([key, items]) => (
    <ScheduleDaySection key={key} date={new Date(key)} count={items.length}>
      {items.map((c: any, index: number) => (
        <VisualClassCard
          key={c.id}
          cls={c}
          state={cardStateFor(c)}
          bookingPresentationAudience={session ? "member" : "guest"}
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
  ));

  if (!session) {
    return (
      <section dir={dir} className="member-page w-full space-y-6 pb-10">
        <div className="member-page-panel p-5 sm:p-8">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] md:items-center">
            <div className="member-page-copy">
              <p className="member-eyebrow">{t("nav.schedule")}</p>
              <p className="member-page-body mt-2 max-w-2xl">{guestCopy?.scheduleHint}</p>
            </div>
            <div className="member-stat-strip" dir={dir}>
              {guestStatCells.map((stat) => (
                <StatCell
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  valueClassName={stat.valueClassName}
                />
              ))}
            </div>
          </div>
        </div>

        <div data-guest-flow-step="date-controls">{filterPanel}</div>

        <div data-guest-flow-step="class-list">
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

          {!isLoading && scheduleSections}
        </div>

        {guestCopy && guestStats ? (
          <section
            data-guest-flow-step="trust"
            className="member-page-panel grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]"
          >
            <div>
              <p className="member-eyebrow text-slate">{guestCopy.panelEyebrow}</p>
              <h2 className="mt-3 text-2xl font-semibold leading-tight text-navy sm:text-3xl">
                {guestCopy.panelTitle}
              </h2>
              <p className="member-page-body mt-3">{guestCopy.body}</p>
              <p className="mt-3 text-sm leading-6 text-slate">{guestCopy.panelBody}</p>
              <p className="mt-3 text-sm font-medium leading-6 text-navy">{guestCopy.stateGuide}</p>
            </div>
            <div className="member-stat-strip" dir={dir}>
              {guestStatCells.map((stat) => (
                <StatCell
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  valueClassName={stat.valueClassName}
                />
              ))}
            </div>
          </section>
        ) : null}

        {guestCopy && guestStats ? (
          <section
            data-guest-flow-step="sign-in-handoff"
            className="rounded-[var(--cc-radius-card)] border border-gold/25 bg-white/80 p-5 text-center shadow-[var(--shadow-card)] sm:p-7"
          >
            <p className="mx-auto max-w-2xl text-sm leading-6 text-slate">
              {guestStats.accessNote}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link
                to={guestAuthHref}
                className="btn-primary min-h-12 justify-center px-5 hover:btn-primary-hover"
              >
                {guestCopy.primaryCta}
              </Link>
              <Link
                to="/support"
                className="btn-outline min-h-12 justify-center px-5 hover:btn-outline-hover"
              >
                {guestCopy.secondaryCta}
              </Link>
            </div>
          </section>
        ) : null}

        <div data-guest-flow-step="promotion">
          <WeeklyPromoBanner onThisWeekClick={() => setDateScope("week")} />
        </div>

        <ClassDetailSheet
          classId={openClass}
          open={!!openClass}
          onOpenChange={(v) => !v && setOpenClass(null)}
          viewerContext="guest"
          viewerCacheKey={resolvedViewerCacheKey}
        />
      </section>
    );
  }

  return (
    <section dir={dir} className="member-schedule-page member-page w-full space-y-6 pb-10">
      <MemberPageIntro
        eyebrow={t("member.schedule.kicker")}
        title={t("nav.schedule")}
        body={t("member.schedule.body")}
        aside={
          hasScheduleData ? (
            <div className="member-schedule-credit-aside">
              <p className="member-eyebrow">{t("member.stat.credits")}</p>
              <p className="numeric-display numeric-display-md">{member?.remaining_credits ?? 0}</p>
            </div>
          ) : (
            <div className="member-schedule-credit-placeholder skeleton-brand" aria-hidden="true" />
          )
        }
      />

      {fatalError ? (
        <MemberRouteError onRetry={() => void refetch()} />
      ) : isInitialLoading ? (
        <MemberRouteSkeleton route="schedule" />
      ) : (
        <>
          {filterPanel}

          {filtered.length === 0 ? (
            <div className="member-schedule-empty-state">
              <MemberEmptyState variant="schedule" title={emptyTitle} body={emptyBody} />
              {emptyStateKind === "filtered" ? (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="btn-outline member-schedule-empty-reset"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>{t("member.schedule.filter.clear")}</span>
                </button>
              ) : null}
            </div>
          ) : (
            scheduleSections
          )}

          <WeeklyPromoBanner onThisWeekClick={() => setDateScope("week")} />
        </>
      )}

      <ClassDetailSheet
        classId={openClass}
        open={!!openClass}
        onOpenChange={(v) => !v && setOpenClass(null)}
        viewerContext="member"
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
