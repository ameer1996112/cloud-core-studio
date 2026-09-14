import type { ReactNode } from "react";
import { Clock3, UserRound, MapPin, UsersRound, Ticket } from "lucide-react";
import { t, useI18n } from "@/lib/i18n";
import { resolveClassImageSrc } from "@/lib/image-assets";
import {
  localizedClassTitle,
  localizedOptionalInstructorName,
  localizedProgramDescription,
  localizedClassMetadataChips,
} from "@/lib/localized-content";
import { formatDuration, getFriendlyStudioLocation } from "@/lib/lesson-card-variants";
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
  const facts = [
    { icon: Clock3, label: t("common.when"), value: `${formatTime(cls.starts_at)} · ${duration}` },
    ...(instructor ? [{ icon: UserRound, label: t("common.with"), value: instructor }] : []),
    { icon: MapPin, label: t("common.where"), value: getFriendlyStudioLocation(lang) },
    ...(cls.status === "scheduled" && cls.capacity != null && cls.booked_count != null
      ? [
          {
            icon: UsersRound,
            label: t("schedule.availability.label"),
            value: t(
              cls.capacity - cls.booked_count <= 0
                ? "state.full"
                : cls.capacity - cls.booked_count <= 2
                  ? "schedule.availability.few"
                  : "schedule.availability.open",
            ),
          },
        ]
      : []),
    guestNextStep
      ? { ...guestNextStep, icon: Ticket }
      : {
          icon: Ticket,
          label: t("common.credits"),
          value:
            cls.credit_cost === 1
              ? t("member.oneCredit")
              : `${cls.credit_cost} ${t("common.credits")}`,
        },
  ];
  return (
    <>
      <div className="ref-detail-hero">
        <img
          src={resolveClassImageSrc(cls, "hero")}
          alt=""
          width={1440}
          height={960}
          decoding="async"
        />
        <div className="ref-detail-heading">
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
      <div className="ref-detail-reading">
        <dl className="ref-detail-facts">
          {facts.map((f) => (
            <div key={f.label}>
              <dt>
                <f.icon size={18} strokeWidth={1.5} aria-hidden="true" />
                {f.label}
              </dt>
              <dd>
                <bdi>
                  {f.value.split(/(Cloud & Core)/).map((part, index) =>
                    part === "Cloud & Core" ? (
                      <bdi key={index} dir="ltr" className="detail-brand-name">
                        {part}
                      </bdi>
                    ) : (
                      part
                    ),
                  )}
                </bdi>
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
          <p className="ref-detail-description" dir="auto">
            {description}
          </p>
        )}
        {promotion}
        <section className="ref-detail-notes">
          <h3>{t("booking.notes")}</h3>
          <p>{t("booking.cancelWindow", { hours: cls.cancellation_window_hours })}</p>
          <p>{t("booking.bring")}</p>
        </section>
      </div>
      <div className="ref-detail-cta ref-detail-footer">{action}</div>
    </>
  );
}
