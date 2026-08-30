import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AdminDestructiveAction } from "@/components/admin/AdminDestructiveAction";
import { PersistentAnnouncement } from "@/components/ui/sonner";
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
  const [resultTone, setResultTone] = useState<"success" | "error">("success");
  const [resultTitle, setResultTitle] = useState("");

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
      setResultTone(result.warnings.length > 0 ? "error" : "success");
      setResultTitle(
        result.warnings.length > 0
          ? t("admin.classDetail.notificationManualReview")
          : t("admin.classDetail.cancelSuccess"),
      );
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
        setResultLines([t("admin.classDetail.deleteBlocked")]);
        setResultTone("error");
        setResultTitle(t("admin.classDetail.deleteBlocked"));
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
    <section className="rounded-[var(--cc-radius-card)] border border-red-200/70 bg-[linear-gradient(180deg,var(--cc-alpha-white-96),var(--cc-admin-danger-surface-end))] p-4 shadow-[0_12px_35px_var(--cc-alpha-navy-06)]">
      <div className="space-y-2">
        <p className="eyebrow text-red-700">{t("admin.classDetail.dangerZone")}</p>
        <p className="text-sm text-slate">{t("admin.classDetail.dangerZoneBody")}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {workflow.canCancel ? (
          <AdminDestructiveAction
            objectName={classTitle}
            consequence={t("admin.classDetail.cancelDescription")}
            confirmLabel={t("admin.classDetail.cancelClass")}
            pendingLabel={t("common.saving")}
            failureTitle={t("admin.classes.failed")}
            onConfirm={async () => {
              await cancelMutation.mutateAsync();
            }}
            open={cancelOpen}
            onOpenChange={(open) => {
              setCancelOpen(open);
              if (!open && !cancelMutation.isPending) resetCancelForm();
            }}
            confirmDisabled={disableCancelAction}
          >
            <div className="space-y-3 text-sm text-slate">
              <p>{classDate}</p>
              <p>
                {t("admin.classDetail.cancelSummaryBookings", {
                  count: workflow.counts.bookings,
                })}
              </p>
              <p>
                {t("admin.classDetail.cancelSummaryWaitlist", {
                  count: workflow.counts.waitlist,
                })}
              </p>
              <p>{t("admin.classDetail.cancelSummaryCredits", { count: creditsImpact })}</p>
              <p>
                {t("admin.classDetail.cancelSummaryNotifications", {
                  count: notificationImpact,
                })}
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
          </AdminDestructiveAction>
        ) : null}
        {workflow.canDelete ? (
          <AdminDestructiveAction
            objectName={classTitle}
            consequence={t("admin.classDetail.deleteDescription")}
            confirmLabel={t("admin.classDetail.deleteClass")}
            pendingLabel={t("common.saving")}
            failureTitle={t("admin.classes.failed")}
            onConfirm={async () => {
              await deleteMutation.mutateAsync();
            }}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            disabled={!workflow.canDelete}
            triggerClassName="btn-ghost text-red-700 hover:bg-red-50"
          >
            <div className="space-y-3 text-sm text-slate">
              <p>{classDate}</p>
              <p>
                {t("admin.classDetail.cancelSummaryBookings", {
                  count: workflow.counts.bookings,
                })}
              </p>
              <p>
                {t("admin.classDetail.cancelSummaryWaitlist", {
                  count: workflow.counts.waitlist,
                })}
              </p>
              <p>{t("admin.classDetail.cancelSummaryCredits", { count: creditsImpact })}</p>
              <p>
                {t("admin.classDetail.cancelSummaryNotifications", {
                  count: notificationImpact,
                })}
              </p>
            </div>
          </AdminDestructiveAction>
        ) : (
          <p className="text-sm text-slate">{t("admin.classDetail.deleteBlocked")}</p>
        )}
      </div>

      {resultLines.length > 0 ? (
        <PersistentAnnouncement
          tone={resultTone}
          title={resultTitle || t("admin.classDetail.cancelSummaryTitle")}
          className="mt-4"
        >
          <div className="mt-3 space-y-2">
            {resultLines.map((line) => (
              <p key={line} className="text-sm">
                {line}
              </p>
            ))}
          </div>
        </PersistentAnnouncement>
      ) : null}
    </section>
  );
}
