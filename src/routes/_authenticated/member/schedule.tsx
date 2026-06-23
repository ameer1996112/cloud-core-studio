import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { listAvailableClasses } from "@/lib/member.functions";
import { deriveClassState } from "@/components/member/PremiumClassCard";
import { VisualClassCard, ScheduleDaySection } from "@/components/visual/VisualClassCard";
import { ClassDetailSheet } from "@/components/member/ClassDetailSheet";
import { t, useI18n } from "@/lib/i18n";
import { localizedClassTitle, localizedInstructorName } from "@/lib/localized-content";

export const Route = createFileRoute("/_authenticated/member/schedule")({
  head: () => ({ meta: [{ title: "לוח שיעורים — Cloud & Core" }] }),
  component: MemberSchedule,
});

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function MemberSchedule() {
  useI18n();
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
  const [dateScope, setDateScope] = useState<"today" | "tomorrow" | "week" | "all">("all");
  const [openClass, setOpenClass] = useState<string | null>(null);

  // Hide internal E2E seed classes/instructors from the user-facing UI.
  const classes = (data?.classes ?? []).filter(
    (c: any) => !/^E2E\s/i.test(c.title ?? "") && !/^E2E\s/i.test(c.instructor?.name ?? ""),
  );
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

  // Group by date
  const groups = new Map<string, any[]>();
  for (const c of filtered) {
    const key = startOfDay(new Date(c.starts_at)).toISOString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  return (
    <section className="space-y-6 pb-10 max-w-4xl mx-auto">
      {/* Search */}
      <div className="relative">
        <Search className="h-4 w-4 text-slate absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("member.search")}
          className="editorial-input pl-10"
        />
      </div>

      {/* Date scope */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["today", "tomorrow", "week", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setDateScope(s)}
            className={
              dateScope === s
                ? "pill-toggle pill-toggle-active capitalize"
                : "pill-toggle capitalize"
            }
          >
            {s === "week"
              ? t("common.thisWeek")
              : s === "today"
                ? t("common.today")
                : s === "tomorrow"
                  ? t("common.tomorrow")
                  : t("common.all")}
          </button>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <FilterGroup
          label={t("member.filter.level")}
          options={levels}
          value={filter.level}
          onChange={(v) => setFilter({ ...filter, level: v })}
        />
        <FilterGroup
          label={t("member.filter.energy")}
          options={energies}
          value={filter.energy}
          onChange={(v) => setFilter({ ...filter, energy: v })}
        />
        <FilterGroup
          label={t("common.room")}
          options={rooms}
          value={filter.room}
          onChange={(v) => setFilter({ ...filter, room: v })}
        />
        <FilterGroup
          label={t("common.with")}
          options={instructors}
          formatOption={(o) => localizedInstructorName(o)}
          value={filter.instructor}
          onChange={(v) => setFilter({ ...filter, instructor: v })}
        />
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[148px] skeleton-brand rounded-[22px]" />
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="member-card p-8 text-center">
          <p className="font-display text-xl text-navy">{t("member.noSessions")}</p>
          <p className="text-sm text-slate mt-2">{t("member.clearFilters")}</p>
        </div>
      )}

      {!isLoading &&
        Array.from(groups.entries()).map(([key, items]) => (
          <ScheduleDaySection key={key} date={new Date(key)}>
            {items.map((c: any) => (
              <VisualClassCard
                key={c.id}
                cls={c}
                state={deriveClassState(c, {
                  booked: !!booked[c.id],
                  waiting: !!waiting[c.id],
                  remainingCredits: member?.remaining_credits ?? 0,
                })}
                onOpen={() => setOpenClass(c.id)}
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

function FilterGroup({
  label,
  options,
  value,
  onChange,
  formatOption,
}: {
  label: string;
  options: any[];
  value?: string;
  onChange: (v?: string) => void;
  formatOption?: (value: string) => string;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <span className="text-[10px] uppercase tracking-[0.2em] text-slate mr-1">{label}</span>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(value === o ? undefined : o)}
          className={
            value === o ? "pill-toggle pill-toggle-active capitalize" : "pill-toggle capitalize"
          }
        >
          {formatOption ? formatOption(o) : o}
        </button>
      ))}
    </div>
  );
}
