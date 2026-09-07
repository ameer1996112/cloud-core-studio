import { t, useI18n } from "@/lib/i18n";

/** No fabricated balances or editable blank profile while the member query is unavailable. */
export function MemberPageState({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: boolean;
  onRetry: () => void;
}) {
  const { dir } = useI18n();
  return (
    <section dir={dir} className="member-page aura-member-page">
      <header className="aura-page-heading">
        <h1>{title}</h1>
      </header>
      {error ? (
        <div role="alert" className="aura-settings-section space-y-4">
          <h2>{t("page.error.eyebrow")}</h2>
          <p>{t("page.error.body")}</p>
          <button type="button" className="btn-outline" onClick={onRetry}>
            {t("common.retry")}
          </button>
        </div>
      ) : (
        <div role="status" aria-busy="true" className="space-y-4">
          <p>{t("common.loading")}</p>
          <div className="h-48 rounded-3xl skeleton-brand" aria-hidden="true" />
        </div>
      )}
    </section>
  );
}
