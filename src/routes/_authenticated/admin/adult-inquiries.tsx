import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  Plus,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  cancelAdultTrialReservation,
  createAdultTrialHypCheckout,
  createAdultInquiry,
  finalizeAdultTrialAttendance,
  linkAdultProspectToMember,
  listAdultInquiryBoard,
  listAdultTrialClasses,
  offerAdultTrialClass,
  reconcileAdultTrialPayment,
  requestAdultTrialPayment,
  reserveAdultTrial,
  rescheduleAdultTrialReservation,
  setAdultTrialContinuation,
} from "@/lib/adultTrials.functions";
import { ADULT_INQUIRY_QUEUE_LABELS, adultInquiryQueue } from "@/lib/adultTrialPresentation";
import { SectionTitle } from "@/components/admin-shared";
import { BidiDateTime } from "@/components/ui/bidi";
import { bidiDirectionFor, formatBidiDateTime } from "@/lib/bidi-format";

export const Route = createFileRoute("/_authenticated/admin/adult-inquiries")({
  component: AdultInquiriesPage,
});

function actionKey(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`;
}

function AdultInquiriesPage() {
  const queryClient = useQueryClient();
  const boardFn = useServerFn(listAdultInquiryBoard);
  const classesFn = useServerFn(listAdultTrialClasses);
  const createFn = useServerFn(createAdultInquiry);
  const offerFn = useServerFn(offerAdultTrialClass);
  const reserveFn = useServerFn(reserveAdultTrial);
  const cancelFn = useServerFn(cancelAdultTrialReservation);
  const requestPaymentFn = useServerFn(requestAdultTrialPayment);
  const hypCheckoutFn = useServerFn(createAdultTrialHypCheckout);
  const rescheduleFn = useServerFn(rescheduleAdultTrialReservation);
  const reconcileFn = useServerFn(reconcileAdultTrialPayment);
  const attendanceFn = useServerFn(finalizeAdultTrialAttendance);
  const linkMemberFn = useServerFn(linkAdultProspectToMember);
  const continuationFn = useServerFn(setAdultTrialContinuation);
  const [form, setForm] = useState({
    contactName: "",
    phoneE164: "",
    email: "",
    service: "Adult aerial / Pilates",
    locality: "",
    source: "",
    attribution: "",
    primaryQuestion: "",
  });

  const board = useQuery({ queryKey: ["adult-inquiries"], queryFn: () => boardFn() });
  const classes = useQuery({
    queryKey: ["adult-trial-classes"],
    queryFn: () => classesFn({ data: {} }),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["adult-inquiries"] });

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          ...form,
          attributionEvidence: form.attribution ? { direct: form.attribution } : undefined,
          trialInterest: true,
          idempotencyKey: actionKey("inquiry"),
        },
      }),
    onSuccess: () => {
      setForm((value) => ({
        ...value,
        contactName: "",
        phoneE164: "",
        email: "",
        locality: "",
        source: "",
        attribution: "",
        primaryQuestion: "",
      }));
      toast.success("Adult inquiry created");
      refresh();
    },
    onError: () => toast.error("Could not create inquiry"),
  });

  return (
    <div className="space-y-6">
      <SectionTitle>Adult Inquiries</SectionTitle>
      <p className="max-w-3xl text-sm leading-6 text-slate">
        Assisted first trial flow. These prospects do not need an app account to reserve a class or
        record a trial payment.
      </p>

      <form
        className="editorial-card grid gap-3 p-4 sm:grid-cols-2 sm:p-5"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <div className="sm:col-span-2 flex items-center gap-2 text-navy">
          <Plus className="h-4 w-4" />
          <h2 className="font-display text-2xl">New adult inquiry</h2>
        </div>
        <Field
          label="Name"
          required
          value={form.contactName}
          onChange={(contactName) => setForm({ ...form, contactName })}
        />
        <Field
          label="Phone"
          type="tel"
          value={form.phoneE164}
          onChange={(phoneE164) => setForm({ ...form, phoneE164 })}
        />
        <Field
          label="Service"
          required
          value={form.service}
          onChange={(service) => setForm({ ...form, service })}
        />
        <Field
          label="Locality"
          value={form.locality}
          onChange={(locality) => setForm({ ...form, locality })}
        />
        <Field
          label="Source"
          placeholder="Instagram, referral, walk-in…"
          value={form.source}
          onChange={(source) => setForm({ ...form, source })}
        />
        <Field
          label="Email"
          type="email"
          value={form.email}
          onChange={(email) => setForm({ ...form, email })}
        />
        <Field
          label="Direct attribution evidence"
          placeholder="Exact campaign, ad, or referral reference"
          value={form.attribution}
          onChange={(attribution) => setForm({ ...form, attribution })}
        />
        <label className="grid gap-1.5 sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate">
            Question or friction
          </span>
          <textarea
            className="editorial-input min-h-20"
            value={form.primaryQuestion}
            onChange={(event) => setForm({ ...form, primaryQuestion: event.target.value })}
          />
        </label>
        <button className="btn-navy sm:col-span-2" disabled={create.isPending}>
          {create.isPending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <UsersRound className="h-4 w-4" />
          )}
          Create inquiry
        </button>
      </form>

      {board.isLoading ? <p className="text-sm text-slate">Loading inquiries…</p> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {(board.data ?? []).map((inquiry: any) => (
          <InquiryCard
            key={inquiry.id}
            inquiry={inquiry}
            classes={classes.data ?? []}
            onOffer={(classId, nextAction) =>
              offerFn({ data: { leadJourneyId: inquiry.id, classId, nextAction } }).then(() => {
                toast.success("Inquiry updated");
                refresh();
              })
            }
            onReserve={(classId, hold) =>
              reserveFn({
                data: {
                  leadJourneyId: inquiry.id,
                  classId,
                  holdExpiresAt: hold
                    ? new Date(Date.now() + 30 * 60_000).toISOString()
                    : undefined,
                  idempotencyKey: actionKey("reservation"),
                },
              }).then(() => {
                toast.success(hold ? "Trial hold created" : "Trial booked");
                refresh();
              })
            }
            onReschedule={(reservationId, classId) =>
              rescheduleFn({ data: { reservationId, classId } }).then(() => {
                toast.success("Trial rescheduled");
                refresh();
              })
            }
            onCancel={(reservationId) =>
              cancelFn({ data: { reservationId } }).then(() => {
                toast.success("Trial cancelled");
                refresh();
              })
            }
            onRequestPayment={(reservationId, method) => {
              if (method === "card") {
                return hypCheckoutFn({
                  data: { reservationId, idempotencyKey: actionKey("trial-hyp") },
                }).then((result: any) => {
                  if (result?.checkoutUrl)
                    window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
                  toast.success(
                    result?.checkoutUrl
                      ? "Verified HYP payment link created"
                      : "HYP is not configured",
                  );
                  refresh();
                });
              }
              return requestPaymentFn({
                data: {
                  reservationId,
                  method,
                  provider: "manual",
                  idempotencyKey: actionKey("trial-payment"),
                },
              }).then(() => {
                toast.success("Payment request recorded — reconcile before it counts as paid");
                refresh();
              });
            }}
            onReconcile={(paymentId) =>
              reconcileFn({ data: { paymentId } }).then(() => {
                toast.success("Payment reconciled");
                refresh();
              })
            }
            onAttendance={(reservationId, status) =>
              attendanceFn({ data: { reservationId, status } }).then(() => {
                toast.success("Attendance finalized");
                refresh();
              })
            }
            onContinuation={(outcome, packagePaymentId, trialPaymentId) =>
              continuationFn({
                data: {
                  leadJourneyId: inquiry.id,
                  outcome,
                  packagePaymentId,
                  trialPaymentId,
                },
              }).then(() => {
                toast.success("Continuation saved");
                refresh();
              })
            }
            onLinkMember={(memberId) =>
              linkMemberFn({ data: { leadJourneyId: inquiry.id, memberId } }).then(() => {
                toast.success("Prospect linked to the genuine member account");
                refresh();
              })
            }
          />
        ))}
      </div>
      {!board.isLoading && (board.data ?? []).length === 0 ? (
        <p className="editorial-card p-5 text-sm text-slate">No Adult inquiries yet.</p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate">{label}</span>
      <input
        required={required}
        type={type}
        placeholder={placeholder}
        className="editorial-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function InquiryCard({
  inquiry,
  classes,
  onOffer,
  onReserve,
  onReschedule,
  onCancel,
  onRequestPayment,
  onReconcile,
  onAttendance,
  onContinuation,
  onLinkMember,
}: any) {
  const [classId, setClassId] = useState(inquiry.offered_class_id ?? "");
  const [memberId, setMemberId] = useState(inquiry.linked_member_id ?? "");
  const [packagePaymentId, setPackagePaymentId] = useState("");
  const [working, setWorking] = useState(false);
  const reservation = useMemo(
    () =>
      (inquiry.reservations ?? []).find((row: any) => ["hold", "booked"].includes(row.state)) ??
      inquiry.reservations?.[0] ??
      null,
    [inquiry.reservations],
  );
  const payment = reservation?.payments?.[0] ?? null;
  const queue = adultInquiryQueue({
    reservationState: reservation?.state ?? null,
    classStartsAt: reservation?.class?.starts_at ?? inquiry.offered_class?.starts_at ?? null,
    attendanceStatus: reservation?.attendance_status ?? null,
    paymentStatus: payment?.status ?? null,
    continuationOutcome: inquiry.continuation_outcome,
    nextAction: inquiry.next_action,
    inquiryCreatedAt: inquiry.created_at,
  });
  const relevantClasses = classes.filter(
    (row: any) =>
      !inquiry.service ||
      `${row.title} ${row.program_type?.name_en ?? ""} ${row.program_type?.name_he ?? ""} ${row.program_type?.name_ar ?? ""}`
        .toLowerCase()
        .includes(String(inquiry.service).toLowerCase()) ||
      inquiry.service === "Adult aerial / Pilates",
  );
  const run = async (action: () => Promise<unknown>) => {
    setWorking(true);
    try {
      await action();
    } catch {
      toast.error("Action could not be completed");
    } finally {
      setWorking(false);
    }
  };

  return (
    <article className="editorial-card space-y-4 p-4 sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="cc-card-title">
            <bdi>{inquiry.recipient?.display_name ?? "Adult prospect"}</bdi>
          </h2>
          <p className="mt-1 text-sm text-slate">
            {inquiry.service || "Adult trial"}
            {inquiry.locality ? ` · ${inquiry.locality}` : ""}
            {inquiry.source ? ` · ${inquiry.source}` : ""}
          </p>
        </div>
        <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-xs font-semibold text-navy">
          {ADULT_INQUIRY_QUEUE_LABELS[queue]}
        </span>
      </header>
      {inquiry.primary_question ? (
        <p className="rounded-lg bg-sand/25 p-3 text-sm text-slate">{inquiry.primary_question}</p>
      ) : null}
      <div className="grid gap-2 text-sm text-slate sm:grid-cols-2">
        <span>
          {inquiry.recipient?.phone_e164 || inquiry.recipient?.email || "No contact detail"}
        </span>
        <span>
          {reservation?.class ? (
            <>
              {reservation.class.title} · <BidiDateTime value={reservation.class.starts_at} />
            </>
          ) : inquiry.offered_class ? (
            <>
              {inquiry.offered_class.title} ·{" "}
              <BidiDateTime value={inquiry.offered_class.starts_at} />
            </>
          ) : (
            "No class offered"
          )}
        </span>
      </div>
      {!reservation ? (
        <div className="grid gap-2">
          <select
            className="editorial-input"
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
          >
            <option value="">Choose a published class</option>
            {relevantClasses.map((row: any) => (
              <option key={row.id} value={row.id}>
                {row.title} · {formatBidiDateTime(row.starts_at)}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-outline"
              disabled={!classId || working}
              onClick={() => run(() => onOffer(classId, "offer_class"))}
            >
              <CalendarDays className="h-4 w-4" />
              Offer class
            </button>
            <button
              type="button"
              className="btn-navy"
              disabled={!classId || working}
              onClick={() => run(() => onReserve(classId, false))}
            >
              Book assisted trial
            </button>
            <button
              type="button"
              className="btn-outline"
              disabled={!classId || working}
              onClick={() => run(() => onReserve(classId, true))}
            >
              Hold 30 min
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={working}
              onClick={() => run(() => onOffer(undefined, "waiting_suitable_time"))}
            >
              Wait for suitable time
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={working}
              onClick={() => run(() => onOffer(undefined, "waiting_next_schedule"))}
            >
              Wait for next schedule
            </button>
          </div>
        </div>
      ) : null}
      {reservation && !reservation.attendance_status ? (
        <div className="grid gap-2 border-t border-gold/15 pt-3">
          <select
            className="editorial-input"
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
          >
            <option value="">Reschedule to another published class</option>
            {relevantClasses
              .filter((row: any) => row.id !== reservation.class_id)
              .map((row: any) => (
                <option key={row.id} value={row.id}>
                  {row.title} · {formatBidiDateTime(row.starts_at)}
                </option>
              ))}
          </select>
          <button
            type="button"
            className="btn-outline w-fit"
            disabled={!classId || classId === reservation.class_id || working}
            onClick={() => run(() => onReschedule(reservation.id, classId))}
          >
            Reschedule trial
          </button>
        </div>
      ) : null}
      {reservation && !reservation.attendance_status ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-outline"
            disabled={working}
            onClick={() => run(() => onRequestPayment(reservation.id, "bit"))}
          >
            Request Bit ₪80
          </button>
          <button
            type="button"
            className="btn-outline"
            disabled={working}
            onClick={() => run(() => onRequestPayment(reservation.id, "cash"))}
          >
            Request cash ₪80
          </button>
          <button
            type="button"
            className="btn-outline"
            disabled={working}
            onClick={() => run(() => onRequestPayment(reservation.id, "card"))}
          >
            <CreditCard className="h-4 w-4" />
            Create HYP request
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={working}
            onClick={() => run(() => onCancel(reservation.id))}
          >
            Cancel / release
          </button>
        </div>
      ) : null}
      {payment &&
      payment.status !== "paid" &&
      payment.provider === "manual" &&
      ["bit", "cash"].includes(payment.method) ? (
        <div className="rounded-lg border border-gold/30 bg-gold/10 p-3 text-sm text-navy">
          Payment is {payment.status}; it does not count as paid until explicit reconciliation or
          verified HYP confirmation.
          <button
            type="button"
            className="btn-navy ms-3"
            disabled={working}
            onClick={() => run(() => onReconcile(payment.id))}
          >
            Reconcile received payment
          </button>
        </div>
      ) : null}
      {reservation && !reservation.attendance_status ? (
        <div className="flex flex-wrap gap-2 border-t border-gold/15 pt-3">
          <button
            type="button"
            className="btn-navy"
            disabled={working}
            onClick={() => run(() => onAttendance(reservation.id, "attended"))}
          >
            <CheckCircle2 className="h-4 w-4" />
            Attended
          </button>
          <button
            type="button"
            className="btn-outline"
            disabled={working}
            onClick={() => run(() => onAttendance(reservation.id, "no_show"))}
          >
            No-show
          </button>
          <button
            type="button"
            className="btn-outline"
            disabled={working}
            onClick={() => run(() => onAttendance(reservation.id, "cancelled"))}
          >
            Cancelled
          </button>
        </div>
      ) : null}
      {reservation?.attendance_status === "attended" &&
      inquiry.continuation_outcome !== "purchased" ? (
        <div className="flex flex-wrap gap-2 border-t border-gold/15 pt-3">
          <span className="self-center text-sm font-medium text-navy">Continuation:</span>
          <button
            type="button"
            className="btn-outline"
            disabled={working}
            onClick={() => run(() => onContinuation("pending"))}
          >
            Pending
          </button>
          <button
            type="button"
            className="btn-outline"
            disabled={working}
            onClick={() => run(() => onContinuation("did_not_purchase"))}
          >
            Did not purchase
          </button>
          <button
            type="button"
            className="btn-outline"
            disabled={working}
            onClick={() => run(() => onContinuation("unknown"))}
          >
            Unknown
          </button>
        </div>
      ) : null}
      {reservation?.attendance_status === "attended" && !inquiry.linked_member_id ? (
        <div className="grid gap-2 border-t border-gold/15 pt-3 sm:grid-cols-[1fr_auto]">
          <input
            className="editorial-input"
            value={memberId}
            onChange={(event) => setMemberId(event.target.value)}
            placeholder="Genuine member UUID after sign-up"
          />
          <button
            type="button"
            className="btn-outline"
            disabled={!memberId || working}
            onClick={() => run(() => onLinkMember(memberId))}
          >
            Link genuine member
          </button>
        </div>
      ) : null}
      {reservation?.attendance_status === "attended" && inquiry.linked_member_id ? (
        <div className="grid gap-2 border-t border-gold/15 pt-3 sm:grid-cols-[1fr_auto]">
          <input
            className="editorial-input"
            dir={bidiDirectionFor("identifier")}
            value={packagePaymentId}
            onChange={(event) => setPackagePaymentId(event.target.value)}
            placeholder="Verified package payment UUID"
          />
          <button
            type="button"
            className="btn-navy"
            disabled={!packagePaymentId || working}
            onClick={() =>
              run(() =>
                onContinuation(
                  "purchased",
                  packagePaymentId,
                  payment?.status === "paid" ? payment.id : undefined,
                ),
              )
            }
          >
            Confirm package purchased
          </button>
        </div>
      ) : null}
    </article>
  );
}
