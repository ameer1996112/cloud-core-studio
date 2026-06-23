import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Clock, MapPin, Sparkles, Users, X } from "lucide-react";
import { getClassDetail, joinWaitlist, leaveWaitlist } from "@/lib/member.functions";
import { bookClass } from "@/lib/cloud-core.functions";
import {
  ClassImage,
  deriveClassState,
  formatTime,
  formatDate,
  StateBadge,
} from "./PremiumClassCard";
import { t } from "@/lib/i18n";

export function ClassDetailSheet({
  classId,
  open,
  onOpenChange,
}: {
  classId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const fetchDetail = useServerFn(getClassDetail);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirmation, setConfirmation] = useState<null | { bookingId: string; remaining: number }>(
    null,
  );

  const { data, isLoading } = useQuery({
    queryKey: ["class-detail", classId],
    queryFn: () => fetchDetail({ data: { classId: classId! } }),
    enabled: !!classId && open,
  });

  const bookFn = useServerFn(bookClass);
  const joinFn = useServerFn(joinWaitlist);
  const leaveFn = useServerFn(leaveWaitlist);

  const book = useMutation({
    mutationFn: () => bookFn({ data: { classId: classId! } }),
    onSuccess: (res: any) => {
      if (res.status === "booked") {
        toast.success(t("booking.toast.booked"));
        setConfirmation({ bookingId: res.booking_id, remaining: res.remaining_credits ?? 0 });
        qc.invalidateQueries({ queryKey: ["member-home"] });
        qc.invalidateQueries({ queryKey: ["member-schedule"] });
        qc.invalidateQueries({ queryKey: ["my-bookings-all"] });
        qc.invalidateQueries({ queryKey: ["studio-pulse"] });
      } else if (res.status === "already_booked") {
        toast(t("booking.toast.already"));
      } else if (res.status === "full") {
        toast(t("booking.toast.full"));
      } else if (res.status === "insufficient_credits") {
        toast(t("booking.toast.credits"));
      } else {
        toast(t("booking.toast.error"));
      }
    },
  });

  const join = useMutation({
    mutationFn: () => joinFn({ data: { classId: classId! } }),
    onSuccess: (res: any) => {
      if (res.status === "waiting" || res.status === "already_waiting") {
        toast.success(t("booking.toast.waiting", { position: res.position }));
        qc.invalidateQueries({ queryKey: ["class-detail", classId] });
        qc.invalidateQueries({ queryKey: ["my-bookings-all"] });
      } else {
        toast(t("booking.toast.waitlistError"));
      }
    },
  });

  const leave = useMutation({
    mutationFn: (entryId: string) => leaveFn({ data: { entryId } }),
    onSuccess: () => {
      toast.success(t("booking.toast.left"));
      qc.invalidateQueries({ queryKey: ["class-detail", classId] });
      qc.invalidateQueries({ queryKey: ["my-bookings-all"] });
    },
  });

  const cls = data?.cls;
  const state = cls
    ? deriveClassState(cls, {
        booked: data?.myBooking?.status === "booked",
        waiting: data?.myWaitlist?.status === "waiting" || data?.myWaitlist?.status === "ready",
        remainingCredits: data?.member?.remaining_credits ?? 0,
      })
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setConfirmation(null);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-xl p-0 overflow-hidden gap-0 bg-ivory border-gold/30">
        <DialogTitle className="sr-only">{t("booking.details")}</DialogTitle>
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 z-50 h-9 w-9 rounded-full bg-white/90 border border-gold/40 flex items-center justify-center hover:bg-white"
        >
          <X className="h-4 w-4 text-navy" />
        </button>

        {confirmation && cls ? (
          <ConfirmationView
            cls={cls}
            confirmation={confirmation}
            onDone={() => {
              setConfirmation(null);
              onOpenChange(false);
              navigate({ to: "/member/bookings" });
            }}
          />
        ) : isLoading || !cls ? (
          <div className="h-80 skeleton-brand" />
        ) : (
          <>
            <ClassImage
              cls={cls}
              variant="hero"
              eager
              className="w-full aspect-[21/9] min-h-[220px] max-h-[420px]"
            >
              <div
                className="absolute inset-x-0 bottom-0 top-1/3 z-[2] bg-linear-to-t from-navy/80 via-navy/35 to-transparent pointer-events-none"
                aria-hidden
              />
              <div className="absolute bottom-4 left-5 right-5 text-ivory z-10">
                <p className="text-[10px] uppercase tracking-[0.3em] opacity-90">
                  {formatDate(cls.starts_at)} · {formatTime(cls.starts_at)}
                </p>
                <h2 className="font-display text-3xl mt-1 leading-tight text-ivory drop-shadow-[0_1px_2px_rgba(11,29,58,0.65)]">
                  {cls.title}
                </h2>
                {cls.program_type?.name_en && (
                  <p className="text-xs opacity-90 mt-1">
                    {cls.program_type.name_en}{" "}
                    {cls.program_type?.level ? `· ${cls.program_type.level}` : ""}
                  </p>
                )}
              </div>
            </ClassImage>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh]">
              <div className="flex items-center justify-between">
                {state && <StateBadge state={state} />}
                <span className="member-eyebrow">
                  {cls.duration_minutes} {t("common.minutes")} · {cls.credit_cost}{" "}
                  {cls.credit_cost === 1 ? t("common.credit") : t("common.credits")}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <Stat
                  icon={<Sparkles className="h-3 w-3 text-gold" />}
                  label={t("common.with")}
                  value={cls.instructor?.name ?? "—"}
                />
                <Stat
                  icon={<MapPin className="h-3 w-3 text-gold" />}
                  label={t("common.room")}
                  value={cls.room_ref?.name ?? cls.room ?? "—"}
                />
                <Stat
                  icon={<Users className="h-3 w-3 text-gold" />}
                  label={t("common.spots")}
                  value={`${Math.max(0, cls.capacity - cls.booked_count)}/${cls.capacity}`}
                />
              </div>

              {cls.program_type?.description_en && (
                <p className="text-sm text-slate leading-relaxed">
                  {cls.program_type.description_en}
                </p>
              )}

              <div className="member-panel-sand p-4 text-xs text-slate space-y-1">
                <p className="member-eyebrow">{t("booking.notes")}</p>
                <p className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-gold" />{" "}
                  {t("booking.cancelWindow", { hours: cls.cancellation_window_hours })}
                </p>
                <p>{t("booking.bring")}</p>
              </div>

              <div className="pt-2 border-t hairline">
                {data?.myBooking?.status === "booked" ? (
                  <Link to="/member/bookings" className="btn-navy w-full hover:btn-navy-hover">
                    {t("booking.viewMine")} <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : state?.kind === "waiting" && data?.myWaitlist?.id ? (
                  <button
                    onClick={() => leave.mutate(data.myWaitlist!.id)}
                    className="btn-ghost w-full hover:btn-ghost-hover"
                  >
                    {t("booking.leaveWaitlist")}
                  </button>
                ) : state?.kind === "waitlist_available" ? (
                  <button
                    onClick={() => join.mutate()}
                    disabled={join.isPending}
                    className="btn-navy w-full hover:btn-navy-hover disabled:opacity-60"
                  >
                    {join.isPending ? "…" : t("booking.joinWaitlist")}
                  </button>
                ) : state?.kind === "low_credits" ? (
                  <Link to="/member/packages" className="btn-navy w-full hover:btn-navy-hover">
                    {t("booking.choosePackage")}
                  </Link>
                ) : state?.kind === "closed" || state?.kind === "cancelled" ? (
                  <button disabled className="btn-ghost w-full opacity-60 cursor-not-allowed">
                    {t("booking.registrationClosed")}
                  </button>
                ) : (
                  <button
                    onClick={() => book.mutate()}
                    disabled={book.isPending}
                    className="btn-navy w-full hover:btn-navy-hover disabled:opacity-60"
                  >
                    {book.isPending
                      ? t("booking.saving")
                      : t(cls.credit_cost === 1 ? "booking.bookCredit" : "booking.bookCredits", {
                          count: cls.credit_cost,
                        })}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="member-card p-3">
      <p className="member-eyebrow flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-display italic text-base text-navy truncate">{value}</p>
    </div>
  );
}

function ConfirmationView({
  cls,
  confirmation,
  onDone,
}: {
  cls: any;
  confirmation: { bookingId: string; remaining: number };
  onDone: () => void;
}) {
  const code = confirmation.bookingId.slice(0, 6).toUpperCase();
  return (
    <div className="p-6 sm:p-8 space-y-5">
      <div className="text-center space-y-3">
        <div className="member-panel-powder mx-auto h-14 w-14 rounded-full flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-gold" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-gold">{t("booking.cloudCard")}</p>
        <h2 className="font-display italic text-3xl text-navy leading-tight">
          {t("booking.saved")}
        </h2>
      </div>

      {/* The card itself — premium, print-friendly look */}
      <div
        className="relative overflow-hidden rounded-[6px] border border-gold/40 bg-ivory shadow-[0_1px_0_rgba(212,175,106,0.4),0_24px_60px_-30px_rgba(11,29,58,0.35)]"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(183,204,230,0.18), rgba(232,223,209,0.25) 60%, rgba(212,175,106,0.12))",
        }}
      >
        <div className="absolute inset-x-5 top-0 h-px bg-gold/30" />
        <div className="px-5 sm:px-6 py-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate">
                {t("booking.confirmed")}
              </p>
              <p className="font-display text-2xl text-navy mt-1 leading-tight truncate">
                {cls.title}
              </p>
            </div>
            <div className="shrink-0 text-end">
              <p className="text-[9px] uppercase tracking-[0.3em] text-slate">{t("common.code")}</p>
              <p className="font-mono text-sm tracking-[0.2em] text-navy mt-0.5">{code}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <CardField
              label={t("common.when")}
              value={`${formatDate(cls.starts_at)} · ${formatTime(cls.starts_at)}`}
            />
            <CardField
              label={t("common.duration")}
              value={`${cls.duration_minutes} ${t("common.minutes")}`}
            />
            <CardField label={t("common.room")} value={cls.room_ref?.name ?? cls.room ?? "—"} />
            <CardField label={t("common.with")} value={cls.instructor?.name ?? "—"} />
          </div>

          <div className="flex items-center justify-between pt-3 border-t hairline text-[11px] text-slate">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-gold" />
              {t("booking.cancelWindow", { hours: cls.cancellation_window_hours }).replace(
                /\.$/,
                "",
              )}
            </span>
            <span className="text-navy">
              {t("booking.left", { count: confirmation.remaining })}
            </span>
          </div>
        </div>
        <div className="absolute inset-x-5 bottom-0 h-px bg-gold/30" />
      </div>

      <p className="text-center text-[11px] text-slate font-display italic">
        {t("booking.savedLine")}
      </p>

      <button onClick={onDone} className="btn-navy w-full hover:btn-navy-hover">
        {t("booking.viewBookings")} <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}

function CardField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.25em] text-slate">{label}</p>
      <p className="font-display text-sm text-navy mt-0.5 truncate">{value}</p>
    </div>
  );
}
