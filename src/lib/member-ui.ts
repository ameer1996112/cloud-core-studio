export type DateScope = "today" | "tomorrow" | "week" | "all";

export type ScheduleFilterState = {
  level?: string;
  energy?: string;
  instructor?: string;
  room?: string;
};

export function countActiveScheduleFilters(
  search: string,
  dateScope: DateScope,
  filters: ScheduleFilterState,
) {
  return (
    (search.trim() ? 1 : 0) +
    (dateScope === "all" ? 0 : 1) +
    Object.values(filters).filter(Boolean).length
  );
}

export function getScheduleEmptyStateKind(
  totalClassCount: number,
  filteredClassCount: number,
  activeFilterCount: number,
): "inventory" | "filtered" | null {
  if (filteredClassCount > 0) return null;
  if (totalClassCount === 0) return "inventory";
  return activeFilterCount > 0 ? "filtered" : "inventory";
}
