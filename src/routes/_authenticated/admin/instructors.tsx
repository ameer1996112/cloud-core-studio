import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Sparkles, UserRound } from "lucide-react";
import { listInstructors, upsertInstructor } from "@/lib/admin.functions";
import { Empty, SectionTitle, Field, CardSkeleton } from "@/components/admin-shared";
import { t, useI18n } from "@/lib/i18n";
import { localizedInstructorBio, localizedInstructorName } from "@/lib/localized-content";

export const Route = createFileRoute("/_authenticated/admin/instructors")({
  head: () => ({ meta: [{ title: "Instructors — Studio Admin" }] }),
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

function Page() {
  const { lang } = useI18n();
  const fn = useServerFn(listInstructors);
  const upFn = useServerFn(upsertInstructor);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-instructors"], queryFn: () => fn() });
  const [editing, setEditing] = useState<InstructorForm | null>(null);
  const [search, setSearch] = useState("");

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

  return (
    <div className="space-y-7">
      <SectionTitle
        action={
          <button
            onClick={() => setEditing(emptyForm)}
            className="btn-navy hover:bg-transparent hover:text-navy"
          >
            <Plus className="h-3.5 w-3.5" /> {t("admin.instructors.add")}
          </button>
        }
      >
        {t("admin.instructors.title")}
      </SectionTitle>

      <section className="editorial-panel overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[1fr_320px]">
          <div className="p-5 sm:p-6">
            <p className="text-[10px] uppercase tracking-[0.28em] text-gold">
              {t("admin.instructors.roster")}
            </p>
            <h2 className="mt-2 font-display text-[28px] leading-tight text-navy">
              {t("admin.instructors.headline")}
            </h2>
            <div className="relative mt-5 max-w-xl">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" />
              <input
                className="editorial-input pl-11"
                placeholder={t("admin.instructors.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="border-t border-gold/20 bg-sand/35 p-5 sm:p-6 md:border-l md:border-t-0">
            <div className="grid grid-cols-2 gap-3">
              <Stat label={t("admin.instructors.total")} value={instructors.length} />
              <Stat label={t("admin.instructors.active")} value={activeCount} />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate">{t("admin.instructors.hint")}</p>
          </div>
        </div>
      </section>

      {isLoading ? (
        <CardSkeleton rows={3} />
      ) : filtered.length === 0 ? (
        <Empty>{t("admin.instructors.empty")}</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
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
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-0 backdrop-blur-sm md:items-center md:p-6">
          <form
            className="w-full max-w-2xl rounded-t-[6px] border border-gold/30 bg-ivory shadow-xl md:rounded-[6px]"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(editing);
            }}
          >
            <header className="flex items-center justify-between border-b border-gold/20 p-6">
              <h3 className="font-display text-2xl italic text-navy">
                {editing.id ? t("admin.instructors.edit") : t("admin.instructors.add")}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-[11px] uppercase tracking-[0.18em] text-slate hover:text-navy"
              >
                {t("common.close")}
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
                <input
                  className="editorial-input"
                  value={editing.avatar_url}
                  onChange={(e) => setEditing({ ...editing, avatar_url: e.target.value })}
                />
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
                disabled={save.isPending}
                className="btn-navy hover:btn-navy-hover"
              >
                {save.isPending ? t("common.saving") : t("common.save")}
              </button>
            </footer>
          </form>
        </div>
      )}
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
    <article className="editorial-card overflow-hidden p-5 transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-gold/45 hover:shadow-[0_18px_42px_-30px_rgba(11,29,58,0.55)]">
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          {instructor.avatar_url ? (
            <img
              src={instructor.avatar_url}
              alt=""
              className="h-16 w-16 rounded-full border border-gold/40 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-gold/35 bg-sand/70 text-navy">
              <UserRound className="h-6 w-6" />
            </div>
          )}
          {instructor.active && (
            <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-ivory bg-gold" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-display text-xl leading-tight text-navy">
                {instructor.displayName}
              </h3>
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate">
                {instructor.displayBio ?? t("admin.instructors.noBio")}
              </p>
            </div>
            <StatusBadge active={instructor.active} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gold/15 pt-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-slate">
              <Sparkles className="h-3 w-3 text-gold" />
              {t("admin.instructors.scheduleReady")}
            </span>
            <div className="ms-auto flex items-center gap-2">
              <button
                onClick={onEdit}
                className="text-[10px] uppercase tracking-[0.18em] text-slate hover:text-navy"
              >
                {t("common.edit")}
              </button>
              <button
                onClick={onToggle}
                className="rounded-[2px] border border-gold/45 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-navy transition-colors hover:bg-gold hover:text-ivory"
              >
                {instructor.active
                  ? t("admin.instructors.deactivate")
                  : t("admin.instructors.activate")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-[2px] border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${
        active ? "border-gold/60 bg-gold/10 text-navy" : "border-slate/30 bg-slate/5 text-slate"
      }`}
    >
      {active ? t("admin.instructors.active") : t("admin.instructors.inactive")}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-gold/25 bg-ivory/65 p-3">
      <p className="font-display text-3xl leading-none text-navy">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate">{label}</p>
    </div>
  );
}
