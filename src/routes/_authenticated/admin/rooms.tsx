import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listRooms, upsertRoom, deleteRoom } from "@/lib/rooms.functions";
import { Empty, SectionTitle, Field, CardSkeleton } from "@/components/admin-shared";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ImagePlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/rooms")({
  head: () => ({ meta: [{ title: "Rooms — Studio Admin" }] }),
  component: RoomsPage,
});

type Room = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  capacity: number;
  equipment_count: number;
  setup_minutes_before: number;
  setup_minutes_after: number;
  color: string;
  notes: string | null;
  active: boolean;
};

const empty: Partial<Room> = {
  name: "",
  description: "",
  image_url: "",
  capacity: 10,
  equipment_count: 0,
  setup_minutes_before: 10,
  setup_minutes_after: 10,
  color: "#B7CCE6",
  notes: "",
  active: true,
};

function RoomsPage() {
  const list = useServerFn(listRooms);
  const upsert = useServerFn(upsertRoom);
  const remove = useServerFn(deleteRoom);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-rooms"],
    queryFn: () => list(),
  });

  const [editing, setEditing] = useState<Partial<Room> | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = useMutation({
    mutationFn: (r: Partial<Room>) => upsert({ data: r as any }),
    onSuccess: () => {
      toast.success("Room saved");
      qc.invalidateQueries({ queryKey: ["admin-rooms"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Room removed");
      qc.invalidateQueries({ queryKey: ["admin-rooms"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not delete"),
  });

  async function onPickImage(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `rooms/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("studio-media").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage
        .from("studio-media")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr) throw sErr;
      setEditing((e) => ({ ...(e ?? {}), image_url: signed.signedUrl }));
      toast.success("Image uploaded");
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-8">
      <SectionTitle
        action={
          <button
            onClick={() => setEditing(empty)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gold text-[11px] uppercase tracking-[0.18em] rounded-[2px] hover:bg-gold hover:text-ivory transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add room
          </button>
        }
      >
        Rooms
      </SectionTitle>

      {isLoading ? (
        <CardSkeleton rows={3} />
      ) : (data ?? []).length === 0 ? (
        <Empty>No rooms yet. Add your first studio space to start scheduling classes.</Empty>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {(data as Room[]).map((r) => (
            <article
              key={r.id}
              className="editorial-card overflow-hidden flex flex-col"
              style={{ borderLeft: `3px solid ${r.color}` }}
            >
              {r.image_url ? (
                <img
                  src={r.image_url}
                  alt={r.name}
                  loading="lazy"
                  width={640}
                  height={360}
                  className="w-full aspect-[16/9] object-cover"
                />
              ) : (
                <div className="w-full aspect-[16/9] bg-[#E8DFD1]/40 flex items-center justify-center text-slate font-display italic text-sm">
                  No image yet
                </div>
              )}
              <div className="p-5 flex-1 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-xl truncate">{r.name}</h3>
                    <p className="text-[11px] uppercase tracking-[0.15em] text-slate mt-1">
                      Cap {r.capacity} · {r.equipment_count} setups
                    </p>
                  </div>
                  {!r.active && (
                    <span className="text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 border border-slate/40 text-slate rounded-[2px]">
                      Off
                    </span>
                  )}
                </div>
                {r.description && (
                  <p className="text-sm text-slate leading-relaxed line-clamp-3">{r.description}</p>
                )}
                <div className="mt-auto flex items-center justify-end gap-2 pt-3 border-t border-gold/20">
                  <button
                    onClick={() => setEditing(r)}
                    className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.15em] text-slate hover:text-navy"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => {
                      if (
                        confirm(`Remove "${r.name}"? Existing classes will keep their text room.`)
                      ) {
                        del.mutate(r.id);
                      }
                    }}
                    className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.15em] text-slate hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6">
          <div className="bg-ivory w-full md:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-[6px] md:rounded-[6px] border border-gold/30 shadow-xl">
            <header className="flex items-center justify-between p-6 border-b border-gold/20">
              <h3 className="font-display italic text-2xl">
                {editing.id ? "Edit room" : "Add room"}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="text-slate hover:text-navy text-sm uppercase tracking-[0.18em]"
              >
                Close
              </button>
            </header>
            <form
              className="p-6 space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(editing);
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-32 aspect-[4/3] shrink-0 rounded-[4px] overflow-hidden border border-gold/30 bg-[#E8DFD1]/40 flex items-center justify-center"
                  style={
                    editing.image_url
                      ? { backgroundImage: `url(${editing.image_url})`, backgroundSize: "cover" }
                      : {}
                  }
                >
                  {!editing.image_url && (
                    <span className="text-[10px] uppercase tracking-[0.15em] text-slate">
                      No image
                    </span>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onPickImage(f);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-gold/50 text-[11px] uppercase tracking-[0.18em] rounded-[2px] hover:bg-gold/10 disabled:opacity-50"
                  >
                    <ImagePlus className="h-3.5 w-3.5" />{" "}
                    {uploading ? "Uploading…" : "Upload image"}
                  </button>
                  <p className="text-[11px] text-slate">
                    Stored privately in studio-media; signed for one year on use.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Name">
                  <input
                    className="editorial-input"
                    required
                    value={editing.name ?? ""}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </Field>
                <Field label="Accent colour">
                  <input
                    type="color"
                    className="editorial-input h-11"
                    value={editing.color ?? "#B7CCE6"}
                    onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                  />
                </Field>
                <Field label="Capacity">
                  <input
                    type="number"
                    min={1}
                    max={200}
                    className="editorial-input"
                    value={editing.capacity ?? 10}
                    onChange={(e) => setEditing({ ...editing, capacity: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Equipment / hammocks">
                  <input
                    type="number"
                    min={0}
                    max={200}
                    className="editorial-input"
                    value={editing.equipment_count ?? 0}
                    onChange={(e) =>
                      setEditing({ ...editing, equipment_count: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Setup before (min)">
                  <input
                    type="number"
                    min={0}
                    max={120}
                    className="editorial-input"
                    value={editing.setup_minutes_before ?? 0}
                    onChange={(e) =>
                      setEditing({ ...editing, setup_minutes_before: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Setup after (min)">
                  <input
                    type="number"
                    min={0}
                    max={120}
                    className="editorial-input"
                    value={editing.setup_minutes_after ?? 0}
                    onChange={(e) =>
                      setEditing({ ...editing, setup_minutes_after: Number(e.target.value) })
                    }
                  />
                </Field>
              </div>
              <Field label="Description">
                <textarea
                  className="editorial-input min-h-24"
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </Field>
              <Field label="Internal notes">
                <textarea
                  className="editorial-input min-h-16"
                  value={editing.notes ?? ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.active ?? true}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
                Active (available for scheduling)
              </label>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gold/20">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="text-[11px] uppercase tracking-[0.18em] text-slate hover:text-navy"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={save.isPending}
                  className="inline-flex items-center px-5 py-2 bg-navy text-ivory text-[11px] uppercase tracking-[0.2em] rounded-[2px] disabled:opacity-60 hover:bg-navy/90"
                >
                  {save.isPending ? "Saving…" : "Save room"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
