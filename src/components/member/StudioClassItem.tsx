import type { ReactNode } from "react";
import { UserRound, MapPin, Clock3 } from "lucide-react";
import "./design/reference-system.css";
import {
  StateBadge,
  type ClassState,
  type PremiumClassCardClass,
  formatDurationLabel,
} from "./PremiumClassCard";
import { localizedClassTitle, localizedOptionalInstructorName } from "@/lib/localized-content";
import { t, useI18n } from "@/lib/i18n";
import { STUDIO_TIMEZONE } from "@/lib/studio-time";
import { resolveClassImagePosition, resolveClassImageSrc } from "@/lib/image-assets";

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
  guidance?: ReactNode;
  metadata?: ReactNode;
  showDate?: boolean;
  statusLabel?: string;
  thumbnail?: boolean;
  showRoom?: boolean;
  showStatus?: boolean;
  inlineStatus?: boolean;
  compact?: boolean;
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
  guidance,
  metadata,
  showDate = true,
  statusLabel,
  thumbnail = false,
  showRoom = true,
  showStatus = true,
  compact = false,
}: ClassPresentationProps & {
  variant?: "featured" | "row";
  imageSrc?: string;
}) {
  const { locale, dir } = useI18n();
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
    <article
      className={`ref-session ref-session--${variant}${compact ? " ref-session--compact" : ""}`}
      dir={dir}
    >
      {(thumbnail || featured) && (
        <img
          className="ref-session-photo"
          src={imageSrc || resolveClassImageSrc(cls, "thumb")}
          style={{ objectPosition: imageSrc ? "center" : resolveClassImagePosition(cls, "thumb") }}
          alt=""
          width={112}
          height={140}
          loading={featured ? "eager" : "lazy"}
        />
      )}
      <div className="ref-session-body">
        <div className="ref-session-datetime">
          <time dateTime={cls.starts_at}>
            <bdi>{time}</bdi>
          </time>
          {showDate && (
            <span>
              <bdi>{day}</bdi>
            </span>
          )}
        </div>
        <h3>
          <bdi>{localizedClassTitle(cls)}</bdi>
        </h3>
        <div className="ref-session-meta">
          {instructor && (
            <span>
              <UserRound size={13} aria-hidden="true" />
              <bdi>{instructor}</bdi>
            </span>
          )}
          {showRoom && room && (
            <span>
              <MapPin size={13} aria-hidden="true" />
              <bdi>{room}</bdi>
            </span>
          )}
          <span>
            <Clock3 size={13} aria-hidden="true" />
            {formatDurationLabel(cls.duration_minutes)}
          </span>
          {cls.credit_cost != null && (
            <span>
              {cls.credit_cost === 1
                ? t("member.oneCredit")
                : t("common.classCreditValue", { count: cls.credit_cost })}
            </span>
          )}
        </div>
        {metadata && <div className="ref-session-metadata">{metadata}</div>}
        <div className="ref-session-footer">
          {showStatus && (
            <div className="ref-session-status">
              {statusLabel ? <span>{statusLabel}</span> : <StateBadge state={state} />}
            </div>
          )}
          <div className="ref-session-actions">
            {action}
            {secondaryAction}
          </div>
        </div>
      </div>
      {guidance && <div className="ref-session-guidance">{guidance}</div>}
      {note && <div className="ref-session-note">{note}</div>}
    </article>
  );
}

export function BookingPass(props: ClassPresentationProps) {
  return <StudioClassItem {...props} variant="featured" />;
}
