import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listInstructors, upsertInstructor } from "@/lib/admin.functions";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, SectionTitle, Field } from "@/components/admin-shared";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/instructors")({
  head: () => ({ meta: [{ title: "Instructors — Studio Admin" }] }),
  component: Page,
});

function Page() {
  const fn = useServerFn(listInstructors);
  const upFn = useServerFn(upsertInstructor);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-instructors"], queryFn: () => fn() });
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", bio_short: "", avatar_url: "" });

  const save = useMutation({
    mutationFn: (v: any) => upFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-instructors"] });
      toast.success("Saved");
      setAdding(false);
      setForm({ name: "", bio_short: "", avatar_url: "" });
    },
  });

  return (
    <div className="space-y-6">
      <SectionTitle
        action={
          !adding && (
            <button
              onClick={() => setAdding(true)}
              className="btn-navy hover:bg-transparent hover:text-navy"
            >
              <Plus className="h-3.5 w-3.5" /> Add instructor
            </button>
          )
        }
      >
        Instructors
      </SectionTitle>

      {adding && (
        <form
          className="editorial-panel p-6 md:p-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(form);
          }}
        >
          <Field label="Name">
            <input
              className="editorial-input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Short bio">
            <input
              className="editorial-input"
              value={form.bio_short}
              onChange={(e) => setForm({ ...form, bio_short: e.target.value })}
            />
          </Field>
          <Field label="Avatar URL">
            <input
              className="editorial-input"
              value={form.avatar_url}
              onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="btn-ghost hover:btn-ghost-hover"
            >
              Cancel
            </button>
            <button type="submit" className="btn-navy hover:bg-transparent hover:text-navy">
              Add instructor
            </button>
          </div>
        </form>
      )}

      {data?.length === 0 && !adding && <Empty>No instructors yet.</Empty>}

      <div className="grid sm:grid-cols-2 gap-2">
        {data?.map((i: any) => (
          <div key={i.id} className="editorial-card p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {i.avatar_url ? (
                <img
                  src={i.avatar_url}
                  alt=""
                  className="h-14 w-14 rounded-full object-cover border border-gold/40"
                />
              ) : (
                <div className="h-14 w-14 rounded-full bg-sand border border-gold/30" />
              )}
              <div className="min-w-0">
                <p className="font-display text-lg truncate">{i.name}</p>
                <p className="text-xs text-slate truncate mt-0.5">{i.bio_short ?? "—"}</p>
              </div>
            </div>
            <button
              onClick={() => save.mutate({ id: i.id, name: i.name, active: !i.active })}
              className={`shrink-0 text-[10px] uppercase tracking-[0.18em] px-3 py-2 rounded-[2px] border transition-colors ${
                i.active
                  ? "border-gold/60 text-foreground bg-gold/10 hover:bg-gold hover:text-ivory"
                  : "border-slate/30 text-slate hover:border-slate"
              }`}
            >
              {i.active ? "Active" : "Inactive"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
