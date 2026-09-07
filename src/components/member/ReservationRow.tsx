import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { StudioClassItem, type StudioClass } from "./StudioClassItem";
import type { ClassState } from "./PremiumClassCard";
import { t } from "@/lib/i18n";

/** Presentation only: booking, waitlist and calendar callbacks remain with the route. */
export function ReservationRow({
  cls,
  state,
  statusLabel,
  onOpen,
  children,
  muted,
}: {
  cls: StudioClass;
  state: ClassState;
  statusLabel: string;
  onOpen: () => void;
  children?: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="aura-reservation" data-history={muted || undefined}>
      <StudioClassItem
        cls={cls}
        state={state}
        statusLabel={statusLabel}
        action={
          <button type="button" className="btn-outline" onClick={onOpen}>
            {t("member.viewClass")} <ArrowUpRight size={16} aria-hidden="true" />
          </button>
        }
        note={children ? <div className="aura-reservation-utilities">{children}</div> : undefined}
      />
    </div>
  );
}
