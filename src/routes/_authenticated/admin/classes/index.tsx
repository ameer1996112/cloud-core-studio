import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listClasses, setClassStatus } from "@/lib/admin.functions";
import { Plus, Archive, CheckCircle } from "lucide-react";
import {
  AdminPageShell,
  AdminPageHeader,
  AsyncState,
  PersistentAnnouncement,
  ResponsiveDataList,
  type ResponsiveDataListColumn,
} from "@/components/admin-shared";
import { AdminDestructiveAction } from "@/components/admin/AdminDestructiveAction";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { safeErrorMessage } from "@/lib/error-messages";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  localizedClassTitle,
  localizedInstructorName,
  localizedRoomName,
} from "@/lib/localized-content";
import { BidiDateTime } from "@/components/ui/bidi";

export const Route = createFileRoute("/_authenticated/admin/classes/")({
  component: Page,
});

function Page() {
  const { t, lang } = useI18n();
  useDocumentTitle("page.classes.title");
  const fn = useServerFn(listClasses);
  const setStatusFn = useServerFn(setClassStatus);
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-classes"],
    queryFn: () => fn(),
  });
  const [outcome, setOutcome] = useState<{ tone: "success" | "error"; body: string } | null>(null);
  const mut = useMutation({
    mutationFn: (v: { id: string; status: "scheduled" | "cancelled" | "archived" }) =>
      setStatusFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-classes"] });
      setOutcome({ tone: "success", body: t("admin.classes.updated") });
    },
    onError: (statusError: unknown) =>
      setOutcome({
        tone: "error",
        body: safeErrorMessage(statusError, t("admin.classes.failed")),
      }),
  });

  const columns: ResponsiveDataListColumn<NonNullable<typeof data>[number]>[] = [
    {
      id: "class",
      label: t("admin.classes.all"),
      cell: (c) => (
        <Link to="/admin/classes/$id" params={{ id: c.id }} className="block min-w-0">
          <p className="font-display text-lg leading-tight">
            <bdi>{localizedClassTitle(c, lang)}</bdi>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusChip s={c.status} label={statusLabel(c.status, t)} />
            {c.member_visible === false ? (
              <StatusChip s="staff_only" label={t("admin.classes.staffOnly")} />
            ) : null}
          </div>
        </Link>
      ),
    },
    {
      id: "schedule",
      label: t("common.when"),
      cell: (c) => {
        const date = new Date(c.starts_at);
        return (
          <span className="text-xs font-medium text-slate">
            <BidiDateTime
              value={date}
              options={{
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }}
            />
          </span>
        );
      },
    },
    {
      id: "location",
      label: t("common.where"),
      cell: (c) => (
        <span className="text-xs font-medium text-slate">
          {localizedRoomName(c.room_ref?.name ?? c.room, lang)} ·{" "}
          {c.instructor?.name
            ? localizedInstructorName(c.instructor.name, lang)
            : t("admin.classes.unassigned")}
        </span>
      ),
    },
    {
      id: "capacity",
      label: t("common.capacity"),
      cell: (c) => {
        const left = c.capacity - c.booked_count;
        return (
          <span className="text-xs text-slate">
            {t("admin.classes.booked", { count: c.booked_count })}/{c.capacity} ·{" "}
            {left > 0 ? t("admin.classes.open", { count: left }) : t("common.full")} ·{" "}
            {t("admin.classes.waiting", { count: c.waitlist_count })}
          </span>
        );
      },
    },
    {
      id: "actions",
      label: t("common.status"),
      cell: (c) => (
        <div className="flex min-w-0 flex-wrap gap-2">
          {c.status === "scheduled" ? (
            <AdminDestructiveAction
              objectName={localizedClassTitle(c, lang)}
              consequence={t("admin.classes.cancelConsequence")}
              confirmLabel={t("common.cancel")}
              pendingLabel={t("common.saving")}
              failureMessage={t("admin.classes.failed")}
              onConfirm={() =>
                mut.mutateAsync({ id: c.id, status: "cancelled" }).then(() => undefined)
              }
              triggerClassName="btn-outline inline-flex min-h-11 items-center gap-2 px-3 text-xs text-destructive"
            />
          ) : (
            <button
              type="button"
              onClick={() => mut.mutate({ id: c.id, status: "scheduled" })}
              disabled={mut.isPending}
              className="btn-outline inline-flex min-h-11 items-center gap-2 px-3 text-xs"
            >
              <CheckCircle className="h-4 w-4" aria-hidden="true" />
              {t("common.open")}
            </button>
          )}
          {c.status !== "archived" ? (
            <AdminDestructiveAction
              objectName={localizedClassTitle(c, lang)}
              consequence={t("admin.classes.archiveConsequence")}
              confirmLabel={t("admin.programs.archive")}
              pendingLabel={t("common.saving")}
              failureMessage={t("admin.classes.failed")}
              onConfirm={() =>
                mut.mutateAsync({ id: c.id, status: "archived" }).then(() => undefined)
              }
              triggerClassName="btn-ghost inline-flex min-h-11 items-center gap-2 px-3 text-xs"
            >
              <Archive className="h-4 w-4" aria-hidden="true" />
            </AdminDestructiveAction>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={t("admin.classes.all")}
        action={
          <Link to="/admin/classes/new" className="btn-navy hover:btn-navy-hover">
            <Plus className="h-3.5 w-3.5" /> {t("admin.classes.new")}
          </Link>
        }
      />

      {outcome ? (
        <PersistentAnnouncement tone={outcome.tone} title={outcome.body}>
          {outcome.body}
        </PersistentAnnouncement>
      ) : null}

      <AsyncState
        state={
          isLoading
            ? { status: "loading", label: t("common.loading") }
            : isError
              ? {
                  status: "error",
                  title: t("admin.classes.failed"),
                  body: safeErrorMessage(error, t("admin.classes.failed")),
                  retry: () => void refetch(),
                }
              : (data?.length ?? 0) === 0
                ? {
                    status: "empty",
                    title: t("admin.noClasses"),
                    body: t("admin.noClasses"),
                  }
                : { status: "ready", data: data ?? [] }
        }
      >
        {(classes) => (
          <ResponsiveDataList
            caption={t("admin.classes.all")}
            columns={columns}
            data={classes}
            getRowKey={(c) => c.id}
          />
        )}
      </AsyncState>
    </AdminPageShell>
  );
}

function StatusChip({ s, label }: { s: string; label: string }) {
  const map: Record<string, string> = {
    scheduled: "border-gold/50 text-foreground bg-gold/10",
    cancelled: "border-slate/30 text-slate",
    archived: "border-slate/20 text-slate/70",
    staff_only: "border-navy/20 bg-navy/5 text-navy",
  };
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${map[s] ?? "border-slate/20 text-slate"}`}
    >
      {label}
    </span>
  );
}

function statusLabel(status: string, t: any) {
  const key = `admin.classStatus.${status}`;
  const translated = t(key as any);
  return translated === key ? status : translated;
}
