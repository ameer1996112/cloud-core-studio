import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listProgramTypes, upsertProgramType, archiveProgramType } from "@/lib/admin.functions";
import { useState } from "react";
import { Plus, Pencil, Archive, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Empty, Field, SectionTitle } from "@/components/admin-shared";

export const Route = createFileRoute("/_authenticated/admin/programs")({
  head: () => ({ meta: [{ title: "Program types — Studio Admin" }] }),
  component: Page,
});

type ProgramType = {
  id: string;
  slug: string;
  name_en: string;
  name_he: string;
  name_ar: string;
  description_en: string | null;
  description_he: string | null;
  description_ar: string | null;
  age_groups: string[];
  level: string | null;
  default_duration_minutes: number;
  default_capacity: number;
  default_credit_cost: number;
  equipment: string[];
  color_tag: string;
  cover_image_url: string | null;
  sort_order: number;
  active: boolean;
};

const emptyForm: Omit<ProgramType, "id"> & { id?: string } = {
  slug: "",
  name_en: "",
  name_he: "",
  name_ar: "",
  description_en: "",
  description_he: "",
  description_ar: "",
  age_groups: [],
  level: "all-levels",
  default_duration_minutes: 60,
  default_capacity: 12,
  default_credit_cost: 1,
  equipment: [],
  color_tag: "#D4AF6A",
  cover_image_url: "",
  sort_order: 0,
  active: true,
};

