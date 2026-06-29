import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listRooms, upsertRoom, deleteRoom } from "@/lib/rooms.functions";
import {
  AdminPageShell,
  AdminPageHeader,
  Empty,
  Field,
  CardSkeleton,
} from "@/components/admin-shared";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ImagePlus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { studioImages } from "@/lib/image-assets";

export const Route = createFileRoute("/_authenticated/admin/rooms")({
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
  color: "#E8DFD1",
  notes: "",
  active: true,
};

function RoomsPage() {
  const { t } = useI18n();
  useDocumentTitle("page.rooms.title");
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
      toast.success(t("admin.rooms.saved"));
      qc.invalidateQueries({ queryKey: ["admin-rooms"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.message ?? t("admin.rooms.couldNotSave")),
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success(t("admin.rooms.removed"));
      qc.invalidateQueries({ queryKey: ["admin-rooms"] });
    },
    onError: (e: any) => toast.error(e?.message ?? t("admin.rooms.couldNotDelete")),
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
      toast.success(t("admin.rooms.imageUploaded"));
    } catch (err: any) {
      toast.error(err?.message ?? t("admin.rooms.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={t("admin.rooms.title")}
        action={
          <button onClick={() => setEditing(empty)} className="btn-navy hover:btn-navy-hover">
            <Plus className="h-3.5 w-3.5" /> {t("admin.rooms.add")}
          </button>
        }
      />

      {isLoading ? (
        <CardSkeleton rows={3} />
      ) : (data ?? []).length === 0 ? (
        <Empty>{t("admin.noRooms")}</Empty>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {(data as Room[]).map((r) => {
            const imageSrc = r.image_url || studioImages.studioInterior.src;
            return (
              <article
                key={r.id}
                className="editorial-card overflow-hidden flex flex-col"
                style={{ borderInlineStart: `3px solid ${r.color}` }}
              >
                <img
                  src={imageSrc}
                  alt={r.name}
                  loading="lazy"
                  width={640}
                  height={360}
                  className="w-full aspect-[16/9] object-cover"
                />
                {!r.image_url && <span className="sr-only">{t("admin.rooms.noImageYet")}</span>}
                <div className="p-5 flex-1 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-xl truncate">{r.name}</h3>
                      <p className="mt-1 text-xs font-medium text-slate">
                        {t("admin.rooms.capacitySetup", {
                          capacity: r.capacity,
                          setups: r.equipment_count,
                        })}
                      </p>
                    </div>
                    {!r.active && (
                      <span className="rounded-full border border-slate/40 px-2.5 py-1 text-xs font-medium text-slate">
                        {t("admin.rooms.off")}
                      </span>
                    )}
                  </div>
                  {r.description && (
                    <p className="text-sm text-slate leading-relaxed line-clamp-3">
                      {r.description}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-end gap-2 pt-3 border-t border-gold/20">
                    <button
                      onClick={() => setEditing(r)}
                      className="btn-ghost inline-flex items-center gap-1 px-0 text-xs hover:btn-ghost-hover"
                    >
                      <Pencil className="h-3.5 w-3.5" /> {t("common.edit")}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(t("admin.rooms.removeConfirm", { name: r.name }))) {
                          del.mutate(r.id);
                        }
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6">
          <div className="w-full max-h-[92vh] overflow-y-auto rounded-t-2xl border border-gold/30 bg-ivory shadow-[0_30px_60px_-28px_rgba(11,29,58,0.32)] md:max-w-2xl md:rounded-2xl">
            <header className="flex items-center justify-between p-6 border-b border-gold/20">
              <h3 className="font-display text-2xl">
                {editing.id ? t("admin.rooms.edit") : t("admin.rooms.add")}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="btn-ghost inline-flex h-9 w-9 items-center justify-center p-0 hover:btn-ghost-hover"
              >
                ×
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
                  className="bg-sand/40 flex aspect-[4/3] w-32 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border border-gold/30"
                  style={
                    editing.image_url
                      ? { backgroundImage: `url(${editing.image_url})`, backgroundSize: "cover" }
                      : {}
                  }
                >
                  {!editing.image_url && (
                    <span className="text-xs font-medium text-slate">
                      {t("admin.rooms.noImage")}
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
                    className="btn-outline inline-flex items-center gap-2 px-3 py-2 text-xs hover:btn-outline-hover disabled:opacity-50"
                  >
                    <ImagePlus className="h-3.5 w-3.5" />{" "}
                    {uploading ? t("admin.rooms.uploading") : t("admin.rooms.uploadImage")}
                  </button>
                  <p className="text-xs text-slate">{t("admin.rooms.imageHelp")}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={t("admin.rooms.name")}>
                  <input
                    className="editorial-input"
                    required
                    value={editing.name ?? ""}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </Field>
                <Field label={t("admin.rooms.accentColour")}>
                  <input
                    type="color"
                    className="editorial-input h-11"
                    value={editing.color ?? "#E8DFD1"}
                    onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                  />
                </Field>
                <Field label={t("admin.rooms.capacity")}>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    className="editorial-input"
                    value={editing.capacity ?? 10}
                    onChange={(e) => setEditing({ ...editing, capacity: Number(e.target.value) })}
                  />
                </Field>
                <Field label={t("admin.rooms.equipment")}>
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
                <Field label={t("admin.rooms.setupBefore")}>
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
                <Field label={t("admin.rooms.setupAfter")}>
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
              <Field label={t("admin.rooms.description")}>
                <textarea
                  className="editorial-input min-h-24"
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </Field>
              <Field label={t("admin.rooms.internalNotes")}>
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
                {t("admin.rooms.active")}
              </label>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gold/20">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="text-xs font-medium text-slate transition-colors hover:text-navy"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={save.isPending}
                  className="inline-flex items-center rounded-xl bg-navy px-5 py-2 text-xs font-medium text-ivory transition-colors hover:bg-navy/90 disabled:opacity-60"
                >
                  {save.isPending ? t("common.saving") : t("admin.rooms.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
