import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listAvailableClasses } from "@/lib/member.functions";
import { deriveClassState, MemberEmptyState } from "@/components/member/PremiumClassCard";
import { VisualClassCard, ScheduleDaySection } from "@/components/visual/VisualClassCard";
import { ClassDetailSheet } from "@/components/member/ClassDetailSheet";
import { AppShell } from "@/components/app-shell/AppShell";
import {
  MemberScheduleFilterPanel,
  type DateScope,
} from "@/components/member/MemberScheduleFilterPanel";
import { LANG_META, t, useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  localizedClassTitle,
  localizedFilterLabel,
  localizedInstructorName,
  localizedRoomName,
  localizedToneName,
} from "@/lib/localized-content";

export const Route = createFileRoute("/member/schedule")({
  component: MemberSchedulePublic,
});

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function MemberSchedulePublic() {
  const [session, setSession] = useState<any>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  if (session) {
    return (
      <AppShell role="member">
        <MemberScheduleContent session={session} />
      </AppShell>
    );
  }

  const signInLabel = {
    en: "Sign In",
    he: "התחברות",
    ar: "تسجيل الدخول",
  }[getLocaleFromCookie() || "he"];

  return (
    <div className="min-h-screen bg-ivory text-navy">
      <header className="sticky top-0 z-40 w-full border-b border-navy/8 bg-ivory/95 backdrop-blur-md px-5 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <Link to="/auth" className="brand-wordmark text-xl text-navy" dir="ltr">
            Cloud &amp; Core
          </Link>
          <Link
            to="/auth"
            className="inline-flex min-h-9 items-center justify-center rounded-full border border-gold/40 bg-white hover:bg-gold/8 px-4 text-xs font-semibold uppercase tracking-[0.18em] text-navy shadow-sm transition-colors"
          >
            {signInLabel}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <MemberScheduleContent session={null} />
      </main>
    </div>
  );
}

function getLocaleFromCookie() {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("cc_lang="));
  return match ? match.slice(8) : null;
}

function MemberScheduleContent({ session }: { session: any }) {
  const { lang, dir } = useI18n();
  useDocumentTitle("page.schedule.title");
  const fetchSchedule = useServerFn(listAvailableClasses);
  const { data, isLoading } = useQuery({
    queryKey: ["member-schedule"],
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
  const [openClass, setOpenClass] = useState<string | null>(null);

  const classes = useMemo(() => data?.classes ?? [], [data?.classes]);
  const member = data?.member;
  const booked = data?.bookingsByClass ?? {};
  const waiting = data?.waitlistByClass ?? {};

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

  const groups = new Map<string, any[]>();
  for (const c of filtered) {
    const key = startOfDay(new Date(c.starts_at)).toISOString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  return (
    <section dir={dir} className="member-page w-full space-y-6 pb-10">
      <div className="member-page-panel p-5 sm:p-8">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(220px,300px)] md:items-end">
          <div className="member-page-copy">
            <p className="member-eyebrow">{t("member.schedule.kicker")}</p>
            <h1 className="member-page-title mt-3">{t("nav.schedule")}</h1>
            <p className="member-page-body mt-3">{t("member.schedule.body")}</p>
          </div>
          <div className="member-stat-strip" dir={dir}>
            <StatCell label={t("member.stat.available")} value={filtered.length} />
            {session && (
              <StatCell label={t("member.stat.credits")} value={member?.remaining_credits ?? 0} />
            )}
          </div>
        </div>
      </div>

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
          title={classes.length === 0 ? t("member.empty.schedule.title") : t("member.noSessions")}
          body={classes.length === 0 ? t("member.empty.schedule.body") : t("member.clearFilters")}
          primaryAction={
            classes.length === 0 ? { label: t("legal.support"), to: "/support" } : undefined
          }
        />
      )}

      {!isLoading &&
        Array.from(groups.entries()).map(([key, items]) => (
          <ScheduleDaySection key={key} date={new Date(key)} count={items.length}>
            {items.map((c: any, index: number) => (
              <VisualClassCard
                key={c.id}
                cls={c}
                state={deriveClassState(c, {
                  booked: !!booked[c.id],
                  waiting: !!waiting[c.id],
                  remainingCredits: member?.remaining_credits ?? 0,
                  hasActivePackage: data?.hasActivePackage,
                })}
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
