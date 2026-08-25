import { t } from "@/lib/i18n";

type MemberRoute = "home" | "schedule" | "bookings" | "packages" | "account";

const rowCount: Record<MemberRoute, number> = {
  home: 2,
  schedule: 4,
  bookings: 3,
  packages: 3,
  account: 4,
};

export function MemberRouteSkeleton({ route }: { route: MemberRoute }) {
  return (
    <div
      className={`member-route-skeleton member-route-skeleton--${route}`}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden="true" className="member-route-skeleton__intro skeleton-brand" />
      <div aria-hidden="true" className="member-route-skeleton__rows">
        {Array.from({ length: rowCount[route] }, (_, index) => (
          <div key={index} className="member-route-skeleton__row skeleton-brand" />
        ))}
      </div>
    </div>
  );
}

export function MemberRouteError({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="member-route-error" role="alert">
      <h2 className="member-section__title">{t("member.error.title")}</h2>
      <p>{t("member.error.body")}</p>
      <button type="button" className="btn-outline min-h-11" onClick={onRetry}>
        {t("common.retry")}
      </button>
    </section>
  );
}
