import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listClasses,
  upsertClass,
  listInstructors,
  listBookings,
  listWaitlist,
  waitlistAdd,
  waitlistRemove,
  waitlistPromote,
  adminCancelBooking,
  listMembers,
  adminCreateBooking,
  listAudit,
} from "@/lib/admin.functions";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Field } from "./new";
import { Empty } from "@/components/admin-shared";
import { Trash2, ArrowUpCircle, UserPlus, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/classes/$id")({
  head: () => ({ meta: [{ title: "Class — Studio Admin" }] }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const classesFn = useServerFn(listClasses);
  const instructorsFn = useServerFn(listInstructors);
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

  const { data: classes } = useQuery({ queryKey: ["admin-classes"], queryFn: () => classesFn() });
  const cls = classes?.find((c: any) => c.id === id);
  const { data: instructors } = useQuery({
    queryKey: ["admin-instructors"],
    queryFn: () => instructorsFn(),
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

  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [showAddMember, setShowAddMember] = useState(false);

  function startEdit() {
    if (!cls) return;
    setForm({
      id: cls.id,
      title: cls.title,
      starts_at: new Date(cls.starts_at).toISOString().slice(0, 16),
      duration_minutes: cls.duration_minutes,
      capacity: cls.capacity,
      room: cls.room,
      energy: cls.energy,
      cancellation_window_hours: cls.cancellation_window_hours,
      credit_cost: cls.credit_cost,
      instructor_id: cls.instructor_id ?? "",
      status: cls.status,
    });
    setEdit(true);
  }

  const save = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          ...form,
          starts_at: new Date(form.starts_at).toISOString(),
          instructor_id: form.instructor_id || null,
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      setEdit(false);
      qc.invalidateQueries({ queryKey: ["admin-classes"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const cancelBooking = useMutation({
    mutationFn: (bookingId: string) => cancelFn({ data: { bookingId, refund: true } }),
    onSuccess: () => {
      toast.success("Cancelled");
      qc.invalidateQueries({ queryKey: ["admin-class-bookings", id] });
      qc.invalidateQueries({ queryKey: ["admin-classes"] });
    },
  });

  const addMemberBooking = useMutation({
    mutationFn: (memberId: string) => createBookingFn({ data: { classId: id, memberId } }),
    onSuccess: (r: any) => {
      if (r.status === "booked") toast.success("Added");
      else toast.error(r.status ?? "Failed");
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
      toast.success("Promoted");
    },
  });
  const removeWait = useMutation({
    mutationFn: (entryId: string) => waitlistRemoveFn({ data: { entryId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-waitlist", id] }),
  });

  if (!cls) return <div className="h-40 rounded-3xl bg-secondary/40 animate-pulse" />;

  const hasBookings = cls.booked_count > 0;
  const d = new Date(cls.starts_at);

  return (
    <div className="space-y-5">
      <Link to="/admin/classes" className="text-xs text-muted-foreground">
        ← All classes
      </Link>

      {!edit ? (
        <div className="rounded-2xl bg-card border border-border p-5">
          <h2 className="font-display text-2xl">{cls.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {d.toLocaleString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          <p className="text-sm text-muted-foreground">
            {cls.room} · {cls.energy} · {cls.duration_minutes} min · {cls.credit_cost} credit ·{" "}
            {cls.instructor?.name ?? "Unassigned"}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {cls.booked_count}/{cls.capacity} booked · {cls.waitlist_count} waiting · status{" "}
            {cls.status}
          </p>
          <button
            onClick={startEdit}
            className="mt-4 rounded-full bg-primary text-primary-foreground px-4 py-2 text-xs"
          >
            Edit
          </button>
        </div>
      ) : (
        <form
          className="space-y-3 rounded-2xl bg-card border border-border p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (hasBookings && !confirm("This class has bookings. Save changes anyway?")) return;
            save.mutate();
          }}
        >
          <Field label="Title">
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Starts at">
            <input
              className="input"
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Duration">
              <input
                className="input"
                type="number"
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: +e.target.value })}
              />
            </Field>
            <Field label="Capacity">
              <input
                className="input"
                type="number"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: +e.target.value })}
              />
            </Field>
          </div>
          <Field label="Instructor">
            <select
              className="input"
              value={form.instructor_id}
              onChange={(e) => setForm({ ...form, instructor_id: e.target.value })}
            >
              <option value="">— Unassigned —</option>
              {instructors?.map((i: any) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEdit(false)}
              className="flex-1 rounded-full border border-border bg-card py-2.5 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-full bg-primary text-primary-foreground py-2.5 text-sm"
            >
              Save
            </button>
          </div>
        </form>
      )}

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-lg">
            Roster ({bookings?.filter((b: any) => b.status === "booked").length ?? 0})
          </h3>
          <button
            onClick={() => setShowAddMember((s) => !s)}
            className="inline-flex items-center gap-1 text-xs rounded-full border border-border bg-card px-3 py-1.5"
          >
            <UserPlus className="h-3 w-3" /> Add member
          </button>
        </div>
        {showAddMember && (
          <div className="rounded-2xl bg-card border border-border p-3 mb-2 max-h-64 overflow-y-auto">
            {members?.map((m: any) => (
              <button
                key={m.id}
                onClick={() => addMemberBooking.mutate(m.id)}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-secondary text-sm"
              >
                {m.name}{" "}
                <span className="text-xs text-muted-foreground">
                  · {m.remaining_credits} credits
                </span>
              </button>
            ))}
          </div>
        )}
        {bookings?.length === 0 && <Empty>No bookings yet.</Empty>}
        <div className="space-y-2">
          {bookings?.map((b: any) => (
            <div
              key={b.id}
              className="rounded-2xl bg-card border border-border p-3 flex items-center justify-between"
            >
              <div>
                <p className="text-sm">{b.member?.name ?? "—"}</p>
                <p className="text-[11px] text-muted-foreground">
                  {b.status} · {b.credit_cost} credit
                </p>
              </div>
              {b.status === "booked" && (
                <button
                  onClick={() => {
                    if (confirm("Cancel this booking and refund?")) cancelBooking.mutate(b.id);
                  }}
                  className="p-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-display text-lg mb-2">Waitlist</h3>
        {waitlist?.length === 0 && <Empty>No one waiting.</Empty>}
        <div className="space-y-2">
          {waitlist?.map((w: any) => (
            <div
              key={w.id}
              className="rounded-2xl bg-card border border-border p-3 flex items-center justify-between"
            >
              <div>
                <p className="text-sm">{w.member?.name ?? "—"}</p>
                <p className="text-[11px] text-muted-foreground">{w.status}</p>
              </div>
              {w.status === "waiting" && (
                <div className="flex gap-1">
                  <button onClick={() => promote.mutate(w.id)} className="p-2 text-primary">
                    <ArrowUpCircle className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => removeWait.mutate(w.id)}
                    className="p-2 text-muted-foreground"
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
        <h3 className="font-display text-lg mb-2">Activity</h3>
        <div className="space-y-1.5">
          {audit?.slice(0, 10).map((a: any) => (
            <div
              key={a.id}
              className="text-xs text-muted-foreground rounded-xl bg-card border border-border px-3 py-2"
            >
              {a.action} · {new Date(a.created_at).toLocaleString()}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
