import type { ReactNode } from "react";
import { UserRound } from "lucide-react";
import {
  StateBadge,
  type ClassState,
  type PremiumClassCardClass,
  formatDurationLabel,
} from "./PremiumClassCard";
import { localizedClassTitle, localizedOptionalInstructorName } from "@/lib/localized-content";
import { t, useI18n } from "@/lib/i18n";
import { STUDIO_TIMEZONE } from "@/lib/studio-time";
import { authImages } from "@/lib/auth-assets";

export type StudioClass = PremiumClassCardClass & {
  id: string;
  room?: string | null;
  room_ref?: { name?: string | null } | null;
};
type ClassPresentationProps = {
  cls: StudioClass;
  state: ClassState;
  timeZone?: string;
  action: ReactNode;
  secondaryAction?: ReactNode;
  note?: ReactNode;
  metadata?: ReactNode;
  showDate?: boolean;
  statusLabel?: string;
};

/** Shared SessionRow / BookingPass presentation. Callers own state and actions. */
export function StudioClassItem({
  cls,
  state,
  variant = "row",
  timeZone = STUDIO_TIMEZONE,
  action,
  secondaryAction,
  imageSrc,
  note,
  metadata,
  showDate = true,
  statusLabel,
}: ClassPresentationProps & {
  variant?: "featured" | "row";
  imageSrc?: string;
}) {
  const { locale, dir, lang } = useI18n();
  const date = new Date(cls.starts_at);
  const time = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const day = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
  const instructor = localizedOptionalInstructorName(cls.instructor?.name);
  const room = cls.room_ref?.name || cls.room;
  const featured = variant === "featured";
  return (
    <article className={`studio-class studio-class--${variant}`} dir={dir}>
      <div className={featured ? "studio-class-hero" : "studio-class-overview"}>
        {featured && imageSrc && (
          <div className="studio-class-media">
            <img
              className="studio-class-photo"
              src={imageSrc}
              alt={authImages.hero.alt[lang]}
              width={853}
              height={1280}
              loading="eager"
            />
          </div>
        )}
        <div className="studio-class-reading">
          <div className="studio-class-content">
            <h3>
              <bdi>{localizedClassTitle(cls)}</bdi>
            </h3>
            <p className="studio-class-meta">
              {instructor && (
                <span>
                  <UserRound size={16} strokeWidth={1.5} aria-hidden="true" />
                  <bdi>{instructor}</bdi>
                </span>
              )}
              {room && (
                <span>
                  <bdi>{room}</bdi>
                </span>
              )}
              {cls.credit_cost != null && (
                <span>
                  {cls.credit_cost === 1
                    ? t("member.oneCredit")
                    : t("admin.classes.creditValue", { count: cls.credit_cost })}
                </span>
              )}
            </p>
            {metadata && <div className="studio-class-descriptors">{metadata}</div>}
          </div>
          <div className="studio-class-time">
            <time dateTime={cls.starts_at}>
              <bdi>{time}</bdi>
            </time>
            {showDate && (
              <span>
                <bdi>{day}</bdi>
              </span>
            )}
            <span>{formatDurationLabel(cls.duration_minutes)}</span>
          </div>
          <div className="studio-class-status">
            {statusLabel ? <span>{statusLabel}</span> : <StateBadge state={state} />}
          </div>
        </div>
        {featured && (
          <div className="studio-class-actions">
            {action}
            {secondaryAction}
          </div>
        )}
      </div>
      {!featured && (
        <div className="studio-class-actions">
          {action}
          {secondaryAction}
        </div>
      )}
      {note && <div className="studio-class-note">{note}</div>}
    </article>
  );
}

export function BookingPass(props: ClassPresentationProps) {
  return <StudioClassItem {...props} variant="featured" imageSrc={authImages.hero.src} />;
}
