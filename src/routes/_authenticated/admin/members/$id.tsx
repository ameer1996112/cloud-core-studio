import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMemberDetail,
  updateMemberProfile,
  addMemberNote,
  deleteMemberNote,
  deleteMemberAccount,
} from "@/lib/members.functions";
import {
  adjustCredits,
  sendMemberPasswordReset,
  setMemberPassword,
  listAudit,
} from "@/lib/admin.functions";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, Field } from "@/components/admin-shared";
import {
  ArrowLeft,
  AlertTriangle,
  Sparkles,
  Trash2,
  Phone,
  Mail,
  Pencil,
  Save,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { getPlanDisplay } from "@/lib/planDisplay";
import { BidiDateTime, BidiValue } from "@/components/ui/bidi";
import { bidiDirectionFor, formatBidiValue } from "@/lib/bidi-format";

export const Route = createFileRoute("/_authenticated/admin/members/$id")({
  component: Page,
});

function Page() {
  const { lang, dir, t } = useI18n();
  useDocumentTitle("page.memberDetail.title");
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fn = useServerFn(getMemberDetail);
  const profileFn = useServerFn(updateMemberProfile);
  const creditsFn = useServerFn(adjustCredits);
  const auditFn = useServerFn(listAudit);
  const resetFn = useServerFn(sendMemberPasswordReset);
  const setPwFn = useServerFn(setMemberPassword);
  const addNoteFn = useServerFn(addMemberNote);
  const delNoteFn = useServerFn(deleteMemberNote);
  const deleteMemberFn = useServerFn(deleteMemberAccount);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin-member", id],
    queryFn: () => fn({ data: { memberId: id } }),
  });
  const { data: audit } = useQuery({
    queryKey: ["admin-audit", "member", id],
    queryFn: () => auditFn({ data: { entityId: id } }),
  });

  const [editProfile, setEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<any>(null);

  const [delta, setDelta] = useState(1);
  const [reason, setReason] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteImportant, setNoteImportant] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin-member", id] });
  }

  function startEdit() {
    if (!data?.member) return;
    const m = data.member;
    setProfileForm({
      name: m.name ?? "",
      phone: m.phone ?? "",
      email: m.email ?? "",
      status: m.status ?? "active",
      tags: (m.tags ?? []).join(", "),
      care_notes: m.care_notes ?? "",
      emergency_contact: m.emergency_contact ?? "",
      preferred_language: m.preferred_language ?? "en",
      energy_preference: m.energy_preference ?? "",
    });
    setEditProfile(true);
  }

  const saveProfile = useMutation({
    mutationFn: () =>
      profileFn({
        data: {
          memberId: id,
          name: profileForm.name,
          phone: profileForm.phone || null,
          email: profileForm.email || null,
          status: profileForm.status,
          tags: profileForm.tags
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean),
          care_notes: profileForm.care_notes || null,
          emergency_contact: profileForm.emergency_contact || null,
          preferred_language: profileForm.preferred_language,
          energy_preference: profileForm.energy_preference || null,
        },
      }),
    onSuccess: () => {
      toast.success(t("admin.memberDetail.profileSaved"));
      setEditProfile(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? t("admin.memberDetail.failed")),
  });

  const toggleStatus = useMutation({
    mutationFn: (status: "active" | "inactive") => profileFn({ data: { memberId: id, status } }),
    onSuccess: () => {
      toast.success(t("admin.memberDetail.statusUpdated"));
      invalidate();
    },
  });

  const adjust = useMutation({
    mutationFn: () => creditsFn({ data: { memberId: id, delta, reason } }),
    onSuccess: (r: any) => {
      if (r?.status === "ok") {
        toast.success(t("admin.memberDetail.creditsUpdated"));
        setReason("");
        invalidate();
      } else toast.error(r?.message ?? t("admin.memberDetail.failed"));
    },
  });

  const addNote = useMutation({
    mutationFn: () =>
      addNoteFn({ data: { memberId: id, body: noteBody, important: noteImportant } }),
    onSuccess: () => {
      toast.success(t("admin.memberDetail.noteAdded"));
      setNoteBody("");
      setNoteImportant(false);
      invalidate();
    },
  });
  const delNote = useMutation({
    mutationFn: (noteId: string) => delNoteFn({ data: { noteId } }),
    onSuccess: () => invalidate(),
  });

  const sendReset = useMutation({
    mutationFn: () =>
      resetFn({ data: { memberId: id, redirectTo: `${window.location.origin}/reset-password` } }),
    onSuccess: (r: any) =>
      toast.success(
        t("admin.memberDetail.resetSent", { email: formatBidiValue(r.email, "email") }),
      ),
    onError: (e: any) => toast.error(e?.message ?? t("admin.memberDetail.failed")),
  });
  const setPw = useMutation({
    mutationFn: () => setPwFn({ data: { memberId: id, password: newPassword } }),
    onSuccess: () => {
      toast.success(t("admin.memberDetail.passwordUpdated"));
      setNewPassword("");
    },
    onError: (e: any) => toast.error(e?.message ?? t("admin.memberDetail.failed")),
  });
  const deleteMember = useMutation({
    mutationFn: () => deleteMemberFn({ data: { memberId: id, confirmation: deleteConfirm } }),
    onSuccess: () => {
      toast.success(t("admin.memberDetail.deleted"));
      qc.removeQueries({ queryKey: ["admin-member", id] });
      window.location.href = "/admin/members";
    },
    onError: (e: any) => toast.error(e?.message ?? t("admin.memberDetail.deleteFailed")),
  });

  if (isLoading)
    return (
      <div
        role="status"
        aria-label={t("common.loading")}
        className="h-40 editorial-panel animate-pulse"
      />
    );
  if (isError || !data?.member)
    return (
      <section
        className="editorial-panel p-6 space-y-4"
        dir={dir}
        role={isError ? "alert" : "status"}
      >
        <h1 className="section-title">
          {t(isError ? "admin.memberDetail.loadError" : "admin.memberDetail.notFound")}
        </h1>
        <p>{t(isError ? "admin.memberDetail.loadHint" : "admin.memberDetail.notFoundHint")}</p>
        <div className="flex flex-wrap gap-3">
          {isError && (
            <button
              className="btn-navy px-5 py-3"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              {t(isFetching ? "common.loading" : "common.retry")}
            </button>
          )}
          <Link to="/admin/members" className="btn-outline px-5 py-3">
            {t("admin.memberDetail.back")}
          </Link>
        </div>
      </section>
    );
  const m = data.member as any;
  const activePlan = (data.plans ?? []).find((p: any) => p.status === "active");
  const deleteConfirmationOptions = [m.email, m.name]
    .filter(Boolean)
    .map((value: string) => value.trim());
  const canDelete = deleteConfirmationOptions.includes(deleteConfirm.trim());

  return (
    <div className="space-y-6" dir={dir}>
      <Link
        to="/admin/members"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate transition-colors hover:text-navy"
      >
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" /> {t("admin.memberDetail.back")}
      </Link>

      {/* Identity header */}
      <div className="editorial-panel p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="eyebrow">{t("admin.memberDetail.member")}</p>
            <h2 className="font-display text-4xl font-light text-navy mt-2">{m.name}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate">
              {m.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  <BidiValue kind="phone">{m.phone}</BidiValue>
                </span>
              )}
              {m.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  <BidiValue kind="email">{m.email}</BidiValue>
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              <StatusBadge status={m.status} />
              {m.is_first_timer || (m.attendance_count ?? 0) === 0 ? (
                <Pill tone="gold">
                  <Sparkles className="h-2.5 w-2.5" /> {t("admin.memberDetail.firstTimer")}
                </Pill>
              ) : null}
              {m.care_notes && (
                <Pill tone="amber">
                  <AlertTriangle className="h-2.5 w-2.5" /> {t("admin.memberDetail.care")}
                </Pill>
              )}
              {(m.tags ?? []).map((t: string) => (
                <Pill key={t} tone="quiet">
                  {t}
                </Pill>
              ))}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => toggleStatus.mutate(m.status === "active" ? "inactive" : "active")}
              className="btn-outline px-3 py-2 text-xs hover:btn-outline-hover"
            >
              {t(
                m.status === "active"
                  ? "admin.memberDetail.deactivate"
                  : "admin.memberDetail.activate",
              )}
            </button>
            <button
              onClick={startEdit}
              className="btn-navy inline-flex items-center gap-1.5 px-3 py-2 text-xs hover:btn-navy-hover"
            >
              <Pencil className="h-3.5 w-3.5" /> {t("admin.memberDetail.edit")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gold/20">
          <Stat
            label={t("admin.memberDetail.credits")}
            value={<BidiValue kind="identifier">{m.remaining_credits}</BidiValue>}
          />
          <Stat label={t("admin.memberDetail.visits")} value={m.attendance_count} />
          <Stat
            label={t("admin.memberDetail.spent")}
            value={<BidiValue kind="currency">₪{Math.round(data.total_spend)}</BidiValue>}
          />
          <Stat
            label={t("admin.memberDetail.last")}
            value={
              m.last_visit_at ? (
                <BidiValue kind="localized-date">
                  {new Date(m.last_visit_at).toLocaleDateString(lang, {
                    month: "short",
                    day: "numeric",
                  })}
                </BidiValue>
              ) : (
                "—"
              )
            }
          />
        </div>
        {(m.care_notes || m.emergency_contact) && (
          <div className="mt-6 pt-6 border-t border-gold/20 grid sm:grid-cols-2 gap-4">
            {m.care_notes && (
              <div className="rounded-xl border border-gold/50 bg-gold/10 p-3">
                <p className="eyebrow text-navy">{t("admin.memberDetail.care")}</p>
                <p className="text-sm text-navy mt-1 whitespace-pre-line">{m.care_notes}</p>
              </div>
            )}
            {m.emergency_contact && (
              <div>
                <p className="eyebrow">{t("admin.memberDetail.emergency")}</p>
                <p className="text-sm text-navy mt-1">{m.emergency_contact}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit profile modal */}
      {editProfile && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveProfile.mutate();
          }}
          className="editorial-panel p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="section-title">{t("admin.memberDetail.edit")}</h3>
            <button
              type="button"
              onClick={() => setEditProfile(false)}
              aria-label={t("admin.memberDetail.cancel")}
              className="btn-ghost p-2 hover:btn-ghost-hover"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={t("admin.memberDetail.name")}>
              <input
                className="editorial-input"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              />
            </Field>
            <Field label={t("admin.memberDetail.status")}>
              <select
                className="editorial-input"
                value={profileForm.status}
                onChange={(e) => setProfileForm({ ...profileForm, status: e.target.value })}
              >
                <option value="active">{t("admin.statusActive")}</option>
                <option value="inactive">{t("admin.statusInactive")}</option>
              </select>
            </Field>
            <Field label={t("admin.memberDetail.phone")}>
              <input
                type="tel"
                dir={bidiDirectionFor("phone")}
                className="editorial-input"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              />
            </Field>
            <Field label={t("admin.memberDetail.email")}>
              <input
                type="email"
                dir={bidiDirectionFor("email")}
                className="editorial-input"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              />
            </Field>
            <Field label={t("admin.memberDetail.language")}>
              <select
                className="editorial-input"
                value={profileForm.preferred_language}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, preferred_language: e.target.value })
                }
              >
                <option value="en">English</option>
                <option value="he">עברית</option>
                <option value="ar">العربية</option>
              </select>
            </Field>
            <Field label={t("admin.memberDetail.energy")}>
              <select
                className="editorial-input"
                value={profileForm.energy_preference}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, energy_preference: e.target.value })
                }
              >
                <option value="">{t("admin.noPreference")}</option>
                <option value="calm">{t("admin.memberDetail.calm")}</option>
                <option value="grounding">{t("admin.memberDetail.grounding")}</option>
                <option value="uplifting">{t("admin.memberDetail.uplifting")}</option>
                <option value="restorative">{t("admin.memberDetail.restorative")}</option>
              </select>
            </Field>
          </div>
          <Field label={t("admin.memberDetail.tags")}>
            <input
              className="editorial-input"
              value={profileForm.tags}
              onChange={(e) => setProfileForm({ ...profileForm, tags: e.target.value })}
              placeholder={t("admin.memberDetail.tagsHint")}
            />
          </Field>
          <Field label={t("admin.memberDetail.emergency")}>
            <input
              className="editorial-input"
              value={profileForm.emergency_contact}
              onChange={(e) =>
                setProfileForm({ ...profileForm, emergency_contact: e.target.value })
              }
              placeholder={t("admin.memberDetail.emergencyHint")}
            />
          </Field>
          <Field label={t("admin.memberDetail.rosterCare")}>
            <textarea
              rows={3}
              className="editorial-input"
              value={profileForm.care_notes}
              onChange={(e) => setProfileForm({ ...profileForm, care_notes: e.target.value })}
              placeholder={t("admin.memberDetail.careHint")}
            />
          </Field>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saveProfile.isPending}
              className="btn-navy inline-flex items-center gap-2 px-4 py-2.5 text-xs hover:btn-navy-hover disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" /> {t("admin.memberDetail.save")}
            </button>
            <button
              type="button"
              onClick={() => setEditProfile(false)}
              aria-label={t("admin.memberDetail.cancel")}
              className="btn-outline px-4 py-2.5 text-xs hover:btn-outline-hover"
            >
              {t("admin.memberDetail.cancel")}
            </button>
          </div>
        </form>
      )}

      {/* Active package */}
      <section className="editorial-panel p-6 space-y-3">
        <h3 className="section-title">{t("admin.memberDetail.activePackage")}</h3>
        {activePlan ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-xl text-navy">
                {activePlan.plan ? getPlanDisplay(activePlan.plan, lang).name : "—"}
              </p>
              <p className="mt-1 text-xs font-medium text-slate">
                {t("admin.memberDetail.granted", { count: activePlan.credits_granted })} ·{" "}
                {activePlan.expires_at ? (
                  <>
                    {t("admin.memberDetail.expires")}{" "}
                    <BidiValue kind="localized-date">
                      {new Date(activePlan.expires_at).toLocaleDateString(lang)}
                    </BidiValue>
                  </>
                ) : (
                  t("admin.memberDetail.noExpiry")
                )}
              </p>
            </div>
            <Link
              to="/admin/plans"
              className="text-xs font-medium text-navy transition-colors hover:text-[var(--color-accent-text)]"
            >
              {t("admin.memberDetail.manage")}
            </Link>
          </div>
        ) : (
          <Empty>{t("admin.noActivePackage")}</Empty>
        )}
      </section>

      {/* Internal notes */}
      <section className="editorial-panel p-6 space-y-4">
        <h3 className="section-title">{t("admin.memberDetail.internalNotes")}</h3>
        <div className="space-y-2">
          <textarea
            rows={2}
            className="editorial-input"
            placeholder={t("admin.memberDetail.privateNote")}
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate">
              <input
                type="checkbox"
                checked={noteImportant}
                onChange={(e) => setNoteImportant(e.target.checked)}
              />{" "}
              {t("admin.memberDetail.important")}
            </label>
            <button
              onClick={() =>
                noteBody.trim() ? addNote.mutate() : toast.error(t("admin.memberDetail.emptyNote"))
              }
              disabled={addNote.isPending}
              className="btn-navy px-4 py-2 text-xs hover:btn-navy-hover disabled:opacity-60"
            >
              {t("admin.memberDetail.addNote")}
            </button>
          </div>
        </div>
        {(data.notes ?? []).length === 0 && <Empty>{t("admin.noNotes")}</Empty>}
        <div className="space-y-2">
          {(data.notes ?? []).map((n: any) => (
            <div
              key={n.id}
              className={`rounded-xl border p-4 ${n.important ? "border-gold/50 bg-gold/10" : "border-gold/25 bg-ivory"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-navy whitespace-pre-line">{n.body}</p>
                <button
                  aria-label={t("admin.memberDetail.deleteNote")}
                  onClick={() => delNote.mutate(n.id)}
                  className="text-slate hover:text-destructive shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-2 text-xs font-medium text-slate">
                <BidiDateTime value={n.created_at} />
                {n.important && ` · ${t("admin.memberDetail.important")}`}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Adjust credits */}
      <section className="editorial-panel p-6 space-y-3">
        <h3 className="section-title">{t("admin.memberDetail.adjust")}</h3>
        <p className="text-xs text-slate">{t("admin.memberDetail.ledgerHint")}</p>
        <div className="flex gap-2">
          <input
            type="number"
            aria-label={t("common.credits")}
            className="w-24 editorial-input"
            value={delta}
            onChange={(e) => setDelta(+e.target.value)}
          />
          <input
            className="flex-1 editorial-input"
            placeholder={t("admin.memberDetail.reason")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <button
          onClick={() =>
            reason.trim() ? adjust.mutate() : toast.error(t("admin.memberDetail.reasonRequired"))
          }
          disabled={adjust.isPending}
          className="btn-navy px-4 py-2 text-xs hover:btn-navy-hover disabled:opacity-60"
        >
          {t("admin.memberDetail.apply")}
        </button>
      </section>

      {/* Bookings, attendance, payments, ledger */}
      <ListSection
        title={t("admin.memberDetail.bookings", { count: data.bookings.length })}
        empty={t("admin.memberDetail.noBookings")}
      >
        {data.bookings.map((b: any) => (
          <Row
            key={b.id}
            primary={b.class?.title ?? "—"}
            meta={
              <>
                {b.class?.starts_at ? <BidiDateTime value={b.class.starts_at} /> : ""} · {b.status}
              </>
            }
            right={t("admin.memberDetail.creditCount", { count: b.credit_cost })}
          />
        ))}
      </ListSection>

      <ListSection
        title={t("admin.memberDetail.attendance", { count: data.attendance.length })}
        empty={t("admin.memberDetail.noAttendance")}
      >
        {data.attendance.map((a: any) => (
          <Row
            key={a.id}
            primary={a.class?.title ?? "—"}
            meta={a.class?.starts_at ? <BidiDateTime value={a.class.starts_at} /> : ""}
            right={a.status}
          />
        ))}
      </ListSection>

      <ListSection
        title={t("admin.memberDetail.payments", { count: data.payments.length })}
        empty={t("admin.memberDetail.noPayments")}
      >
        {data.payments.map((p: any) => (
          <Row
            key={p.id}
            primary={p.plan ? getPlanDisplay(p.plan, lang).name : (p.notes ?? p.method)}
            meta={`${formatBidiValue(
              new Date(p.paid_at).toLocaleDateString(lang),
              "localized-date",
            )} · ${p.method} · ${p.status}`}
            right={formatBidiValue(
              `${p.currency === "ILS" ? "₪" : p.currency + " "}${Number(p.amount).toFixed(2)}${Number(p.refunded_amount) > 0 ? ` (-${Number(p.refunded_amount).toFixed(2)})` : ""}`,
              "currency",
            )}
          />
        ))}
      </ListSection>

      <ListSection
        title={t("admin.memberDetail.ledger", { count: data.ledger.length })}
        empty={t("admin.memberDetail.noLedger")}
      >
        {data.ledger.map((l: any) => (
          <Row
            key={l.id}
            primary={l.reason}
            meta={<BidiDateTime value={l.created_at} />}
            right={
              <span
                className={l.amount_delta < 0 ? "text-slate" : "text-[var(--color-accent-text)]"}
              >
                {l.amount_delta > 0 ? "+" : ""}
                {l.amount_delta}
              </span>
            }
          />
        ))}
      </ListSection>

      {/* Sign-in */}
      <section className="editorial-panel p-6 space-y-3">
        <h3 className="section-title">{t("admin.memberDetail.signin")}</h3>
        <p className="text-xs text-slate">{t("admin.memberDetail.resetHint")}</p>
        <button
          onClick={() => sendReset.mutate()}
          disabled={sendReset.isPending}
          className="btn-outline w-full px-4 py-2.5 text-xs hover:btn-outline-hover disabled:opacity-60"
        >
          {sendReset.isPending
            ? t("admin.memberDetail.sending")
            : t("admin.memberDetail.sendReset")}
        </button>
        <div className="flex gap-2 pt-2 border-t border-gold/15">
          <input
            type="password"
            className="flex-1 editorial-input"
            placeholder={t("admin.memberDetail.newPassword")}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <button
            onClick={() => {
              if (newPassword.length < 8) {
                toast.error(t("admin.memberDetail.passwordLength"));
                return;
              }
              if (!confirm(t("admin.memberDetail.confirmPassword"))) return;
              setPw.mutate();
            }}
            disabled={setPw.isPending}
            className="btn-navy px-4 py-2.5 text-xs hover:btn-navy-hover disabled:opacity-60"
          >
            {t("admin.memberDetail.set")}
          </button>
        </div>
      </section>

      {/* Danger zone */}
      <section className="editorial-panel border-red-200/80 bg-red-50/40 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-200 bg-card text-red-700">
            <Trash2 className="h-4 w-4" />
          </span>
          <div>
            <h3 className="section-title text-red-950">{t("admin.memberDetail.delete")}</h3>
            <p className="mt-1 text-sm leading-6 text-red-900/75">
              {t("admin.memberDetail.deleteBody")}
            </p>
          </div>
        </div>
        <Field
          label={t("admin.memberDetail.confirmDelete", {
            identity: m.email ? formatBidiValue(m.email, "email") : m.name,
          })}
        >
          <input
            className="editorial-input border-red-200 bg-card"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={m.email || m.name}
          />
        </Field>
        <button
          type="button"
          onClick={() => deleteMember.mutate()}
          disabled={deleteMember.isPending || !canDelete}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {deleteMember.isPending
            ? t("admin.memberDetail.deleting")
            : t("admin.memberDetail.deleteForever")}
        </button>
      </section>

      {/* Activity */}
      <section>
        <h3 className="section-title mb-3">{t("admin.memberDetail.activity")}</h3>
        <div className="space-y-1.5">
          {(audit ?? []).slice(0, 10).map((a: any) => (
            <div key={a.id} className="editorial-card px-3 py-2 text-xs font-medium text-slate">
              {a.action} · <BidiDateTime value={a.created_at} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="font-display text-2xl font-light mt-1">{value}</p>
    </div>
  );
}

function Pill({ tone, children }: { tone: "gold" | "amber" | "quiet"; children: React.ReactNode }) {
  const cls =
    tone === "gold"
      ? "text-[var(--color-accent-text)] border-gold/40"
      : tone === "amber"
        ? "text-navy border-gold/50 bg-gold/10"
        : "text-slate border-gold/25";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  if (status === "inactive") return <Pill tone="quiet">{t("admin.statusInactive")}</Pill>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-navy px-2 py-1 text-xs font-medium text-ivory">
      {t("admin.statusActive")}
    </span>
  );
}

function ListSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const count = Array.isArray(children)
    ? children.flat(2).filter(Boolean).length
    : children
      ? 1
      : 0;
  return (
    <section>
      <h3 className="section-title mb-3">{title}</h3>
      {count === 0 ? <Empty>{empty}</Empty> : <div className="space-y-1.5">{children}</div>}
    </section>
  );
}

function Row({
  primary,
  meta,
  right,
}: {
  primary: React.ReactNode;
  meta: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="editorial-card p-3 flex items-center justify-between text-sm">
      <div className="min-w-0">
        <p className="text-navy truncate">{primary}</p>
        <p className="mt-0.5 text-xs font-medium text-slate">{meta}</p>
      </div>
      <span className="font-display text-base text-navy shrink-0 ms-3">{right}</span>
    </div>
  );
}
