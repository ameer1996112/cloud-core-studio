import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, dir, ...props }, ref) => {
    return (
      <input
        type={type}
        dir={dir ?? "auto"}
        className={cn(
          "flex min-h-[var(--cc-control-height)] w-full rounded-[var(--cc-radius-input)] border border-input bg-[var(--color-surface)] px-4 py-2 text-base text-start text-foreground shadow-[var(--shadow-card)] transition-[border-color,box-shadow,background-color] duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-base",
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
