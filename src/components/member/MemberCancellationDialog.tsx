import { useRef } from "react";
import { BookingActionPanel } from "@/components/member/BookingActionPanel";
import { BidiValue } from "@/components/ui/bidi";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { BookingViewState } from "@/lib/booking-view-state";

export type MemberCancellationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dir: "ltr" | "rtl";
  title: string;
  description: string;
  classTitle: string;
  formattedDate: string;
  formattedTime: string;
  state: BookingViewState;
  keepLabel: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onRetry?: () => void;
};

export function MemberCancellationDialog({
  open,
  onOpenChange,
  dir,
  title,
  description,
  classTitle,
  formattedDate,
  formattedTime,
  state,
  keepLabel,
  confirmLabel,
  pending,
  onConfirm,
  onRetry,
}: MemberCancellationDialogProps) {
  const keepButtonRef = useRef<HTMLButtonElement | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir={dir}
        className="max-w-md bg-ivory border-gold/30"
        data-product-view="member-cancellation-dialog"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          keepButtonRef.current?.focus();
        }}
      >
        <DialogTitle className="font-display text-2xl text-navy">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <div className="space-y-4">
          <div className="member-card p-4">
            <p className="font-display text-lg text-navy">{classTitle}</p>
            <p className="text-xs text-slate mt-1">
              <BidiValue kind="localized-date">{formattedDate}</BidiValue> ·{" "}
              <BidiValue kind="time-range">{formattedTime}</BidiValue>
            </p>
          </div>
          <BookingActionPanel
            state={state}
            onRetry={onRetry}
            actionSlot={
              <div className="flex gap-2">
                <button
                  ref={keepButtonRef}
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="btn-ghost flex-1 hover:btn-ghost-hover"
                >
                  {keepLabel}
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={pending}
                  className="btn-navy flex-1 hover:btn-navy-hover disabled:opacity-60"
                >
                  {confirmLabel}
                </button>
              </div>
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
