import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Clock,
  MapPin,
  Sparkles,
  Users,
  UserPlus,
  Wallet,
  ChevronRight,
} from "lucide-react";
import { studioPulse } from "@/lib/admin.functions";
import { ClassRosterDrawer } from "@/components/admin/ClassRosterDrawer";
import { getLocale, t, useI18n } from "@/lib/i18n";
import { localizedClassTitle, localizedInstructorName } from "@/lib/localized-content";
import { AdminToolbar, Empty, AdminPageHeader } from "@/components/admin-shared";

type Scope = "next" | "today" | "tomorrow" | "all";

function initials(name?: string) {
  return (
    (name ?? "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function localizedRoomName(name: string | null | undefined, lang: string) {
  if (!name) return "—";
  const normalized = name.trim();
  const aliases: Record<string, Record<string, string>> = {
    "Cloud Studio": { en: "Cloud Studio", he: "סטודיו קלאוד", ar: "استوديو كلاود" },
    "E2E Studio": { en: "E2E Studio", he: "סטודיו E2E", ar: "استوديو E2E" },
  };
  return aliases[normalized]?.[lang] ?? normalized;
}

export function StudioPulse({
  heading,
  subheading,
  mineOnly = false,
  showHeader = true,
}: {
  heading?: string;
  subheading?: string;
  mineOnly?: boolean;
  showHeader?: boolean;
}) {
  useI18n();
  const fn = useServerFn(studioPulse);
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["studio-pulse", { mineOnly }],
    queryFn: () => fn({ data: { hoursAhead: 72, mineOnly } }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });

  const [scope, setScope] = useState<Scope>("next");
  const [openClassId, setOpenClassId] = useState<string | null>(null);

  const classes = useMemo(() => (data?.classes ?? []) as any[], [data?.classes]);
  const filtered = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(tomorrow.getDate() + 1);
    return classes.filter((c) => {
      const d = new Date(c.starts_at);
      if (scope === "next") return d.getTime() >= now.getTime() - 30 * 60_000;
      if (scope === "today") return d >= today && d < tomorrow;
      if (scope === "tomorrow") return d >= tomorrow && d < dayAfter;
      return true;
    });
  }, [classes, scope]);

  const updatedLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString(getLocale(), {
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

  return (
    <section className="space-y-6 pb-12">
      {showHeader && (
        <AdminPageHeader
          eyebrow={t("pulse.live")}
          title={heading ?? t("pulse.heading")}
          description={subheading}
          action={
            <div className="flex items-center gap-2 text-xs font-medium text-slate">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-gold opacity-60 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
              </span>
              {t("pulse.updated", { time: updatedLabel })}
            </div>
          }
        />
      )}

      <AdminToolbar className="overflow-x-auto">
        {(
          [
            { k: "next", label: t("pulse.nextUp") },
            { k: "today", label: t("pulse.today") },
            { k: "tomorrow", label: t("pulse.tomorrow") },
            { k: "all", label: t("pulse.all72") },
          ] as const
        ).map((s) => (
          <button
            key={s.k}
            onClick={() => setScope(s.k as Scope)}
            className={
              scope === s.k
                ? "px-3 py-1.5 border border-navy bg-navy text-ivory rounded-full text-xs font-medium"
                : "px-3 py-1.5 border border-gold/40 text-navy rounded-full text-xs font-medium hover:bg-gold/8"
            }
          >
            {s.label}
          </button>
        ))}
      </AdminToolbar>

      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton-brand h-56 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <Empty>
          <Activity className="h-6 w-6 text-gold/70 mx-auto mb-3" />
          <span className="block font-semibold text-navy">{t("pulse.emptyTitle")}</span>
          <span className="mt-2 block">{t("pulse.emptyBody")}</span>
        </Empty>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map((c) => (
            <PulseClassCard key={c.id} c={c} onOpen={() => setOpenClassId(c.id)} />
          ))}
        </div>
      )}

      <ClassRosterDrawer classId={openClassId} onClose={() => setOpenClassId(null)} />
    </section>
  );
}

