import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export type YogaPromoVisualState =
  | "loading"
  | "active"
  | "claimed"
  | "used"
  | "sold_out"
  | "ineligible"
  | "inactive";

export function YogaPromoPresentation({
  state,
  title,
  body,
  remaining,
  restriction,
  action,
  dir,
  className = "",
}: {
  state: YogaPromoVisualState;
  title: string;
  body: string;
  remaining?: string;
  restriction?: string;
  action?: ReactNode;
  dir: "ltr" | "rtl";
  className?: string;
}) {
  return (
    <aside
      dir={dir}
      className={`relative overflow-hidden rounded-[1.75rem] border border-[var(--cc-yoga-promo-border)]/55 bg-[var(--cc-yoga-promo-ink)] px-5 py-6 text-[var(--cc-yoga-promo-copy)] shadow-[0_22px_60px_var(--cc-alpha-yoga-promo-shadow)] sm:px-7 sm:py-7 ${className}`}
      aria-live="polite"
      data-promo-state={state}
      data-product-view={`yoga-promo-${state}`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_12%_15%,var(--cc-yoga-promo-gold-wash),transparent_25%),radial-gradient(circle_at_88%_82%,var(--cc-yoga-promo-copy-wash),transparent_30%)]" />
      <div className="relative grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[var(--cc-yoga-promo-gold-soft)]">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.24em]">
              Cloud &amp; Core
            </span>
          </div>
          <h2 className="font-display text-2xl leading-tight !text-[var(--cc-yoga-promo-copy)] sm:text-3xl">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--cc-yoga-promo-copy)]/82 sm:text-base">
            {body}
          </p>
          {remaining ? (
            <p
              className="mt-3 text-sm font-bold text-[var(--cc-yoga-promo-gold)]"
              data-testid="yoga-promo-remaining"
            >
              {remaining}
            </p>
          ) : null}
          {restriction ? (
            <p className="mt-2 text-xs text-[var(--cc-yoga-promo-copy)]/65">{restriction}</p>
          ) : null}
        </div>
        {action}
      </div>
    </aside>
  );
}
