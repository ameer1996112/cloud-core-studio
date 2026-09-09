import { StaffFormDialog } from "@/components/admin/StaffFormDialog";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listRooms, upsertRoom, deleteRoom } from "@/lib/rooms.functions";
import {
  AdminPageShell,
  AdminPageHeader,
  AsyncState,
  Field,
  PersistentAnnouncement,
  ResponsiveDataList,
  type ResponsiveDataListColumn,
} from "@/components/admin-shared";
import { AdminDestructiveAction } from "@/components/admin/AdminDestructiveAction";
import { Plus, Pencil, ImagePlus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { safeErrorMessage } from "@/lib/error-messages";
import { studioImages } from "@/lib/image-assets";
import { Button, CardActionRow, IconButton } from "@/components/ui/button";
import {
  DEFAULT_ROOM_COLOR,
  createRoomColorForm,
  editRoomColorForm,
  roomColorSavePayload,
} from "@/lib/room-color";

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
  color: DEFAULT_ROOM_COLOR,
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

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-rooms"],
    queryFn: () => list(),
  });

  const [editing, setEditing] = useState<Partial<Room> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [outcome, setOutcome] = useState<{
    tone: "success" | "error";
    title: string;
    body?: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const readColorToken = (name: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name);

  const save = useMutation({
    mutationFn: (r: Partial<Room>) =>
      upsert({
        data: {
          ...r,
          color: roomColorSavePayload(r.color ?? DEFAULT_ROOM_COLOR),
        } as any,
      }),
    onSuccess: () => {
      setOutcome({ tone: "success", title: t("admin.rooms.saved") });
      qc.invalidateQueries({ queryKey: ["admin-rooms"] });
      setEditing(null);
    },
    onError: (saveError: unknown) =>
      setOutcome({
        tone: "error",
        title: t("admin.rooms.couldNotSave"),
        body: safeErrorMessage(saveError, t("admin.rooms.couldNotSave")),
      }),
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      setOutcome({ tone: "success", title: t("admin.rooms.removed") });
      qc.invalidateQueries({ queryKey: ["admin-rooms"] });
    },
    onError: (deleteError: unknown) =>
      setOutcome({
        tone: "error",
        title: t("admin.rooms.couldNotDelete"),
        body: safeErrorMessage(deleteError, t("admin.rooms.couldNotDelete")),
      }),
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
      setOutcome({ tone: "success", title: t("admin.rooms.imageUploaded") });
    } catch (uploadError: unknown) {
      setOutcome({
        tone: "error",
        title: t("admin.rooms.uploadFailed"),
        body: safeErrorMessage(uploadError, t("admin.rooms.uploadFailed")),
      });
    } finally {
      setUploading(false);
    }
  }

  const columns: ResponsiveDataListColumn<Room>[] = [
    {
      id: "room",
      label: t("admin.rooms.name"),
      cell: (room) => (
        <RoomCard
          room={room}
          onEdit={() => {
            setOutcome(null);
            setEditing({ ...room, color: editRoomColorForm(room.color, readColorToken) });
          }}
          onDelete={() => del.mutateAsync(room.id).then(() => undefined)}
        />
      ),
    },
    {
      id: "status",
      label: t("common.status"),
      cell: (room) => (room.active ? t("status.active") : t("status.inactive")),
    },
    {
      id: "capacity",
      label: t("admin.rooms.capacity"),
      cell: (room) => room.capacity,
    },
    {
      id: "equipment",
      label: t("admin.rooms.equipment"),
      cell: (room) => room.equipment_count,
    },
  ];

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={t("admin.rooms.title")}
        action={
          <Button
            onClick={() => {
              setOutcome(null);
              setEditing({ ...empty, color: createRoomColorForm(readColorToken) });
            }}
          >
            <Plus className="h-3.5 w-3.5" /> {t("admin.rooms.add")}
          </Button>
        }
      />

      {outcome && !editing ? (
        <PersistentAnnouncement tone={outcome.tone} title={outcome.title}>
          {outcome.body ? <p>{outcome.body}</p> : null}
        </PersistentAnnouncement>
      ) : null}

      <AsyncState
        state={
          isLoading
            ? { status: "loading", label: t("common.loading") }
            : isError
              ? {
                  status: "error",
                  title: t("admin.rooms.couldNotSave"),
                  body: safeErrorMessage(error, t("admin.rooms.couldNotSave")),
                  retry: () => void refetch(),
                }
              : (data?.length ?? 0) === 0
                ? { status: "empty", title: t("admin.noRooms"), body: t("admin.noRooms") }
                : { status: "ready", data: (data ?? []) as Room[] }
        }
      >
        {(rooms) => (
          <ResponsiveDataList
            caption={t("admin.rooms.title")}
            columns={columns}
            data={rooms}
            getRowKey={(room) => room.id}
          />
        )}
      </AsyncState>

      {editing && (
        <StaffFormDialog
          title={editing.id ? t("admin.rooms.edit") : t("admin.rooms.add")}
          onClose={() => setEditing(null)}
        >
          <div className="w-full max-h-[92vh] overflow-y-auto rounded-t-2xl border border-gold/30 bg-ivory shadow-[0_30px_60px_-28px_rgba(11,29,58,0.32)] md:max-w-2xl md:rounded-2xl">
            <header className="flex items-center justify-between p-6 border-b border-gold/20">
              <h3 className="font-display text-2xl">
                {editing.id ? t("admin.rooms.edit") : t("admin.rooms.add")}
              </h3>
              <IconButton
                type="button"
                aria-label={t("admin.rooms.close")}
                onClick={() => setEditing(null)}
                variant="ghost"
              >
                ×
              </IconButton>
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
                  <Button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    variant="outline"
                    size="sm"
                  >
                    <ImagePlus className="h-3.5 w-3.5" />{" "}
                    {uploading ? t("admin.rooms.uploading") : t("admin.rooms.uploadImage")}
                  </Button>
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
                    value={editing.color ?? DEFAULT_ROOM_COLOR}
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

              {outcome ? (
                <PersistentAnnouncement tone={outcome.tone} title={outcome.title}>
                  {outcome.body ? <p>{outcome.body}</p> : null}
                </PersistentAnnouncement>
              ) : null}

              <div className="cc-card-action-row">
                <Button type="button" onClick={() => setEditing(null)} variant="secondary">
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? t("common.saving") : t("admin.rooms.save")}
                </Button>
              </div>
            </form>
          </div>
        </StaffFormDialog>
      )}
    </AdminPageShell>
  );
}

