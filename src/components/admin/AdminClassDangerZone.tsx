import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
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
import { adminCancelClass, adminDeleteClass } from "@/lib/admin.functions";
import {
  formatAdminClassCancellationSummary,
  type AdminCancelClassResult,
  type AdminClassWorkflowSnapshot,
} from "@/lib/adminClassWorkflow";
import { useI18n } from "@/lib/i18n";

type WorkflowCounts = {
  bookings: number;
  waitlist: number;
  attendance: number;
  notifications: number;
  financial: number;
};

type WorkflowData = AdminClassWorkflowSnapshot & {
  classStatus: string;
  counts: WorkflowCounts;
};

type Props = {
  classId: string;
  classTitle: string;
  startsAt: string;
  creditCost: number;
  workflow: WorkflowData;
  onDeleted: () => void;
  onCancelled: () => void;
};

export function AdminClassDangerZone({
  classId,
  classTitle,
  startsAt,
  creditCost,
  workflow,
  onDeleted,
  onCancelled,
}: Props) {
  const { t, lang, locale } = useI18n();
  const cancelClassFn = useServerFn(adminCancelClass);
  const deleteClassFn = useServerFn(adminDeleteClass);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [resultLines, setResultLines] = useState<string[]>([]);

  const classDate = useMemo(
    () =>
      new Date(startsAt).toLocaleString(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [locale, startsAt],
  );

  const resetCancelForm = () => {
    setReason("");
    setConfirmChecked(false);
  };

  const cancelMutation = useMutation({
    mutationFn: () =>
      cancelClassFn({
        data: {
          classId,
          reason: reason.trim() || null,
          notifyMembers: true,
          refundCredits: true,
        },
      }),
    onSuccess: (result: AdminCancelClassResult) => {
      const lines = formatAdminClassCancellationSummary({ lang, summary: result.summary });
      setResultLines(lines);
      toast.success(t("admin.classDetail.cancelSuccess"));
      if (result.warnings.length > 0) {
        toast.error(t("admin.classDetail.notificationManualReview"));
      }
      setCancelOpen(false);
      resetCancelForm();
      onCancelled();
    },
    onError: (error: Error) => toast.error(error.message ?? t("admin.classes.failed")),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteClassFn({ data: { classId } }),
    onSuccess: (result: any) => {
      if (result.status === "blocked") {
        toast.error(t("admin.classDetail.deleteBlocked"));
        setDeleteOpen(false);
        setCancelOpen(true);
        return;
      }

      toast.success(t("admin.classDetail.deleteSuccess"));
      onDeleted();
    },
    onError: (error: Error) => toast.error(error.message ?? t("admin.classes.failed")),
  });

  const creditsImpact = workflow.counts.bookings * creditCost;
  const notificationImpact = workflow.counts.bookings;
  const disableCancelAction = workflow.requiresCancelConfirmation && !confirmChecked;

  return (
    <section className="rounded-[var(--cc-radius-card)] border border-red-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,245,243,0.92))] p-4 shadow-[0_12px_35px_rgba(11,29,58,0.06)]">
      <div className="space-y-2">
        <p className="eyebrow text-red-700">{t("admin.classDetail.dangerZone")}</p>
        <p className="text-sm text-slate">{t("admin.classDetail.dangerZoneBody")}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {workflow.canCancel ? (
          <button
            onClick={() => setCancelOpen(true)}
            className="btn-outline border-red-300 text-red-700 hover:bg-red-50"
          >
            {t("admin.classDetail.cancelClass")}
          </button>
        ) : null}
        {workflow.canDelete ? (
          <button
            onClick={() => setDeleteOpen(true)}
            className="btn-ghost text-red-700 hover:bg-red-50"
          >
            {t("admin.classDetail.deleteClass")}
          </button>
        ) : (
          <p className="text-sm text-slate">{t("admin.classDetail.deleteBlocked")}</p>
        )}
      </div>

      {resultLines.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-gold/20 bg-white/80 p-4">
          <p className="text-sm font-medium text-navy">
            {t("admin.classDetail.cancelSummaryTitle")}
          </p>
          <div className="mt-3 space-y-2">
            {resultLines.map((line) => (
              <p key={line} className="text-sm text-slate">
                {line}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.classDetail.cancelClass")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.classDetail.cancelDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 text-sm text-slate">
            <p className="font-medium text-navy" dir="auto">
              <bdi>{classTitle}</bdi>
            </p>
            <p>{classDate}</p>
            <p>
              {t("admin.classDetail.cancelSummaryBookings", { count: workflow.counts.bookings })}
            </p>
            <p>
              {t("admin.classDetail.cancelSummaryWaitlist", { count: workflow.counts.waitlist })}
            </p>
            <p>{t("admin.classDetail.cancelSummaryCredits", { count: creditsImpact })}</p>
            <p>
              {t("admin.classDetail.cancelSummaryNotifications", { count: notificationImpact })}
            </p>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("admin.classDetail.cancelReasonPlaceholder")}
              className="min-h-24 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm text-navy"
            />
            {workflow.requiresCancelConfirmation ? (
              <label className="flex items-start gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(event) => setConfirmChecked(event.target.checked)}
                />
                <span>{t("admin.classDetail.cancelClassConfirmCheckbox")}</span>
              </label>
            ) : null}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={resetCancelForm}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                cancelMutation.mutate();
              }}
              disabled={disableCancelAction || cancelMutation.isPending}
              className="bg-red-700 text-white hover:bg-red-800"
            >
              {t("admin.classDetail.cancelClass")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.classDetail.deleteClass")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.classDetail.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 text-sm text-slate">
            <p className="font-medium text-navy" dir="auto">
              <bdi>{classTitle}</bdi>
            </p>
            <p>{classDate}</p>
            <p>
              {t("admin.classDetail.cancelSummaryBookings", { count: workflow.counts.bookings })}
            </p>
            <p>
              {t("admin.classDetail.cancelSummaryWaitlist", { count: workflow.counts.waitlist })}
            </p>
            <p>{t("admin.classDetail.cancelSummaryCredits", { count: creditsImpact })}</p>
            <p>
              {t("admin.classDetail.cancelSummaryNotifications", { count: notificationImpact })}
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                deleteMutation.mutate();
              }}
              disabled={!workflow.canDelete || deleteMutation.isPending}
              className="bg-red-700 text-white hover:bg-red-800"
            >
              {t("admin.classDetail.deleteClass")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
