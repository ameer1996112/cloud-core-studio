import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Sparkles, Timer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { t, useI18n } from "@/lib/i18n";

const PROMO_START_AT = "2026-07-12T00:00:00+03:00";
const PROMO_END_AT = "2026-07-19T00:00:00+03:00";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getPromoTiming(now: Date | null) {
  const start = new Date(PROMO_START_AT).getTime();
  const end = new Date(PROMO_END_AT).getTime();
  const current = now?.getTime() ?? start;
  const remainingMs = end - current;
  const durationMs = end - start;
  const elapsedMs = current - start;
  const progress = durationMs > 0 ? clamp((elapsedMs / durationMs) * 100, 0, 100) : 0;

  return {
    active: remainingMs > 0,
    remainingMs,
    progress,
  };
}

function formatUrgency(remainingMs: number) {
  if (remainingMs <= 0) return t("promo.weekly.ended");
  const totalMinutes = Math.ceil(remainingMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return t("promo.weekly.countdownDays", { days, hours, minutes });
  if (hours > 0) return t("promo.weekly.countdownHours", { hours, minutes });
  return t("promo.weekly.countdownMinutes", { minutes });
}

export function WeeklyPromoBanner({
  className = "",
  onThisWeekClick,
}: {
  className?: string;
  onThisWeekClick?: () => void;
}) {
  const { dir } = useI18n();
  const [now, setNow] = useState<Date | null>(null);
  const timing = useMemo(() => getPromoTiming(now), [now]);
  const urgency = now ? formatUrgency(timing.remainingMs) : t("promo.weekly.urgencyFallback");

  useEffect(() => {
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  if (now && !timing.active) return null;

  const cta = (
    <>
      <CalendarDays className="h-4 w-4" aria-hidden="true" />
      <span>{t("promo.weekly.cta")}</span>
      <ArrowRight className="h-3.5 w-3.5 directional-icon-forward" aria-hidden="true" />
    </>
  );

  return (
    <article dir={dir} className={`weekly-promo-card ${className}`.trim()}>
      <div className="weekly-promo-topline">
        <div className="weekly-promo-ribbon">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t("promo.weekly.kicker")}</span>
        </div>
        <div className="weekly-promo-countdown" aria-live="polite">
          <Timer className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{urgency}</span>
        </div>
      </div>

      <div className="weekly-promo-content">
        <div className="weekly-promo-discount" aria-label={t("promo.weekly.discountLabel")}>
          <span className="weekly-promo-number">50%</span>
          <span className="weekly-promo-off">{t("promo.weekly.off")}</span>
        </div>

        <div className="weekly-promo-copy">
          <h2>{t("promo.weekly.title")}</h2>
          <p>{t("promo.weekly.body")}</p>
          <div className="weekly-promo-proof-row" aria-label={t("promo.weekly.urgencyLabel")}>
            <span>{t("promo.weekly.spots")}</span>
          </div>
        </div>

        <div className="weekly-promo-action">
          {onThisWeekClick ? (
            <button type="button" className="weekly-promo-cta" onClick={onThisWeekClick}>
              {cta}
            </button>
          ) : (
            <Link to="/member/schedule" className="weekly-promo-cta">
              {cta}
            </Link>
          )}
        </div>
      </div>

      <div className="weekly-promo-meter" aria-hidden="true">
        <span style={{ width: `${timing.progress}%` }} />
      </div>
    </article>
  );
}
