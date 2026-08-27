import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { MemberActionBar } from "@/components/member/MemberPage";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { t, type Lang } from "@/lib/i18n";
import {
  countActiveScheduleFilters,
  type DateScope,
  type ScheduleFilterState,
} from "@/lib/member-ui";

export type { DateScope } from "@/lib/member-ui";

type FilterGroup = {
  key: keyof ScheduleFilterState;
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
  onClearAll,
}: {
  dir: "rtl" | "ltr";
  lang: Lang;
  search: string;
  onSearchChange: (value: string) => void;
  dateScope: DateScope;
  onDateScopeChange: (value: DateScope) => void;
  filters: FilterGroup[];
  onFilterChange: (key: keyof ScheduleFilterState, value?: string) => void;
  onClearAll: () => void;
}) {
  const dateOptions: DateScope[] = ["today", "tomorrow", "week", "all"];
  const visibleFilters = filters.filter((group) => group.options.length > 0);
  const secondaryFilters = Object.fromEntries(
    filters.map((group) => [group.key, group.value]),
  ) as ScheduleFilterState;
  const activeFilterCount = countActiveScheduleFilters(search, dateScope, secondaryFilters);
  const hasActiveFilters = activeFilterCount > 0;

  const renderFilterGroups = (context: "desktop" | "sheet") => (
    <div
      className={`member-schedule-filter-groups member-schedule-filter-groups--${context}`}
      data-lang={lang}
    >
      {visibleFilters.map((group) => (
        <div key={`${context}-${group.key}`} className="member-schedule-filter-group">
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
  );

  return (
    <section dir={dir} className="member-schedule-filter-panel" aria-label={t("nav.schedule")}>
      <MemberActionBar>
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

          <div className="member-schedule-segmented" role="group" aria-label={t("nav.schedule")}>
            {dateOptions.map((scope) => (
              <button
                key={scope}
                type="button"
                aria-pressed={dateScope === scope}
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
        <Sheet>
          <SheetTrigger asChild>
            <button type="button" className="member-filter-trigger" aria-haspopup="dialog">
              <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
              <span>{t("member.schedule.filter.open")}</span>
              {activeFilterCount > 0 ? (
                <span className="member-filter-trigger__count">
                  {t("member.schedule.filter.count", { count: activeFilterCount })}
                </span>
              ) : null}
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" dir={dir} className="member-schedule-filter-sheet">
            <SheetHeader className="member-schedule-filter-sheet__header">
              <SheetTitle>{t("member.schedule.filter.title")}</SheetTitle>
              <SheetDescription>{t("member.schedule.filter.eyebrow")}</SheetDescription>
            </SheetHeader>
            {visibleFilters.length > 0 ? renderFilterGroups("sheet") : null}
            <SheetFooter className="member-schedule-filter-sheet__footer">
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={onClearAll}
                  className="member-schedule-filter-panel__reset"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>{t("member.schedule.filter.clear")}</span>
                </button>
              ) : null}
              <SheetClose asChild>
                <button type="button" className="member-schedule-filter-sheet__apply">
                  {t("member.schedule.filter.apply")}
                </button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </MemberActionBar>

      {visibleFilters.length > 0 || hasActiveFilters ? (
        <div className="member-schedule-secondary-filters--desktop">
          {visibleFilters.length > 0 ? renderFilterGroups("desktop") : null}
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={onClearAll}
              className="member-schedule-filter-panel__reset"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>{t("member.schedule.filter.clear")}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
