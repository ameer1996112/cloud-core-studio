import { CalendarPlus, PartyPopper } from "lucide-react";
import { ReviewButton } from "./design/VisualSystem";
import { formatDate, formatTime, type PremiumClassCardClass } from "./PremiumClassCard";
import { localizedClassTitle } from "@/lib/localized-content";
import { t } from "@/lib/i18n";

/** Presentation only. Booking, calendar generation and navigation remain caller-owned. */
export function BookingConfirmationContent({
  cls,
  confirmation,
  onAddCalendar,
  onDone,
}: {
  cls: PremiumClassCardClass;
  confirmation: { bookingId: string; remaining: number };
  onAddCalendar: () => void;
  onDone: () => void;
}) {
  return (
    <div className="ref-confirmation">
      <PartyPopper
        className="ref-confirmation-icon"
        size={56}
        strokeWidth={1.3}
        aria-hidden="true"
      />
      <h2 role="status">{t("booking.saved")}</h2>
      <h3>
        <bdi>{localizedClassTitle(cls)}</bdi>
      </h3>
      <p>
        <bdi>{formatDate(cls.starts_at)}</bdi>
      </p>
      <p className="ref-confirmation-time">
        <bdi>{formatTime(cls.starts_at)}</bdi> ·{" "}
        {t("member.durationMinutes", { count: cls.duration_minutes })}
      </p>
      <p>{t("member.locationStudio")}</p>
      <div className="ref-confirmation-receipt">
        <span>
          {t("common.code")} <bdi>{confirmation.bookingId.slice(0, 6).toUpperCase()}</bdi>
        </span>
        <span>{t("booking.left", { count: confirmation.remaining })}</span>
      </div>
      <p className="ref-confirmation-policy">
        {t("booking.cancelWindow", { hours: cls.cancellation_window_hours })}
      </p>
      <div className="ref-confirmation-actions">
        <ReviewButton onClick={onAddCalendar}>
          <CalendarPlus size={16} aria-hidden="true" />
          {t("member.addCalendar")}
        </ReviewButton>
        <ReviewButton variant="secondary" onClick={onDone}>
          {t("booking.myBookings")}
        </ReviewButton>
      </div>
    </div>
  );
}
