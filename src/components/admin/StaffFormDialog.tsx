import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useDialogReturnFocus } from "@/hooks/use-dialog-return-focus";

/** Keep each operational form and callback intact inside an accessible modal. */
export function StaffFormDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const returnFocus = useDialogReturnFocus();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="staff-form-dialog"
        showCloseButton={false}
        aria-describedby={undefined}
        {...returnFocus}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
