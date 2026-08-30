import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  (
    {
      className,
      dir,
      "aria-invalid": ariaInvalid,
      "aria-describedby": ariaDescribedBy,
      disabled,
      readOnly,
      ...props
    },
    ref,
  ) => {
    return (
      <textarea
        dir={dir ?? "auto"}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        readOnly={readOnly}
        className={cn(
          "flex min-h-[max(60px,var(--cc-target-min))] w-full rounded-[var(--cc-radius-input)] border border-input bg-[var(--color-surface)] px-4 py-2 text-start text-base shadow-[var(--shadow-card)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-[var(--cc-focus-outline)] focus-visible:outline-offset-[var(--cc-focus-offset)] disabled:cursor-not-allowed disabled:opacity-50 read-only:cursor-default read-only:bg-[var(--cc-surface-subtle)] md:text-base",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