function PulseClassCard({ c, onOpen }: { c: any; onOpen: () => void }) {
  const { lang } = useI18n();
  const start = new Date(c.starts_at);
  const cap = Math.max(c.capacity ?? 0, 1);
  const booked = c.booked_count ?? 0;
  const pct = Math.min(100, Math.round((booked / cap) * 100));
  const full = booked >= cap;
  const summary = c.roster_summary ?? { booked: 0, first_timers: 0, care_flags: 0, low_credits: 0 };
  const preview: any[] = c.roster_preview ?? [];
  const title = localizedClassTitle(c, lang);
  const instructor = c.instructor?.name
    ? localizedInstructorName(c.instructor.name, lang)
    : t("common.unassigned");
  const room = localizedRoomName(c.room_ref?.name ?? c.room, lang);

  const tone =
    c.status === "cancelled"
      ? "border-s-slate/40 opacity-70"
      : full
        ? "border-s-navy"
        : pct >= 80
          ? "border-s-gold"
          : "border-s-powder";

  return (
    <article className={`editorial-card p-5 border-s-4 ${tone} flex flex-col gap-4`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate">
            {start.toLocaleDateString(getLocale(), {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
            {" · "}
            {start.toLocaleTimeString(getLocale(), { hour: "numeric", minute: "2-digit" })}
            {" · "}
            {c.duration_minutes}
            {t("common.minutes")}
          </p>
          <h3 className="font-display text-2xl text-navy mt-1 leading-tight truncate">{title}</h3>
          <p className="text-xs text-slate mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3 text-gold" />
              {room}
            </span>
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-gold" />
              {instructor}
            </span>
            <span className="inline-flex items-center gap-1">
              <Wallet className="h-3 w-3 text-gold" />
              {c.credit_cost} {t("common.credit")}
            </span>
          </p>
        </div>
        <button
          onClick={onOpen}
          aria-label={t("pulse.openRoster")}
          className="btn-outline shrink-0 inline-flex h-9 items-center gap-1 px-3 text-xs hover:btn-outline-hover"
        >
          {t("pulse.roster")} <ChevronRight className="h-3 w-3 directional-icon-forward" />
        </button>
      </header>

      {/* Capacity */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3 text-gold" /> {t("common.capacity")}
          </span>
          <span className="text-navy">
            {booked}/{cap}
            {full ? ` · ${t("common.full")}` : ""}
          </span>
        </div>
        <div className="h-1.5 bg-sand/60 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${full ? "bg-navy" : pct >= 80 ? "bg-gold" : "bg-powder"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {(c.waitlist_count ?? 0) > 0 && (
          <p className="mt-1.5 text-xs font-medium text-slate">
            {t("pulse.onWaitlist", { count: c.waitlist_count })}
          </p>
        )}
      </div>

      {/* Signals */}
      <div className="flex flex-wrap gap-1.5">
        {summary.first_timers > 0 && (
          <Signal
            icon={<UserPlus className="h-3 w-3" />}
            label={t("pulse.firstTime", { count: summary.first_timers })}
            tone="gold"
          />
        )}
        {summary.care_flags > 0 && (
          <Signal
            icon={<AlertTriangle className="h-3 w-3" />}
            label={t("pulse.care", { count: summary.care_flags })}
            tone="amber"
          />
        )}
        {summary.low_credits > 0 && (
          <Signal
            icon={<Wallet className="h-3 w-3" />}
            label={t("pulse.lowCredits", { count: summary.low_credits })}
            tone="powder"
          />
        )}
        {summary.booked === 0 && c.status === "scheduled" && (
          <Signal icon={<Clock className="h-3 w-3" />} label={t("pulse.noBookings")} tone="slate" />
        )}
        {c.status === "cancelled" && (
          <Signal
            icon={<AlertTriangle className="h-3 w-3" />}
            label={t("state.cancelled")}
            tone="slate"
          />
        )}
      </div>

      {/* Roster preview */}
      {preview.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-2 pt-3 border-t hairline">
          {preview.map((m) => (
            <li
              key={m.id}
              title={[
                m.name,
                m.is_first_timer ? t("pulse.firstTime", { count: 1 }) : null,
                m.has_care_notes ? t("roster.care") : null,
                m.low_credits ? t("state.low_credits") : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              className="inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-ivory px-2 py-1 text-xs font-medium text-navy"
            >
              <span className="relative inline-flex h-5 w-5 rounded-full bg-powder/60 items-center justify-center font-semibold text-navy">
                {initials(m.name)}
                {m.has_care_notes && (
                  <span className="absolute -top-0.5 -end-0.5 h-2 w-2 rounded-full bg-gold ring-1 ring-ivory" />
                )}
              </span>
              <span className="truncate max-w-[8rem]">{m.name?.split(" ")[0]}</span>
              {m.is_first_timer && <Sparkles className="h-2.5 w-2.5 text-gold" />}
            </li>
          ))}
          {summary.booked > preview.length && (
            <li className="text-xs font-medium text-slate">
              {t("pulse.more", { count: summary.booked - preview.length })}
            </li>
          )}
        </ul>
      ) : (
        <p className="border-t hairline pt-3 text-xs italic text-slate font-display">
          {t("pulse.waitingFirst")}
        </p>
      )}

      <footer className="flex items-center justify-between gap-3 pt-1">
        <Link
          to="/admin/classes/$id"
          params={{ id: c.id }}
          className="text-xs font-medium text-navy transition-colors hover:text-gold"
        >
          {t("pulse.classDetails")}
        </Link>
        <button
          onClick={onOpen}
          className="inline-flex items-center gap-1 text-xs font-medium text-navy hover:underline"
        >
          {t("pulse.openRoster")} <ArrowRight className="h-3 w-3 directional-icon-forward" />
        </button>
      </footer>
    </article>
  );
}

function Signal({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "gold" | "amber" | "powder" | "slate";
}) {
  const map = {
    gold: "border-gold/50 bg-gold/10 text-navy",
    amber: "border-gold bg-gold/15 text-navy",
    powder: "border-powder bg-powder/30 text-navy",
    slate: "border-slate/30 bg-slate/10 text-slate",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded-full text-xs font-medium ${map[tone]}`}
    >
      {icon}
      {label}
    </span>
  );
}
