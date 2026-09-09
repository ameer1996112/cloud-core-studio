import { ChevronLeft, ChevronRight } from "lucide-react";
import { t, useI18n } from "@/lib/i18n";
import { studioDateKey } from "@/lib/member-schedule-date";
import { STUDIO_TIMEZONE } from "@/lib/studio-time";

export function ScheduleDateStrip({
  offset,
  selected,
  onOffsetChange,
  onSelect,
}: {
  offset: number;
  selected: string | null;
  onOffsetChange: (value: number) => void;
  onSelect: (value: string | null) => void;
}) {
  const { locale } = useI18n();
  const today = studioDateKey(new Date());
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset * 7 + index);
    return date;
  });
  const moveWeek = (value: number) => {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + value * 7);
    onOffsetChange(value);
    onSelect(studioDateKey(date));
  };
  const format = (date: Date, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { timeZone: STUDIO_TIMEZONE, ...options }).format(date);
  return (
    <div className="schedule-date-strip">
      <div className="schedule-month-navigation">
        <button
          type="button"
          onClick={() => moveWeek(offset - 1)}
          aria-label={t("common.previousWeek")}
        >
          <ChevronLeft className="directional-icon-back" size={19} aria-hidden="true" />
        </button>
        <p aria-live="polite">{format(days[0], { month: "long", year: "numeric" })}</p>
        <button
          type="button"
          onClick={() => moveWeek(offset + 1)}
          aria-label={t("common.nextWeek")}
        >
          <ChevronRight className="directional-icon-forward" size={19} aria-hidden="true" />
        </button>
      </div>
      <div className="schedule-date-days" role="group" aria-label={t("nav.schedule")}>
        {days.map((date) => {
          const key = studioDateKey(date);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected === key}
              aria-label={format(date, { weekday: "long", month: "long", day: "numeric" })}
              data-today={key === today || undefined}
              onClick={() => onSelect(selected === key ? null : key)}
            >
              <span>{format(date, { weekday: "short" })}</span>
              <strong>{format(date, { day: "numeric" })}</strong>
            </button>
          );
        })}
      </div>
      {selected && (
        <button type="button" className="schedule-clear-date" onClick={() => onSelect(null)}>
          {t("common.all")}
        </button>
      )}
    </div>
  );
}
