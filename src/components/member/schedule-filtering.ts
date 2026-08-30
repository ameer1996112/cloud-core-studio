import type { DateScope } from "./MemberScheduleFilterPanel";
import { localizedClassTitle } from "../../lib/localized-content";

export type ScheduleFilterState = {
  level?: string;
  energy?: string;
  instructor?: string;
  room?: string;
};

export type FilterableScheduleClass = {
  starts_at: string;
  program_type?: { level?: string | null } | null;
  energy?: string | null;
  instructor?: { name?: string | null } | null;
  room_ref?: { name?: string | null } | null;
  room?: string | null;
  [key: string]: unknown;
};

export function filterScheduleClasses<T extends FilterableScheduleClass>(
  classes: readonly T[],
  input: {
    search: string;
    dateScope: DateScope;
    filter: ScheduleFilterState;
    now?: Date;
  },
): T[] {
  const now = new Date(input.now ?? new Date());
  now.setHours(0, 0, 0, 0);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);
  const normalizedSearch = input.search.trim().toLocaleLowerCase();

  return classes.filter((entry) => {
    const date = new Date(entry.starts_at);
    if (input.dateScope === "today" && (date < now || date >= tomorrow)) return false;
    if (input.dateScope === "tomorrow") {
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(tomorrow.getDate() + 1);
      if (date < tomorrow || date >= dayAfterTomorrow) return false;
    }
    if (input.dateScope === "week" && (date < now || date >= weekEnd)) return false;
    if (input.filter.level && entry.program_type?.level !== input.filter.level) return false;
    if (input.filter.energy && entry.energy !== input.filter.energy) return false;
    if (input.filter.instructor && entry.instructor?.name !== input.filter.instructor) return false;
    if (input.filter.room && (entry.room_ref?.name ?? entry.room) !== input.filter.room)
      return false;
    if (
      normalizedSearch &&
      !localizedClassTitle(entry).toLocaleLowerCase().includes(normalizedSearch)
    )
      return false;
    return true;
  });
}
