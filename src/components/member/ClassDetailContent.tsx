import type { ReactNode } from "react";
import { t, useI18n } from "@/lib/i18n";
import { authImages } from "@/lib/auth-assets";
import {
  localizedClassTitle,
  localizedOptionalInstructorName,
  localizedProgramDescription,
  localizedClassMetadataChips,
} from "@/lib/localized-content";
import { formatDuration, formatSpots, getFriendlyStudioLocation } from "@/lib/lesson-card-variants";
import {
  StateBadge,
  formatDate,
  formatTime,
  type ClassState,
  type PremiumClassCardClass,
} from "./PremiumClassCard";

/** Presentation only. The existing detail controller owns eligibility and every mutation. */
export function ClassDetailContent({
  cls,
  state,
  action,
  promotion,
  guestNextStep,
}: {
  cls: PremiumClassCardClass;
  state: ClassState | null;
  action: ReactNode;
  promotion?: ReactNode;
  guestNextStep?: { label: string; value: string };
}) {
  const { lang } = useI18n();
  const instructor = localizedOptionalInstructorName(cls.instructor?.name);
  const description = localizedProgramDescription(cls.program_type);
  const duration = formatDuration(cls.duration_minutes, lang);
  const spots = formatSpots(
    Math.max(0, (cls.capacity ?? 0) - (cls.booked_count ?? 0)),
    cls.capacity ?? 0,
    lang,
  );
  const facts = [
    { label: t("common.when"), value: `${formatTime(cls.starts_at)} · ${duration}` },
    ...(instructor ? [{ label: t("common.with"), value: instructor }] : []),
    { label: t("common.where"), value: getFriendlyStudioLocation(lang) },
    { label: t("common.spots"), value: spots },
    guestNextStep ?? {
      label: t("common.credits"),
      value:
        cls.credit_cost === 1 ? t("member.oneCredit") : `${cls.credit_cost} ${t("common.credits")}`,
    },
  ];
  return (
    <>
      <div className="aura-detail-hero">
        <img src={authImages.hero.src} alt={authImages.hero.alt[lang]} width={853} height={1280} />
        <div className="aura-detail-heading">
          {state && <StateBadge state={state} />}
          <h2>
            <bdi>{localizedClassTitle(cls)}</bdi>
          </h2>
          <p>
            <bdi>{formatDate(cls.starts_at)}</bdi>
            <span aria-hidden="true"> · </span>
            <bdi>{formatTime(cls.starts_at)}</bdi>
          </p>
        </div>
      </div>
      <div className="aura-detail-reading">
        <dl className="aura-detail-facts">
          {facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>
                <bdi>{f.value}</bdi>
              </dd>
            </div>
          ))}
        </dl>
        <div className="studio-class-descriptors">
          {localizedClassMetadataChips(cls)
            .slice(0, 3)
            .map((chip) => (
              <span key={chip}>
                <bdi>{chip}</bdi>
              </span>
            ))}
        </div>
        {description && (
          <p className="aura-detail-description" dir="auto">
            {description}
          </p>
        )}
        {promotion}
        <section className="aura-detail-notes">
          <h3>{t("booking.notes")}</h3>
          <p>{t("booking.cancelWindow", { hours: cls.cancellation_window_hours })}</p>
          <p>{t("booking.bring")}</p>
        </section>
        <div className="lesson-detail__cta">{action}</div>
      </div>
    </>
  );
}
