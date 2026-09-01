import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A durable, in-context member feedback message.
 *
 * Use it for a result that must remain available after an action (for example,
 * a payment-session error or a submitted account-deletion request). Variants
 * are `info`, `success`, and `error`; `title` is required, while `children`
 * may provide a recovery link or action. It deliberately contains no business
 * logic. In RTL it inherits the nearest route direction; at mobile widths its
 * content stacks and wraps. Use `live="polite"` for non-urgent status and
 * `live="assertive"` only for an error requiring immediate attention.
 *
 * Do not use this as a decorative card or a transient toast replacement for a
 * non-critical update. Do not put a destructive action inside it.
 */
export const MemberFeedbackPanel = React.forwardRef<
  HTMLElement,
  {
    variant: "info" | "success" | "error";
    title: string;
    children: React.ReactNode;
    live?: "off" | "polite" | "assertive";
    className?: string;
  }
>(({ variant, title, children, live = "off", className }, ref) => {
  const styles = {
    info: "border-gold/35 bg-sand/25 text-navy",
    success: "border-gold/45 bg-gold/10 text-navy",
    error: "border-destructive/45 bg-destructive/8 text-navy",
  } as const;

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-live={live}
      role={variant === "error" && live === "assertive" ? "alert" : "status"}
      className={cn(
        "rounded-[var(--radius-md)] border p-4 text-start outline-none sm:p-5",
        styles[variant],
        className,
      )}
    >
      <h2 className="font-display text-xl leading-tight text-navy">{title}</h2>
      <div className="mt-2 text-sm leading-6 text-slate">{children}</div>
    </section>
  );
});

MemberFeedbackPanel.displayName = "MemberFeedbackPanel";