function Page() {
  const listFn = useServerFn(listProgramTypes);
  const saveFn = useServerFn(upsertProgramType);
  const archiveFn = useServerFn(archiveProgramType);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-program-types"],
    queryFn: () => listFn(),
  });
  const [editing, setEditing] = useState<ProgramType | "new" | null>(null);

  const saveMut = useMutation({
    mutationFn: (v: any) => saveFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-program-types"] });
      toast.success("Saved");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const archiveMut = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => archiveFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-program-types"] });
      toast.success("Updated");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="space-y-6">
      <SectionTitle
        action={
          <button
            onClick={() => setEditing("new")}
            className="btn-navy hover:bg-transparent hover:text-navy"
          >
            <Plus className="h-3.5 w-3.5" /> New program
          </button>
        }
      >
        Program types
      </SectionTitle>
      <p className="text-sm text-slate max-w-xl leading-relaxed -mt-4">
        The catalogue of disciplines the studio teaches. Each session in the schedule belongs to one
        of these programs. Content is stored separately in English, Hebrew, and Arabic — never
        mixed.
      </p>

      {isLoading && <div className="editorial-card h-32 skeleton-brand" />}
      {data && data.length === 0 && (
        <Empty>No programs yet. Add the studio's first discipline.</Empty>
      )}

      <div className="grid sm:grid-cols-2 gap-2">
        {data?.map((p: ProgramType) => (
          <div key={p.id} className="editorial-card overflow-hidden hover:editorial-card-hover">
            <div className="h-1" style={{ backgroundColor: p.color_tag }} />
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display text-lg leading-tight">{p.name_en}</p>
                    {!p.active && (
                      <span className="text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-[2px] border border-slate/30 text-slate">
                        Archived
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] uppercase tracking-[0.15em] text-slate mt-2">
                    {p.name_he} · {p.name_ar}
                  </p>
                  <p className="text-xs text-slate mt-3">
                    {p.default_duration_minutes}m · cap {p.default_capacity} ·{" "}
                    {p.default_credit_cost} cr
                    {p.level ? ` · ${p.level}` : ""}
                  </p>
                  {p.equipment.length > 0 && (
                    <p className="text-[11px] text-slate mt-2 italic">
                      Equipment: {p.equipment.join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => setEditing(p)}
                    aria-label="Edit"
                    className="h-9 w-9 inline-flex items-center justify-center border border-gold/25 rounded-[2px] text-slate hover:text-navy hover:border-gold transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => archiveMut.mutate({ id: p.id, active: !p.active })}
                    aria-label={p.active ? "Archive" : "Reactivate"}
                    className="h-9 w-9 inline-flex items-center justify-center border border-gold/25 rounded-[2px] text-slate hover:text-navy hover:border-gold transition-colors"
                  >
                    {p.active ? <Archive className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <ProgramModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(v) => saveMut.mutate(v)}
          saving={saveMut.isPending}
        />
      )}
    </div>
  );
}

function ProgramModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial: ProgramType | null;
  onClose: () => void;
  onSave: (v: any) => void;
  saving: boolean;
}) {
  const [f, setF] = useState<typeof emptyForm>(() => ({
    ...emptyForm,
    ...(initial ?? {}),
    description_en: initial?.description_en ?? "",
    description_he: initial?.description_he ?? "",
    description_ar: initial?.description_ar ?? "",
    cover_image_url: initial?.cover_image_url ?? "",
  }));

  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });

  return (
    <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-2xl bg-ivory border border-gold/30 rounded-[4px] p-7 space-y-6 max-h-[90vh] overflow-y-auto shadow-[0_30px_60px_-30px_rgba(11,29,58,0.3)]">
        <div className="flex items-center justify-between border-b border-gold/30 pb-4">
          <h3 className="font-display italic text-xl">
            {initial ? "Edit program" : "New program"}
          </h3>
          <button
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center text-slate hover:text-navy"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          <Field label="Slug (URL-safe)">
            <input
              className="editorial-input"
              value={f.slug}
              onChange={(e) =>
                set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") })
              }
            />
          </Field>
          <Field label="Color tag">
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-10 w-12 cursor-pointer rounded-[2px] border border-gold/30"
                value={f.color_tag}
                onChange={(e) => set({ color_tag: e.target.value })}
              />
              <input
                className="editorial-input"
                value={f.color_tag}
                onChange={(e) => set({ color_tag: e.target.value })}
              />
            </div>
          </Field>
        </div>

        <div className="space-y-5">
          <p className="eyebrow text-[10px]">Names (per language)</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="English">
              <input
                className="editorial-input"
                value={f.name_en}
                onChange={(e) => set({ name_en: e.target.value })}
              />
            </Field>
            <Field label="עברית">
              <input
                className="editorial-input text-right"
                dir="rtl"
                value={f.name_he}
                onChange={(e) => set({ name_he: e.target.value })}
              />
            </Field>
            <Field label="العربية">
              <input
                className="editorial-input text-right"
                dir="rtl"
                value={f.name_ar}
                onChange={(e) => set({ name_ar: e.target.value })}
              />
            </Field>
          </div>
        </div>

        <div className="space-y-5">
          <p className="eyebrow text-[10px]">Descriptions (per language)</p>
          <Field label="English">
            <textarea
              className="editorial-input"
              rows={2}
              value={f.description_en ?? ""}
              onChange={(e) => set({ description_en: e.target.value })}
            />
          </Field>
          <Field label="עברית">
            <textarea
              className="editorial-input text-right"
              dir="rtl"
              rows={2}
              value={f.description_he ?? ""}
              onChange={(e) => set({ description_he: e.target.value })}
            />
          </Field>
          <Field label="العربية">
            <textarea
              className="editorial-input text-right"
              dir="rtl"
              rows={2}
              value={f.description_ar ?? ""}
              onChange={(e) => set({ description_ar: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-5">
          <Field label="Duration (m)">
            <input
              type="number"
              className="editorial-input"
              value={f.default_duration_minutes}
              onChange={(e) => set({ default_duration_minutes: +e.target.value })}
            />
          </Field>
          <Field label="Capacity">
            <input
              type="number"
              className="editorial-input"
              value={f.default_capacity}
              onChange={(e) => set({ default_capacity: +e.target.value })}
            />
          </Field>
          <Field label="Credit cost">
            <input
              type="number"
              className="editorial-input"
              value={f.default_credit_cost}
              onChange={(e) => set({ default_credit_cost: +e.target.value })}
            />
          </Field>
          <Field label="Sort order">
            <input
              type="number"
              className="editorial-input"
              value={f.sort_order}
              onChange={(e) => set({ sort_order: +e.target.value })}
            />
          </Field>
        </div>

        <div className="grid md:grid-cols-2 gap-x-6 gap-y-5">
          <Field label="Level">
            <input
              className="editorial-input"
              placeholder="all-levels / beginner / advanced"
              value={f.level ?? ""}
              onChange={(e) => set({ level: e.target.value })}
            />
          </Field>
          <Field label="Age groups (comma separated)">
            <input
              className="editorial-input"
              placeholder="adults, teens, kids"
              value={f.age_groups.join(", ")}
              onChange={(e) =>
                set({
                  age_groups: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
          <Field label="Equipment (comma separated)">
            <input
              className="editorial-input"
              placeholder="silk hammock, yoga mat"
              value={f.equipment.join(", ")}
              onChange={(e) =>
                set({
                  equipment: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
          <Field label="Cover image URL">
            <input
              className="editorial-input"
              value={f.cover_image_url ?? ""}
              onChange={(e) => set({ cover_image_url: e.target.value })}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate">
          <input
            type="checkbox"
            className="accent-navy"
            checked={f.active}
            onChange={(e) => set({ active: e.target.checked })}
          />
          Active (visible in the catalogue)
        </label>

        <div className="flex justify-end gap-3 pt-2 border-t border-gold/25">
          <button onClick={onClose} className="btn-ghost hover:btn-ghost-hover">
            Cancel
          </button>
          <button
            disabled={saving || !f.slug || !f.name_en || !f.name_he || !f.name_ar}
            onClick={() =>
              onSave({
                ...f,
                description_en: f.description_en || null,
                description_he: f.description_he || null,
                description_ar: f.description_ar || null,
                cover_image_url: f.cover_image_url || null,
                level: f.level || null,
              })
            }
            className="btn-navy hover:bg-transparent hover:text-navy disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save program"}
          </button>
        </div>
      </div>
    </div>
  );
}
