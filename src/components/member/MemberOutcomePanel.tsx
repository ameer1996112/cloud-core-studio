import * as React from "react";

import { PersistentAnnouncement } from "@/components/ui/sonner";
import type { MemberOutcome } from "@/lib/member-account-view-state";
import { cn } from "@/lib/utils";

type MemberOutcomePanelProps = Omit<React.HTMLAttributes<HTMLElement>, "title"> & {
  outcome: MemberOutcome;
  onAction?: () => void;
  showAction?: boolean;
  headingLevel?: "h1" | "h2";
};

const TONE_CLASSES: Record<MemberOutcome["tone"], string> = {
  neutral: "border-border bg-background text-foreground",
  info: "border-powder bg-powder/25 text-navy",
  success: "border-emerald-600/30 bg-emerald-50 text-emerald-950",
  warning: "border-gold/45 bg-gold/10 text-navy",
  danger: "border-destructive/30 bg-destructive/5 text-destructive",
};

function OutcomeAction({
  outcome,
  onAction,
}: Pick<MemberOutcomePanelProps, "outcome" | "onAction">) {
  if (!outcome.nextAction) return null;
  const className =
    "mt-3 inline-flex min-h-11 items-center rounded-full border border-current/25 px-4 py-2 text-sm font-semibold";

  if (onAction) {
    return (
      <button type="button" onClick={onAction} className={className}>
        {outcome.nextAction.label}
      </button>
    );
  }

  return (
    <a href={outcome.nextAction.href} className={className}>
      {outcome.nextAction.label}
    </a>
  );
}

export function MemberOutcomePanel({
  outcome,
  onAction,
  showAction = true,
  headingLevel = "h2",
  className,
  ...props
}: MemberOutcomePanelProps) {
  const action = showAction ? <OutcomeAction outcome={outcome} onAction={onAction} /> : null;
  const Heading = headingLevel;

  if (
    headingLevel === "h2" &&
    outcome.announce &&
    (outcome.tone === "success" || outcome.tone === "danger")
  ) {
    return (
      <PersistentAnnouncement
        {...props}
        tone={outcome.tone === "danger" ? "error" : "success"}
        title={outcome.title}
        className={className}
      >
        <p>{outcome.body}</p>
        {action}
      </PersistentAnnouncement>
    );
  }

  return (
    <section
      {...props}
      {...(outcome.announce ? { role: "status", "aria-live": "polite" as const } : {})}
      className={cn(
        "rounded-[var(--cc-radius-card)] border p-4 text-sm",
        TONE_CLASSES[outcome.tone],
        className,
      )}
    >
      <Heading
        className={cn(
          "font-semibold",
          headingLevel === "h1" && "font-display text-[clamp(2.3rem,10vw,3.5rem)] leading-none",
        )}
      >
        {outcome.title}
      </Heading>
      <p className="mt-1 leading-relaxed opacity-85">{outcome.body}</p>
      {action}
    </section>
  );
}
