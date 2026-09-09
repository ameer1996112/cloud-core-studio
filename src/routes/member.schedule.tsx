import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { readSupabaseSession } from "@/integrations/supabase/read-session";
import { withDeadline } from "@/lib/async-deadline";
import { supabase } from "@/integrations/supabase/client";
import { listAvailableClasses } from "@/lib/member.functions";
import { deriveClassState } from "@/components/member/PremiumClassCard";
import { MemberScheduleView } from "@/components/member/MemberScheduleView";
import { GUEST_SCHEDULE_COPY } from "@/components/member/guest-schedule-copy";
import { ClassDetailSheet, deriveGuestClassState } from "@/components/member/ClassDetailSheet";
import { AppShell } from "@/components/app-shell/AppShell";
import { YogaPromoBanner } from "@/components/member/YogaPromoBanner";
import { useYogaPromo } from "@/hooks/useYogaPromo";
import { t, useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { getMemberScheduleQueryKey, getViewerCacheKey } from "@/lib/memberQueryKeys";
import {
  buildAuthReturnToHref,
  buildMemberScheduleReturnTo,
  buildMemberScheduleUrl,
  readMemberScheduleClassId,
  syncGuestScheduleAuthIntent,
} from "@/lib/guest-auth-intent";

export const Route = createFileRoute("/member/schedule")({
  head: () => ({
    meta: [
      { title: "Class Schedule | Cloud & Core Studio" },
      {
        name: "description",
        content: "Browse the upcoming Cloud & Core Studio class schedule.",
      },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: MemberSchedulePublic,
});

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
  const [checkingSession, setCheckingSession] = useState(!isAuthSnapshotInitialized);
  const [sessionError, setSessionError] = useState(false);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const guestCopy = GUEST_SCHEDULE_COPY[lang];
  const authHref = buildAuthReturnToHref(buildMemberScheduleReturnTo(selectedClassId));

  useEffect(() => {
    if (isAuthSnapshotInitialized) return;

    let active = true;
    setCheckingSession(true);
    setSessionError(false);
    const checkSession = () => {
      void readSupabaseSession()
        .then(({ data, error }) => {
          if (!active) return;
          if (error) throw error;
          setSession(data.session);
          setSessionError(false);
          setCheckingSession(false);
        })
        .catch(() => {
          if (!active) return;
          setSessionError(true);
          setCheckingSession(false);
        });
    };
    checkSession();
    window.addEventListener("online", checkSession);
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setCheckingSession(false);
      setSessionError(false);
    });
    return () => {
      active = false;
      window.removeEventListener("online", checkSession);
      sub.subscription.unsubscribe();
    };
  }, [isAuthSnapshotInitialized, sessionAttempt]);

  if (sessionError && !session) {
    return (
      <main id="main-content" dir={dir} className="member-page px-4 py-8">
        <div className="member-page-panel p-6" role="alert">
          <h1 className="text-xl font-medium">{t("recovery.error.title")}</h1>
          <p className="my-4">{t("member.outcome.offline.body")}</p>
          <div className="flex flex-wrap gap-4">
            <button
              className="cta-navy min-h-11 px-5"
              onClick={() => setSessionAttempt((value) => value + 1)}
            >
              {t("common.retry")}
            </button>
            <Link to="/member" className="inline-flex min-h-11 items-center px-4">
              {t("nav.home")}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (checkingSession && !session) {
    return (
      <section
        id="main-content"
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
          <Link
            to="/auth"
            className="brand-wordmark inline-flex min-h-12 items-center text-xl text-navy"
            dir="ltr"
          >
            Cloud &amp; Core
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/support"
              className="inline-flex min-h-12 items-center px-2 text-sm font-medium text-slate transition-colors hover:text-navy"
            >
              {t("legal.support")}
            </Link>
            <Link
              to={authHref}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-gold/40 bg-card px-4 text-xs font-semibold uppercase tracking-[0.18em] text-navy shadow-sm transition-colors hover:bg-gold/8"
            >
              {guestCopy.primaryCta}
            </Link>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className="public-safe-main relative mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-6 sm:px-6 lg:px-8"
      >
        <aside className="guest-schedule-intro">
          <p className="member-page-body">{guestCopy.scheduleHint}</p>
        </aside>
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
  const yogaPromo = useYogaPromo({ autoClaim: Boolean(session) });
  useDocumentTitle("page.schedule.title");
  const fetchSchedule = useServerFn(listAvailableClasses);
  const resolvedViewerCacheKey = viewerCacheKey ?? getViewerCacheKey(session);
  const initialSelectedClassId =
    selectedClassId === undefined && typeof window !== "undefined"
      ? readMemberScheduleClassId(window.location.href)
      : null;
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: getMemberScheduleQueryKey(resolvedViewerCacheKey),
    queryFn: () => withDeadline(fetchSchedule({ data: { days: 14 } }), 12_000),
    retry: 1,
  });

  const [uncontrolledOpenClass, setUncontrolledOpenClass] = useState<string | null>(
    initialSelectedClassId,
  );
  const openClass = selectedClassId === undefined ? uncontrolledOpenClass : selectedClassId;
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

  return (
    <>
      <MemberScheduleView
        data={data}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        session={Boolean(session)}
        openClass={openClass}
        setOpenClass={setOpenClass}
        promotion={
          yogaPromo.data?.active || yogaPromo.data?.claimedByCurrentUser ? (
            <YogaPromoBanner
              status={yogaPromo.data}
              publicAudience={!session}
              claimPending={yogaPromo.claim.isPending}
              onClaim={session ? () => yogaPromo.claim.mutate() : undefined}
            />
          ) : null
        }
      />
      <ClassDetailSheet
        classId={openClass}
        open={!!openClass}
        onOpenChange={(v) => !v && setOpenClass(null)}
        viewerContext={session ? "member" : "guest"}
        viewerCacheKey={resolvedViewerCacheKey}
      />
    </>
  );
}
