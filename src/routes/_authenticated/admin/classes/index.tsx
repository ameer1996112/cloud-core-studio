import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listClasses, setClassStatus } from "@/lib/admin.functions";
import { Plus, Archive, XCircle, CheckCircle } from "lucide-react";
import { Empty, SectionTitle } from "@/components/admin-shared";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/classes/")({
  head: () => ({ meta: [{ title: "Classes — Studio Admin" }] }),
  component: Page,
});

function Page() {
  const fn = useServerFn(listClasses);
  const setStatusFn = useServerFn(setClassStatus);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-classes"], queryFn: () => fn() });
  const mut = useMutation({
    mutationFn: (v: { id: string; status: "scheduled" | "cancelled" | "archived" }) =>
      setStatusFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-classes"] });
      toast.success("Updated");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="space-y-6">
      <SectionTitle
        action={
          <Link to="/admin/classes/new" className="btn-navy hover:bg-transparent hover:text-navy">
            <Plus className="h-3.5 w-3.5" /> New class
          </Link>
        }
      >
        All classes
      </SectionTitle>

      {isLoading && <div className="editorial-card h-40 skeleton-brand" />}
      {data && data.length === 0 && (
        <Empty>No classes yet. Compose the studio's first session.</Empty>
      )}

      <div className="space-y-2">
        {data?.map((c: any) => {
          const d = new Date(c.starts_at);
          const left = c.capacity - c.booked_count;
          return (
            <div key={c.id} className="editorial-card p-5 hover:editorial-card-hover">
              <div className="flex items-start justify-between gap-3">
                <Link to="/admin/classes/$id" params={{ id: c.id }} className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-display text-lg leading-tight">{c.title}</p>
                    <StatusChip s={c.status} />
                  </div>
                  <p className="text-[11px] uppercase tracking-[0.15em] text-slate mt-2">
                    {d.toLocaleString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {c.room} · {c.instructor?.name ?? "Unassigned"}
                  </p>
                  <p className="text-xs text-slate mt-1">
                    {c.booked_count}/{c.capacity} booked · {left > 0 ? `${left} open` : "Full"} ·{" "}
                    {c.waitlist_count} waiting
                  </p>
                </Link>
                <div className="flex gap-1 shrink-0">
                  {c.status === "scheduled" && (
                    <IconAction
                      onClick={() => {
                        if (confirm("Cancel this class?"))
                          mut.mutate({ id: c.id, status: "cancelled" });
                      }}
                      label="Cancel"
                    >
                      <XCircle className="h-4 w-4" />
                    </IconAction>
                  )}
                  {c.status === "cancelled" && (
                    <IconAction
                      onClick={() => mut.mutate({ id: c.id, status: "scheduled" })}
                      label="Reopen"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </IconAction>
                  )}
                  <IconAction
                    onClick={() => mut.mutate({ id: c.id, status: "archived" })}
                    label="Archive"
                  >
                    <Archive className="h-4 w-4" />
                  </IconAction>
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
      className="h-9 w-9 inline-flex items-center justify-center border border-gold/25 rounded-[2px] text-slate hover:text-navy hover:border-gold transition-colors"
    >
      {children}
    </button>
  );
}

function StatusChip({ s }: { s: string }) {
  const map: Record<string, string> = {
    scheduled: "border-gold/50 text-foreground bg-gold/10",
    cancelled: "border-slate/30 text-slate",
    archived: "border-slate/20 text-slate/70",
  };
  return (
    <span
      className={`text-[10px] uppercase tracking-[0.2em] px-2.5 py-1 rounded-[2px] border ${map[s] ?? "border-slate/20 text-slate"}`}
    >
      {s}
    </span>
  );
}
