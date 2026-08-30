import { useRef, useState, type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PersistentAnnouncement } from "@/components/ui/sonner";
import { destructiveActionFailureMessage } from "@/components/admin/admin-destructive-state";
import { t } from "@/lib/i18n";

export interface AdminDestructiveActionProps {
  objectName: string;
  consequence: string;
  confirmLabel: string;
  pendingLabel: string;
  onConfirm: () => Promise<void>;
  title?: string;
  triggerLabel?: string;
  cancelLabel?: string;
  failureTitle?: string;
  failureMessage?: string;
  children?: ReactNode;
  disabled?: boolean;
  confirmDisabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerClassName?: string;
  confirmClassName?: string;
}

export function AdminDestructiveAction({
  objectName,
  consequence,
  confirmLabel,
  pendingLabel,
  onConfirm,
  title = confirmLabel,
  triggerLabel = confirmLabel,
  cancelLabel = t("common.cancel"),
  failureTitle,
  failureMessage,
  children,
  disabled = false,
  confirmDisabled = false,
  open: controlledOpen,
  onOpenChange,
  triggerClassName = "btn-outline border-red-300 text-red-700 hover:bg-red-50",
  confirmClassName = "bg-red-700 text-white hover:bg-red-800",
}: AdminDestructiveActionProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const pendingRef = useRef(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const open = controlledOpen ?? internalOpen;

  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const handleConfirm = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setFailure(null);
    try {
      await onConfirm();
      setOpen(false);
    } catch (error) {
      setFailure(destructiveActionFailureMessage(error, failureMessage ?? failureTitle ?? title));
      setOpen(false);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  return (
    <div>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled || pending}
          className={triggerClassName}
        >
          {triggerLabel}
        </button>

        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p className="font-medium text-navy" dir="auto">
                  <bdi>{objectName}</bdi>
                </p>
                <p>{consequence}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {children}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirm();
              }}
              disabled={confirmDisabled || pending}
              className={confirmClassName}
            >
              {pending ? pendingLabel : confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {failure ? (
        <PersistentAnnouncement tone="error" title={failureTitle ?? title} className="mt-3">
          <p>{failure}</p>
          <p dir="auto">
            <bdi>{objectName}</bdi>
          </p>
        </PersistentAnnouncement>
      ) : null}
    </div>
  );
}
