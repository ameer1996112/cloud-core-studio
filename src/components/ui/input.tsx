import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  (
    {
      className,
      type,
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
      <input
        type={type}
        dir={dir ?? "auto"}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        readOnly={readOnly}
        className={cn(
          "flex min-h-[var(--cc-target-min)] w-full rounded-[var(--cc-radius-input)] border border-input bg-[var(--color-surface)] px-4 py-2 text-base text-start text-foreground shadow-[var(--shadow-card)] transition-[border-color,box-shadow,background-color] duration-[var(--cc-motion-fast)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[var(--color-text-muted)] focus-visible:outline-[var(--cc-focus-outline)] focus-visible:outline-offset-[var(--cc-focus-offset)] disabled:cursor-not-allowed disabled:opacity-50 read-only:cursor-default read-only:bg-[var(--cc-surface-subtle)] md:text-base",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
