import { ReviewButton } from "@/components/member/design/VisualSystem";
import type { ReactNode } from "react";
import type { BookingViewState } from "@/lib/booking-view-state";

export function BookingActionPanel({
  state,
  onAction,
  onRetry,
  actionSlot,
  showAction = true,
  showSummary = true,
  bare = false,
  seatClassName = "font-medium text-navy",
  summaryClassName = "text-slate",
  className = "",
}: {
  state: BookingViewState;
  onAction?: () => void;
  onRetry?: () => void;
  actionSlot?: ReactNode;
  showAction?: boolean;
  showSummary?: boolean;
  bare?: boolean;
  seatClassName?: string;
  summaryClassName?: string;
  className?: string;
}) {
  const { action, outcome } = state;
  const supportingCopy =
    action.kind === "join-waitlist"
      ? action.explanation
      : action.kind === "recover" || action.kind === "unavailable"
        ? action.reason
        : action.kind === "manage"
          ? action.cancellationDeadline
          : undefined;

  return (
    <section
      className={`${
        bare
          ? "space-y-2 text-sm"
          : "space-y-2 rounded-2xl border border-gold/25 bg-white/65 p-3 text-sm"
      } ${className}`.trim()}
      aria-label={action.kind === "manage" ? action.label : undefined}
    >
      <div aria-live="polite" aria-atomic="true" className="space-y-1">
        {action.kind === "pending" ? <span className="sr-only">{action.label}</span> : null}
        {showSummary && state.seatCopy ? <p className={seatClassName}>{state.seatCopy}</p> : null}
        {showSummary && state.consequence ? (
          <p className={summaryClassName}>{state.consequence}</p>
        ) : null}
        {showSummary && supportingCopy ? (
          <p className={summaryClassName}>{supportingCopy}</p>
        ) : null}
      </div>

      {outcome ? (
        <div
          role={outcome.kind === "failure" ? "alert" : "status"}
          className={`rounded-xl border px-3 py-2 ${
            outcome.kind === "failure"
              ? "border-rose-300/60 bg-rose-50 text-navy"
              : "border-gold/35 bg-gold/10 text-navy"
          }`}
        >
          <p className="font-semibold">{outcome.message}</p>
          <p className="mt-1 text-xs text-slate">{outcome.context}</p>
          {outcome.details?.map((detail) => (
            <p key={detail} className="mt-1 text-xs text-slate">
              {detail}
            </p>
          ))}
          {outcome.recovery?.kind === "retry" && onRetry ? (
            <ReviewButton
              type="button"
              onClick={onRetry}
              variant="ghost"
              className="btn-ghost mt-2 min-h-10 px-0 text-xs hover:btn-ghost-hover"
            >
              {outcome.recovery.label}
            </ReviewButton>
          ) : outcome.recovery?.kind === "link" ? (
            <a
              href={outcome.recovery.href}
              className="btn-ghost mt-2 inline-flex min-h-10 items-center px-0 text-xs hover:btn-ghost-hover"
            >
              {outcome.recovery.label}
            </a>
          ) : null}
        </div>
      ) : null}

      {showAction
        ? (actionSlot ??
          (action.kind === "recover" ? (
            <a
              href={action.href}
              className="cc-button cc-button--primary flex w-full justify-center hover:btn-navy-hover"
            >
              {action.label}
            </a>
          ) : action.kind === "unavailable" ? null : (
            <ReviewButton
              type="button"
              onClick={onAction}
              disabled={state.actionLocked || !onAction}
              className="btn-navy w-full justify-center hover:btn-navy-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {action.label}
            </ReviewButton>
          )))
        : null}
    </section>
  );
}