function RoomCard({
  room,
  onEdit,
  onDelete,
}: {
  room: Room;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const { t } = useI18n();
  const imageSrc = room.image_url || studioImages.studioInterior.src;

  return (
    <article
      className="editorial-card flex min-w-0 flex-col overflow-hidden"
      style={{ borderInlineStart: `3px solid ${room.color}` }}
    >
      <img
        src={imageSrc}
        alt={room.name}
        loading="lazy"
        width={640}
        height={360}
        className="aspect-[16/9] w-full object-cover"
      />
      {!room.image_url ? <span className="sr-only">{t("admin.rooms.noImageYet")}</span> : null}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-xl">
              <bdi>{room.name}</bdi>
            </h3>
            <p className="mt-1 text-xs font-medium text-slate">
              {t("admin.rooms.capacitySetup", {
                capacity: room.capacity,
                setups: room.equipment_count,
              })}
            </p>
          </div>
          {!room.active ? (
            <span className="rounded-full border border-slate/40 px-2.5 py-1 text-xs font-medium text-slate">
              {t("admin.rooms.off")}
            </span>
          ) : null}
        </div>
        {room.description ? (
          <p className="line-clamp-3 text-sm leading-relaxed text-slate">{room.description}</p>
        ) : null}
        <CardActionRow>
          <IconButton
            type="button"
            aria-label={t("admin.rooms.editAction")}
            title={t("admin.rooms.editAction")}
            onClick={onEdit}
            variant="secondary"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </IconButton>
          <AdminDestructiveAction
            objectName={room.name}
            consequence={t("admin.rooms.removeConfirm", { name: room.name })}
            confirmLabel={t("admin.rooms.deleteAction")}
            pendingLabel={t("common.saving")}
            onConfirm={onDelete}
            failureTitle={t("admin.rooms.couldNotDelete")}
            failureMessage={t("admin.rooms.couldNotDelete")}
            triggerClassName="btn-outline min-h-11 px-3 text-xs text-destructive"
          />
        </CardActionRow>
      </div>
    </article>
  );
}
