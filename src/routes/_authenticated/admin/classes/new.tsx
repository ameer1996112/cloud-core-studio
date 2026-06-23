import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { upsertClass, listInstructors, getSettings, listProgramTypes } from "@/lib/admin.functions";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/classes/new")({
  head: () => ({ meta: [{ title: "New class — Studio Admin" }] }),
  component: NewClass,
});

function NewClass() {
  const navigate = useNavigate();
  const upsertFn = useServerFn(upsertClass);
  const instructorsFn = useServerFn(listInstructors);
  const settingsFn = useServerFn(getSettings);
  const programsFn = useServerFn(listProgramTypes);
  const { data: instructors } = useQuery({
    queryKey: ["admin-instructors"],
    queryFn: () => instructorsFn(),
  });
  const { data: settings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => settingsFn(),
  });
  const { data: programs } = useQuery({
    queryKey: ["admin-programs"],
    queryFn: () => programsFn(),
  });

  const [form, setForm] = useState({
    title: "",
    starts_at: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    duration_minutes: 60,
    capacity: 10,
    room: "Cloud Room",
    energy: "calm",
    cancellation_window_hours: 24,
    credit_cost: 1,
    instructor_id: "",
    program_type_id: "",
  });

  useEffect(() => {
    if (settings) {
      setForm((f) => ({
        ...f,
        capacity: settings.default_capacity,
        room: settings.rooms?.[0] ?? f.room,
        energy: settings.energy_labels?.[0] ?? f.energy,
        cancellation_window_hours: settings.default_cancellation_window_hours,
        credit_cost: settings.default_credit_cost,
      }));
    }
  }, [settings]);

  const mut = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          ...form,
          starts_at: new Date(form.starts_at).toISOString(),
          instructor_id: form.instructor_id || null,
          program_type_id: form.program_type_id || null,
        },
      }),
    onSuccess: () => {
      toast.success("Class created");
      navigate({ to: "/admin/classes" });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate();
      }}
    >
      <h2 className="font-display text-xl">Create class</h2>
      <Field label="Title">
        <input
          className="input"
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </Field>
      <Field label="Starts at">
        <input
          className="input"
          type="datetime-local"
          required
          value={form.starts_at}
          onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duration (min)">
          <input
            className="input"
            type="number"
            min={1}
            value={form.duration_minutes}
            onChange={(e) => setForm({ ...form, duration_minutes: +e.target.value })}
          />
        </Field>
        <Field label="Capacity">
          <input
            className="input"
            type="number"
            min={1}
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: +e.target.value })}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Room">
          <select
            className="input"
            value={form.room}
            onChange={(e) => setForm({ ...form, room: e.target.value })}
          >
            {(settings?.rooms ?? ["Cloud Room", "Core Room"]).map((r: string) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Energy">
          <select
            className="input"
            value={form.energy}
            onChange={(e) => setForm({ ...form, energy: e.target.value })}
          >
            {(settings?.energy_labels ?? ["calm", "grounding", "uplifting", "restorative"]).map(
              (r: string) => (
                <option key={r}>{r}</option>
              ),
            )}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cancel window (h)">
          <input
            className="input"
            type="number"
            min={0}
            value={form.cancellation_window_hours}
            onChange={(e) => setForm({ ...form, cancellation_window_hours: +e.target.value })}
          />
        </Field>
        <Field label="Credit cost">
          <input
            className="input"
            type="number"
            min={0}
            value={form.credit_cost}
            onChange={(e) => setForm({ ...form, credit_cost: +e.target.value })}
          />
        </Field>
      </div>
      <Field label="Program type">
        <select
          className="input"
          required
          value={form.program_type_id}
          onChange={(e) => {
            const id = e.target.value;
            const p = programs?.find((x: any) => x.id === id);
            setForm({
              ...form,
              program_type_id: id,
              title: form.title || p?.name_en || "",
              duration_minutes: p?.default_duration_minutes ?? form.duration_minutes,
              capacity: p?.default_capacity ?? form.capacity,
              credit_cost: p?.default_credit_cost ?? form.credit_cost,
            });
          }}
        >
          <option value="">— Select a program type —</option>
          {programs
            ?.filter((p: any) => p.active)
            .map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name_en}
              </option>
            ))}
        </select>
      </Field>
      <Field label="Instructor">
        <select
          className="input"
          value={form.instructor_id}
          onChange={(e) => setForm({ ...form, instructor_id: e.target.value })}
        >
          <option value="">— Unassigned —</option>
          {instructors
            ?.filter((i: any) => i.active)
            .map((i: any) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
        </select>
      </Field>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => navigate({ to: "/admin/classes" })}
          className="flex-1 rounded-full border border-border bg-card py-3 text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={mut.isPending}
          className="flex-1 rounded-full bg-primary text-primary-foreground py-3 text-sm"
        >
          {mut.isPending ? "Saving…" : "Create"}
        </button>
      </div>
    </form>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
      <style>{`.input{width:100%;border-radius:0.75rem;background:hsl(var(--card));border:1px solid hsl(var(--border));padding:0.65rem 0.85rem;font-size:0.9rem;color:hsl(var(--foreground))}`}</style>
    </label>
  );
}
