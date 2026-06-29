import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { t, type Lang } from "@/lib/i18n";

export type DateScope = "today" | "tomorrow" | "week" | "all";

type FilterState = {
  level?: string;
  energy?: string;
  instructor?: string;
  room?: string;
};

type FilterGroup = {
  key: keyof FilterState;
  label: string;
  options: string[];
  value?: string;
  formatOption?: (value: string) => string;
};

export function MemberScheduleFilterPanel({
  dir,
  lang,
  search,
  onSearchChange,
  dateScope,
  onDateScopeChange,
  filters,
  onFilterChange,
}: {
  dir: "rtl" | "ltr";
  lang: Lang;
  search: string;
  onSearchChange: (value: string) => void;
  dateScope: DateScope;
  onDateScopeChange: (value: DateScope) => void;
  filters: FilterGroup[];
  onFilterChange: (key: keyof FilterState, value?: string) => void;
}) {
  const dateOptions: DateScope[] = ["today", "tomorrow", "week", "all"];
  const visibleFilters = filters.filter((group) => group.options.length > 0);
  const activeFilterCount = filters.reduce((count, group) => count + (group.value ? 1 : 0), 0);
  const hasActiveFilters = Boolean(search.trim()) || dateScope !== "all" || activeFilterCount > 0;

  const clearFilters = () => {
    onSearchChange("");
    onDateScopeChange("all");
    filters.forEach((group) => {
      if (group.value) onFilterChange(group.key, undefined);
    });
  };

  return (
    <section dir={dir} className="member-schedule-filter-panel" aria-label={t("nav.schedule")}>
      <div className="member-schedule-filter-panel__header">
        <div className="member-schedule-filter-panel__title-wrap">
          <span className="member-schedule-filter-panel__mark" aria-hidden="true">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <div>
            <p className="member-schedule-filter-panel__eyebrow">
              {t("member.schedule.filter.eyebrow")}
            </p>
            <h2 className="member-schedule-filter-panel__title">
              {t("member.schedule.filter.title")}
            </h2>
          </div>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="member-schedule-filter-panel__reset"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t("member.schedule.filter.clear")}</span>
          </button>
        )}
      </div>

      <div className="member-schedule-filter-panel__primary">
        <div className="member-schedule-search-field">
          <span className="member-schedule-search-field__icon" aria-hidden="true">
            <Search className="h-4 w-4" />
          </span>
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("member.search")}
            aria-label={t("member.search")}
            dir="auto"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="member-schedule-search-field__input"
          />
        </div>

        <div className="member-schedule-segmented" role="tablist" aria-label={t("nav.schedule")}>
          {dateOptions.map((scope) => (
            <button
              key={scope}
              type="button"
              role="tab"
              aria-selected={dateScope === scope}
              onClick={() => onDateScopeChange(scope)}
              className={
                dateScope === scope
                  ? "member-schedule-segment member-schedule-segment-active"
                  : "member-schedule-segment"
              }
            >
              {scope === "week"
                ? t("common.thisWeek")
                : scope === "today"
                  ? t("common.today")
                  : scope === "tomorrow"
                    ? t("common.tomorrow")
                    : t("common.all")}
            </button>
          ))}
        </div>
      </div>

      {visibleFilters.length > 0 && (
        <div className="member-schedule-filter-groups" data-lang={lang}>
          {visibleFilters.map((group) => (
            <div key={group.key} className="member-schedule-filter-group">
              <span className="member-schedule-filter-label">
                <span aria-hidden="true" />
                <span>{group.label}</span>
              </span>
              <div className="member-schedule-filter-chip-row">
                {group.options.map((option) => {
                  const selected = group.value === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onFilterChange(group.key, selected ? undefined : option)}
                      className={
                        selected
                          ? "member-schedule-filter-chip member-schedule-filter-chip-active"
                          : "member-schedule-filter-chip"
                      }
                      dir="auto"
                    >
                      <bdi>{group.formatOption ? group.formatOption(option) : option}</bdi>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
