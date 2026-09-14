import { t } from "@/lib/i18n";

/** Informational only: callers retain the existing eligibility and payment flows. */
export function PackageBookingGuide({ compact = false }: { compact?: boolean }) {
  if (compact)
    return (
      <div className="package-booking-guide package-booking-guide--compact">
        <p className="package-booking-title">{t("member.packageGuide.compactTitle")}</p>
        <details className="package-booking-details">
          <summary>{t("member.packageGuide.helpLabel")}</summary>
          <p>{t("member.packageGuide.body")}</p>
          <p>{t("member.packageGuide.paid")}</p>
        </details>
      </div>
    );
  return (
    <div className="package-booking-guide">
      <p className="package-booking-kicker">{t("member.packageGuide.eyebrow")}</p>
      <p className="package-booking-title">{t("member.packageGuide.title")}</p>
      <p className="package-booking-copy">{t("member.packageGuide.body")}</p>
      <p className="package-booking-help">{t("member.packageGuide.paid")}</p>
    </div>
  );
}
