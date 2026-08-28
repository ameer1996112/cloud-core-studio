import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listClasses,
  upsertClass,
  listInstructors,
  getSettings,
  listProgramTypes,
  listBookings,
  listWaitlist,
  waitlistAdd,
  waitlistRemove,
  waitlistPromote,
  adminCancelBooking,
  listMembers,
  adminCreateBooking,
  listAudit,
  getAdminClassWorkflow,
} from "@/lib/admin.functions";
import { listRooms } from "@/lib/rooms.functions";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Field, SessionForm, serializeClass } from "@/components/admin/SessionForm";
import { Empty } from "@/components/admin-shared";
import { Trash2, ArrowUpCircle, UserPlus, X } from "lucide-react";
import { AdminClassDangerZone } from "@/components/admin/AdminClassDangerZone";
import { useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  localizedClassTitle,
  localizedInstructorName,
  localizedRoomName,
} from "@/lib/localized-content";
import { formatStudioDateTimeInput } from "@/lib/studio-time";

export const Route = createFileRoute("/_authenticated/admin/classes/$id")({
  component: Page,
});

function Page() {
  const { t, lang, locale } = useI18n();
  useDocumentTitle("page.classDetail.title");
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const classesFn = useServerFn(listClasses);
  const instructorsFn = useServerFn(listInstructors);
  const settingsFn = useServerFn(getSettings);
  const programsFn = useServerFn(listProgramTypes);
  const roomsFn = useServerFn(listRooms);
  const upsertFn = useServerFn(upsertClass);
  const bookingsFn = useServerFn(listBookings);
  const waitlistFn = useServerFn(listWaitlist);
  const waitlistAddFn = useServerFn(waitlistAdd);
  const waitlistRemoveFn = useServerFn(waitlistRemove);
  const waitlistPromoteFn = useServerFn(waitlistPromote);
  const cancelFn = useServerFn(adminCancelBooking);
  const createBookingFn = useServerFn(adminCreateBooking);
  const membersFn = useServerFn(listMembers);
  const auditFn = useServerFn(listAudit);
  const workflowFn = useServerFn(getAdminClassWorkflow);

  const { data: classes } = useQuery({ queryKey: ["admin-classes"], queryFn: () => classesFn() });
  const cls = classes?.find((c: any) => c.id === id);
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
  const { data: rooms } = useQuery({
    queryKey: ["admin-rooms"],
    queryFn: () => roomsFn(),
  });
  const { data: bookings } = useQuery({
    queryKey: ["admin-class-bookings", id],
    queryFn: () => bookingsFn({ data: { classId: id } }),
  });
  const { data: waitlist } = useQuery({
    queryKey: ["admin-waitlist", id],
    queryFn: () => waitlistFn({ data: { classId: id } }),
  });
  const { data: members } = useQuery({
    queryKey: ["admin-members", ""],
    queryFn: () => membersFn({ data: {} }),
  });
  const { data: audit } = useQuery({
    queryKey: ["admin-audit", "class", id],
    queryFn: () => auditFn({ data: { entityId: id } }),
  });
  const { data: workflow } = useQuery({
    queryKey: ["admin-class-workflow", id],
    queryFn: () => workflowFn({ data: { classId: id } }),
  });

  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [showAddMember, setShowAddMember] = useState(false);

  function startEdit() {
    if (!cls) return;
    setForm({
      id: cls.id,
      title: cls.title,
      starts_at: formatStudioDateTimeInput(cls.starts_at),
      duration_minutes: cls.duration_minutes,
      capacity: cls.capacity,
      room: cls.room,
      room_id: cls.room_id ?? "",
      energy: cls.energy,
      cancellation_window_hours: cls.cancellation_window_hours,
      credit_cost: cls.credit_cost,
      instructor_id: cls.instructor_id ?? "",
      program_type_id: cls.program_type_id ?? "",
      member_visible: cls.member_visible ?? true,
      status: cls.status,
    });
    setEdit(true);
  }

  const save = useMutation({
    mutationFn: () =>
      upsertFn({
        data: serializeClass(form),
      }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      setEdit(false);
      qc.invalidateQueries({ queryKey: ["admin-classes"] });
    },
    onError: (e: any) => toast.error(e.message ?? t("admin.classes.failed")),
  });

  const cancelBooking = useMutation({
    mutationFn: (bookingId: string) => cancelFn({ data: { bookingId, refund: true } }),
    onSuccess: () => {
      toast.success(t("admin.classDetail.bookingCancelled"));
      qc.invalidateQueries({ queryKey: ["admin-class-bookings", id] });
      qc.invalidateQueries({ queryKey: ["admin-classes"] });
    },
  });

  const addMemberBooking = useMutation({
    mutationFn: (memberId: string) => createBookingFn({ data: { classId: id, memberId } }),
    onSuccess: (r: any) => {
      if (r.status === "booked") toast.success(t("admin.classDetail.memberAdded"));
      else toast.error(r.status ?? t("admin.classes.failed"));
      setShowAddMember(false);
      qc.invalidateQueries({ queryKey: ["admin-class-bookings", id] });
      qc.invalidateQueries({ queryKey: ["admin-classes"] });
    },
  });

  const promote = useMutation({
    mutationFn: (entryId: string) => waitlistPromoteFn({ data: { entryId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-waitlist", id] });
      qc.invalidateQueries({ queryKey: ["admin-class-bookings", id] });
      toast.success(t("admin.classDetail.waitlistPromoted"));
    },
  });
  const removeWait = useMutation({
    mutationFn: (entryId: string) => waitlistRemoveFn({ data: { entryId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-waitlist", id] }),
  });

  if (!cls) return <div className="h-40 rounded-3xl bg-secondary/40 animate-pulse" />;

  const hasBookings = cls.booked_count > 0;
  const d = new Date(cls.starts_at);
  const title = localizedClassTitle(cls, lang);
  const room = localizedRoomName(cls.room_ref?.name ?? cls.room, lang);
  const instructor = cls.instructor?.name
    ? localizedInstructorName(cls.instructor.name, lang)
    : t("common.unassigned");
  const clsStatus = statusLabel(cls.status, t);

  return (
    <div className="space-y-5">
      <Link to="/admin/classes" className="btn-ghost inline-flex text-sm hover:btn-ghost-hover">
        ← {t("admin.classDetail.back")}
      </Link>

      {!edit ? (
        <div className="editorial-card space-y-4 p-5 sm:p-6">
          <div className="space-y-2">
            <p className="eyebrow">{t("admin.classDetail.eyebrow")}</p>
            <h2 className="font-display text-2xl sm:text-3xl" dir="auto">
              <bdi>{title}</bdi>
            </h2>
            <p className="text-sm text-slate">
              {d.toLocaleString(locale, {
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>

          <div className="grid gap-3 text-sm text-slate sm:grid-cols-2 lg:grid-cols-4">
            <div className="member-card p-3">
              <p className="eyebrow">{t("common.where")}</p>
              <p className="mt-2 text-sm text-navy">{room}</p>
            </div>
            <div className="member-card p-3">
              <p className="eyebrow">{t("common.with")}</p>
              <p className="mt-2 text-sm text-navy">{instructor}</p>
            </div>
            <div className="member-card p-3">
              <p className="eyebrow">{t("common.duration")}</p>
              <p className="mt-2 text-sm text-navy">
                {cls.duration_minutes} {t("common.minutes")}
              </p>
            </div>
            <div className="member-card p-3">
              <p className="eyebrow">{t("admin.classes.creditCost")}</p>
              <p className="mt-2 text-sm text-navy">
                {cls.credit_cost} {cls.credit_cost === 1 ? t("common.credit") : t("common.credits")}
              </p>
            </div>
          </div>

          <p className="text-sm text-slate">
            {t("admin.classes.booked", { count: cls.booked_count })}/{cls.capacity} ·{" "}
            {t("admin.classes.waiting", { count: cls.waitlist_count })} · {clsStatus}
          </p>
          {cls.member_visible === false && (
            <p className="inline-flex rounded-full border border-navy/15 bg-navy/5 px-3 py-1 text-xs font-semibold text-navy">
              {t("admin.classes.staffOnly")}
            </p>
          )}
          <div className="flex gap-2 flex-wrap">
            <button onClick={startEdit} className="btn-navy hover:btn-navy-hover">
              {t("admin.classes.edit")}
            </button>
          </div>
        </div>
      ) : (
        <SessionForm
          mode="edit"
          form={form}
          setForm={setForm}
          data={{ instructors, settings, programs, rooms }}
          isPending={save.isPending}
          onCancel={() => setEdit(false)}
          onSubmit={() => save.mutate()}
          hasBookings={hasBookings}
        />
      )}

      {workflow ? (
        <AdminClassDangerZone
          classId={id}
          classTitle={title}
          startsAt={cls.starts_at}
          creditCost={cls.credit_cost}
          workflow={workflow}
          onDeleted={() => {
            navigate({ to: "/admin/classes" });
            qc.invalidateQueries({ queryKey: ["admin-classes"] });
          }}
          onCancelled={() => {
            qc.invalidateQueries({ queryKey: ["admin-classes"] });
            qc.invalidateQueries({ queryKey: ["admin-class-bookings", id] });
            qc.invalidateQueries({ queryKey: ["admin-waitlist", id] });
            qc.invalidateQueries({ queryKey: ["admin-class-workflow", id] });
            qc.invalidateQueries({ queryKey: ["admin-audit", "class", id] });
          }}
        />
      ) : null}

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-lg">
            {t("admin.classDetail.roster")} (
            {bookings?.filter((b: any) => b.status === "booked").length ?? 0})
          </h3>
          <button
            onClick={() => setShowAddMember((s) => !s)}
            className="btn-outline inline-flex items-center gap-1 text-sm hover:btn-outline-hover"
          >
            <UserPlus className="h-3 w-3" /> {t("admin.classDetail.addMember")}
          </button>
        </div>
        {showAddMember && (
          <div className="editorial-card mb-2 max-h-64 overflow-y-auto p-3">
            {members?.map((m: any) => (
              <button
                key={m.id}
                onClick={() => addMemberBooking.mutate(m.id)}
                className="w-full rounded-xl px-3 py-2 text-start text-sm transition-colors hover:bg-gold/6"
              >
                {m.name}{" "}
                <span className="text-xs text-slate">
                  · {m.remaining_credits} {t("common.credits")}
                </span>
              </button>
            ))}
          </div>
        )}
        {bookings?.length === 0 && <Empty>{t("admin.noBookings")}</Empty>}
        <div className="space-y-2">
          {bookings?.map((b: any) => (
            <div key={b.id} className="editorial-card flex items-center justify-between gap-3 p-3">
              <div>
                <p className="text-sm">{b.member?.name ?? "—"}</p>
                <p className="text-xs text-slate">
                  {statusLabel(b.status, t)} · {b.credit_cost}{" "}
                  {b.credit_cost === 1 ? t("common.credit") : t("common.credits")}
                </p>
              </div>
              {b.status === "booked" && (
                <button
                  onClick={() => {
                    if (confirm(t("admin.classDetail.cancelBookingConfirm"))) {
                      cancelBooking.mutate(b.id);
                    }
                  }}
                  className="btn-ghost p-2 hover:btn-ghost-hover"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-display text-lg">{t("admin.classDetail.waitlist")}</h3>
        {waitlist?.length === 0 && <Empty>{t("admin.noWaiting")}</Empty>}
        <div className="space-y-2">
          {waitlist?.map((w: any) => (
            <div key={w.id} className="editorial-card flex items-center justify-between gap-3 p-3">
              <div>
                <p className="text-sm">{w.member?.name ?? "—"}</p>
                <p className="text-xs text-slate">{statusLabel(w.status, t)}</p>
              </div>
              {w.status === "waiting" && (
                <div className="flex gap-1">
                  <button
                    onClick={() => promote.mutate(w.id)}
                    className="btn-outline p-2 hover:btn-outline-hover"
                  >
                    <ArrowUpCircle className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => removeWait.mutate(w.id)}
                    className="btn-ghost p-2 hover:btn-ghost-hover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-display text-lg">{t("admin.classDetail.activity")}</h3>
        <div className="space-y-1.5">
          {audit?.slice(0, 10).map((a: any) => (
            <div
              key={a.id}
              className="rounded-xl border border-gold/15 bg-white/80 px-3 py-2 text-xs text-slate"
            >
              {a.action} · {new Date(a.created_at).toLocaleString(locale)}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function statusLabel(status: string, t: any) {
  const key = `admin.classStatus.${status}`;
  const translated = t(key as any);
  return translated === key ? status : translated;
}
