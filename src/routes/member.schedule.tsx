import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listAvailableClasses } from "@/lib/member.functions";
import { deriveClassState } from "@/components/member/PremiumClassCard";
import { MemberScheduleView } from "@/components/member/MemberScheduleView";
import { GUEST_SCHEDULE_COPY, GUEST_SCHEDULE_STATS } from "@/components/member/guest-schedule-copy";
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
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-gold/40 bg-white px-4 text-xs font-semibold uppercase tracking-[0.18em] text-navy shadow-sm transition-colors hover:bg-gold/8"
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
        <section className="member-page-panel grid overflow-hidden lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <div className="member-page-copy p-5 sm:p-8 md:p-10">
            <p className="member-eyebrow">{guestCopy.eyebrow}</p>
            <h1 className="member-page-title mt-3">{guestCopy.title}</h1>
            <p className="member-page-body mt-3 max-w-2xl">{guestCopy.body}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to={authHref}
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
    queryFn: () => fetchSchedule({ data: { days: 14 } }),
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
