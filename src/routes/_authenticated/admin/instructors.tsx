import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BookOpenText, ImagePlus, Plus, Search, Sparkles, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listInstructors, upsertInstructor } from "@/lib/admin.functions";
import { AdminPageShell, Empty, Field, CardSkeleton } from "@/components/admin-shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { t, useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { localizedInstructorBio, localizedInstructorName } from "@/lib/localized-content";

export const Route = createFileRoute("/_authenticated/admin/instructors")({
  component: Page,
});

type InstructorForm = {
  id?: string;
  name: string;
  bio_short: string;
  avatar_url: string;
  active?: boolean;
};

const emptyForm: InstructorForm = { name: "", bio_short: "", avatar_url: "", active: true };
const instructorHelpBulletKeys = [
  "admin.instructors.helpBullet1",
  "admin.instructors.helpBullet2",
  "admin.instructors.helpBullet3",
  "admin.instructors.helpBullet4",
] as const;

function Page() {
  const { dir, lang, t } = useI18n();
  useDocumentTitle("page.instructors.title");
  const fn = useServerFn(listInstructors);
  const upFn = useServerFn(upsertInstructor);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-instructors"], queryFn: () => fn() });
  const [editing, setEditing] = useState<InstructorForm | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  const instructors = useMemo(
    () =>
      (data ?? [])
        .filter((i: any) => !/^E2E\s/i.test(i.name ?? ""))
        .map((i: any) => ({
          ...i,
          displayName: localizedInstructorName(i.name, lang),
          displayBio: localizedInstructorBio(i.bio_short, lang),
        })),
    [data, lang],
  );

  const filtered = instructors.filter((i: any) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [i.displayName, i.displayBio, i.name, i.bio_short].some((v) =>
      String(v ?? "")
        .toLowerCase()
        .includes(q),
    );
  });

  const activeCount = instructors.filter((i: any) => i.active).length;
  const inactiveCount = Math.max(instructors.length - activeCount, 0);

  const save = useMutation({
    mutationFn: (v: InstructorForm) =>
      upFn({
        data: {
          id: v.id,
          name: v.name,
          bio_short: v.bio_short || null,
          avatar_url: v.avatar_url || null,
          active: v.active,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-instructors"] });
      toast.success(t("admin.instructors.saved"));
      setEditing(null);
    },
  });

  function openAddInstructor() {
    setHelpOpen(false);
    setEditing(emptyForm);
  }

  async function onPickAvatar(file: File) {
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `instructors/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("studio-media").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (upErr) throw upErr;

      const { data: signed, error: signErr } = await supabase.storage
        .from("studio-media")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr) throw signErr;

      setEditing((current) => (current ? { ...current, avatar_url: signed.signedUrl } : current));
      toast.success(t("admin.instructors.avatarUploaded"));
    } catch (err: any) {
      toast.error(err?.message ?? t("admin.instructors.avatarUploadFailed"));
    } finally {
      setUploadingAvatar(false);
      if (avatarFileRef.current) avatarFileRef.current.value = "";
    }
  }

  return (
    <AdminPageShell className="admin-instructors-page" dir={dir}>
      <header className="admin-instructors-hero">
        <div className="admin-instructors-hero__copy">
          <p className="eyebrow">{t("admin.instructors.eyebrow")}</p>
          <h1 className="cc-page-title">{t("admin.instructors.title")}</h1>
          <p>{t("admin.instructors.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={openAddInstructor}
          className="btn-navy admin-instructors-primary-cta hover:btn-navy-hover"
        >
          <Plus className="h-4 w-4" />
          {t("admin.instructors.add")}
        </button>
      </header>

      <section className="admin-instructors-control-panel">
        <div className="admin-instructors-stats" aria-label={t("admin.instructors.summary")}>
          <InstructorStatCard label={t("admin.instructors.total")} value={instructors.length} />
          <InstructorStatCard label={t("admin.instructors.active")} value={activeCount} accent />
          <InstructorStatCard label={t("admin.instructors.inactive")} value={inactiveCount} />
        </div>

        <div className="admin-instructors-tools">
          <label className="admin-instructors-search">
            <Search className="admin-instructors-search__icon" aria-hidden="true" />
            <span className="sr-only">{t("admin.instructors.search")}</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.instructors.search")}
            />
          </label>
          <div className="admin-instructors-result-pill">
            <Sparkles className="h-3.5 w-3.5" />
            {t("admin.instructors.showing", { count: filtered.length })}
          </div>
        </div>
      </section>

      {isLoading ? (
        <CardSkeleton rows={3} />
      ) : instructors.length === 0 ? (
        <Empty
          dir={dir}
          title={t("admin.instructors.emptyTitle")}
          body={t("admin.instructors.emptyBody")}
          primaryAction={
            <button
              type="button"
              onClick={openAddInstructor}
              className="btn-navy hover:btn-navy-hover"
            >
              <Plus className="h-4 w-4" />
              {t("admin.instructors.emptyPrimary")}
            </button>
          }
          secondaryAction={
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="btn-outline hover:btn-outline-hover"
            >
              {t("admin.instructors.emptySecondary")}
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <Empty>{t("admin.instructors.empty")}</Empty>
      ) : (
        <section className="admin-instructors-grid" aria-label={t("admin.instructors.title")}>
          {filtered.map((i: any) => (
            <InstructorCard
              key={i.id}
              instructor={i}
              onEdit={() =>
                setEditing({
                  id: i.id,
                  name: i.name ?? "",
                  bio_short: i.bio_short ?? "",
                  avatar_url: i.avatar_url ?? "",
                  active: i.active,
                })
              }
              onToggle={() =>
                save.mutate({
                  id: i.id,
                  name: i.name,
                  bio_short: i.bio_short ?? "",
                  avatar_url: i.avatar_url ?? "",
                  active: !i.active,
                })
              }
            />
          ))}
        </section>
      )}

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent dir={dir} className="max-w-xl border-gold/30 bg-ivory">
          <DialogTitle className="font-display text-2xl text-navy">
            {t("admin.instructors.helpTitle")}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-slate">
            {t("admin.instructors.helpBody")}
          </DialogDescription>
          <ul className="space-y-3 text-sm leading-relaxed text-slate">
            {instructorHelpBulletKeys.map((key, index) => (
              <li key={index} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/15 text-[11px] font-semibold text-gold"
                >
                  {index + 1}
                </span>
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
          <DialogFooter className="gap-2 pt-2">
            <button
              type="button"
              onClick={openAddInstructor}
              className="btn-navy hover:btn-navy-hover"
            >
              <Plus className="h-4 w-4" />
              {t("admin.instructors.emptyPrimary")}
            </button>
            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              className="btn-outline hover:btn-outline-hover"
            >
              {t("common.close")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-0 backdrop-blur-sm md:items-center md:p-6">
          <form
            className="w-full max-w-2xl rounded-t-2xl border border-gold/30 bg-ivory shadow-[0_30px_60px_-28px_rgba(11,29,58,0.32)] md:rounded-2xl"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(editing);
            }}
          >
            <header className="flex items-center justify-between border-b border-gold/20 p-6">
              <h3 className="cc-section-title">
                {editing.id ? t("admin.instructors.edit") : t("admin.instructors.add")}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="btn-ghost inline-flex h-9 w-9 items-center justify-center p-0 hover:btn-ghost-hover"
                aria-label={t("common.close")}
              >
                ×
              </button>
            </header>
            <div className="space-y-5 p-6">
              <Field label={t("admin.instructors.name")}>
                <input
                  className="editorial-input"
                  required
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </Field>
              <Field label={t("admin.instructors.bio")}>
                <input
                  className="editorial-input"
                  value={editing.bio_short}
                  onChange={(e) => setEditing({ ...editing, bio_short: e.target.value })}
                />
              </Field>
              <Field label={t("admin.instructors.avatar")}>
                <div className="flex items-center gap-4 rounded-[var(--radius-sm)] border border-gold/25 bg-sand/25 p-3">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gold/35 bg-ivory text-navy">
                    {editing.avatar_url ? (
                      <img src={editing.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <UserRound className="h-7 w-7" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      ref={avatarFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void onPickAvatar(file);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => avatarFileRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="btn-outline inline-flex items-center gap-2 px-3 py-2 text-xs hover:btn-outline-hover disabled:opacity-50"
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                      {uploadingAvatar
                        ? t("admin.instructors.uploadingAvatar")
                        : t("admin.instructors.uploadAvatar")}
                    </button>
                    <p className="text-xs leading-relaxed text-slate">
                      {t("admin.instructors.avatarHelp")}
                    </p>
                  </div>
                </div>
              </Field>
              <label className="inline-flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  checked={editing.active ?? true}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
                {t("admin.instructors.active")}
              </label>
            </div>
            <footer className="flex justify-end gap-3 border-t border-gold/20 p-6">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="btn-ghost hover:btn-ghost-hover"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={save.isPending || uploadingAvatar}
                className="btn-navy hover:btn-navy-hover"
              >
                {save.isPending || uploadingAvatar ? t("common.saving") : t("common.save")}
              </button>
            </footer>
          </form>
        </div>
      )}
    </AdminPageShell>
  );
}

function InstructorStatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className={accent ? "admin-instructors-stat is-accent" : "admin-instructors-stat"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InstructorCard({
  instructor,
  onEdit,
  onToggle,
}: {
  instructor: any;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <article className="admin-instructor-card">
      <div className="admin-instructor-card__header">
        <div className="admin-instructor-avatar">
          {instructor.avatar_url ? (
            <img src={instructor.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <UserRound className="h-7 w-7" />
          )}
          {instructor.active && (
            <span className="admin-instructor-avatar__status" aria-hidden="true" />
          )}
        </div>

        <div className="admin-instructor-card__identity">
          <div>
            <h3>
              <bdi>{instructor.displayName}</bdi>
            </h3>
            <p>{instructor.displayBio ?? t("admin.instructors.noBio")}</p>
          </div>
          <StatusBadge active={instructor.active} />
        </div>
      </div>

      <div className="admin-instructor-chip-row">
        <span>
          <Sparkles className="h-3.5 w-3.5" />
          {t("admin.instructors.scheduleReady")}
        </span>
        <span>
          <BookOpenText className="h-3.5 w-3.5" />
          {t("admin.instructors.profileReady")}
        </span>
      </div>

      <div className="admin-instructor-card__actions">
        <button type="button" onClick={onEdit} className="btn-outline hover:btn-outline-hover">
          {t("common.edit")}
        </button>
        <button type="button" onClick={onToggle} className="btn-ghost hover:btn-ghost-hover">
          {instructor.active ? t("admin.instructors.deactivate") : t("admin.instructors.activate")}
        </button>
      </div>
    </article>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={active ? "admin-instructor-status is-active" : "admin-instructor-status"}>
      {active ? t("admin.instructors.active") : t("admin.instructors.inactive")}
    </span>
  );
}
