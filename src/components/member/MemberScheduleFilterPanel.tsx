import { Search, SlidersHorizontal, Check } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
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
    <section
      dir={dir}
      className="member-schedule-filter-panel schedule-filter-refined"
      aria-label={t("nav.schedule")}
    >
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
      <Dialog>
        <div className="schedule-tools">
          <label className="schedule-tools-search">
            <Search size={18} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t("member.search")}
              aria-label={t("member.search")}
              dir="auto"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <DialogTrigger asChild>
            <button
              type="button"
              className="schedule-tools-trigger"
              aria-label={t("member.schedule.filter.title")}
            >
              <SlidersHorizontal size={18} aria-hidden="true" />
              <span>{lang === "he" ? "סינון" : lang === "ar" ? "تصفية" : "Filters"}</span>
              {activeFilterCount > 0 && (
                <span className="schedule-tools-count">{activeFilterCount}</span>
              )}
            </button>
          </DialogTrigger>
        </div>
        <DialogContent
          dir={dir}
          className="schedule-filter-dialog left-0 top-auto bottom-0 translate-x-0 translate-y-0 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2"
        >
          <header className="schedule-filter-dialog-heading">
            <DialogTitle>{t("member.schedule.filter.title")}</DialogTitle>
            <DialogDescription>
              {lang === "he"
                ? "התאימו את הלוח לתרגול שלכם."
                : lang === "ar"
                  ? "خصّصوا الجدول بما يناسب تمرينكم."
                  : "Find the classes that fit your practice."}
            </DialogDescription>
          </header>
          <div className="schedule-filter-dialog-options">
            {visibleFilters.map((group) => (
              <fieldset key={group.key} className="schedule-option-group">
                <legend>{group.label}</legend>
                <div className="schedule-option-list">
                  <button
                    type="button"
                    aria-pressed={!group.value}
                    onClick={() => onFilterChange(group.key, undefined)}
                  >
                    {!group.value && <Check size={14} aria-hidden="true" />}
                    {t("common.all")}
                  </button>
                  {group.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={group.value === option}
                      onClick={() =>
                        onFilterChange(group.key, group.value === option ? undefined : option)
                      }
                    >
                      {group.value === option && <Check size={14} aria-hidden="true" />}
                      <bdi>{group.formatOption ? group.formatOption(option) : option}</bdi>
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          <footer className="schedule-filter-dialog-footer">
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="schedule-tools-clear"
            >
              {t("member.schedule.filter.clear")}
            </button>
            <DialogClose asChild>
              <button type="button" className="schedule-filter-done">
                {lang === "he" ? "הצגת שיעורים" : lang === "ar" ? "عرض الدروس" : "Show classes"}
              </button>
            </DialogClose>
          </footer>
        </DialogContent>
      </Dialog>
      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="schedule-tools-clear schedule-tools-clear-inline"
        >
          {t("member.schedule.filter.clear")}
        </button>
      )}
    </section>
  );
}
