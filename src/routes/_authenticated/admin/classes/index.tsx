import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listClasses, setClassStatus } from "@/lib/admin.functions";
import { Plus, Archive, XCircle, CheckCircle } from "lucide-react";
import { Empty, SectionTitle } from "@/components/admin-shared";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  localizedClassTitle,
  localizedInstructorName,
  localizedRoomName,
} from "@/lib/localized-content";

export const Route = createFileRoute("/_authenticated/admin/classes/")({
  component: Page,
});

function Page() {
  const { t, lang } = useI18n();
  useDocumentTitle("page.classes.title");
  const fn = useServerFn(listClasses);
  const setStatusFn = useServerFn(setClassStatus);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-classes"], queryFn: () => fn() });
  const mut = useMutation({
    mutationFn: (v: { id: string; status: "scheduled" | "cancelled" | "archived" }) =>
      setStatusFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-classes"] });
      toast.success(t("admin.classes.updated"));
    },
    onError: (e: any) => toast.error(e.message ?? t("admin.classes.failed")),
  });

  return (
    <div className="space-y-6">
      <SectionTitle
        action={
          <Link to="/admin/classes/new" className="btn-navy hover:btn-navy-hover">
            <Plus className="h-3.5 w-3.5" /> {t("admin.classes.new")}
          </Link>
        }
      >
        {t("admin.classes.all")}
      </SectionTitle>

      {isLoading && <div className="editorial-card h-40 skeleton-brand" />}
      {data && data.length === 0 && <Empty>{t("admin.noClasses")}</Empty>}

      <div className="space-y-2">
        {data?.map((c: any) => {
          const d = new Date(c.starts_at);
          const left = c.capacity - c.booked_count;
          return (
            <div key={c.id} className="editorial-card p-5 hover:editorial-card-hover">
              <div className="flex items-start justify-between gap-3">
                <Link to="/admin/classes/$id" params={{ id: c.id }} className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-display text-lg leading-tight">
                      {localizedClassTitle(c, lang)}
                    </p>
                    <StatusChip s={c.status} label={statusLabel(c.status, t)} />
                    {c.member_visible === false && (
                      <StatusChip s="staff_only" label={t("admin.classes.staffOnly")} />
                    )}
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate">
                    {d.toLocaleString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {localizedRoomName(c.room_ref?.name ?? c.room, lang)} ·{" "}
                    {c.instructor?.name
                      ? localizedInstructorName(c.instructor.name, lang)
                      : t("admin.classes.unassigned")}
                  </p>
                  <p className="text-xs text-slate mt-1">
                    {t("admin.classes.booked", { count: c.booked_count })}/{c.capacity} ·{" "}
                    {left > 0 ? t("admin.classes.open", { count: left }) : t("common.full")} ·{" "}
                    {t("admin.classes.waiting", { count: c.waitlist_count })}
                  </p>
                </Link>
                <div className="flex gap-1 shrink-0">
                  {c.status === "scheduled" && (
                    <IconAction
                      onClick={() => {
                        if (confirm(t("admin.classes.cancelConfirm")))
                          mut.mutate({ id: c.id, status: "cancelled" });
                      }}
                      label={t("common.cancel")}
                    >
                      <XCircle className="h-4 w-4" />
                    </IconAction>
                  )}
                  {c.status !== "scheduled" && (
                    <IconAction
                      onClick={() => mut.mutate({ id: c.id, status: "scheduled" })}
                      label={t("common.open")}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </IconAction>
                  )}
                  {c.status !== "archived" && (
                    <IconAction
                      onClick={() => mut.mutate({ id: c.id, status: "archived" })}
                      label={t("admin.programs.archived")}
                    >
                      <Archive className="h-4 w-4" />
                    </IconAction>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IconAction({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="btn-ghost inline-flex h-9 w-9 items-center justify-center p-0 hover:btn-ghost-hover"
    >
      {children}
    </button>
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
