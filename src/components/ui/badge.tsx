import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors duration-[var(--cc-motion-fast)] focus-visible:outline-[var(--cc-focus-outline)] focus-visible:outline-offset-[var(--cc-focus-offset)]",
  {
    variants: {
      variant: {
        default:
          "border-[var(--cc-action-primary)] bg-[var(--cc-action-primary)] text-[var(--cc-action-primary-foreground)] hover:bg-[var(--color-navy-elevated)]",
        secondary: "border-gold/30 bg-sand/40 text-navy hover:bg-sand/60",
        destructive:
          "border-[color:color-mix(in_srgb,var(--cc-state-danger)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--cc-state-danger)_10%,var(--color-surface))] text-[var(--cc-state-danger)] hover:bg-[color:color-mix(in_srgb,var(--cc-state-danger)_15%,var(--color-surface))]",
        outline: "border-gold/35 bg-white/70 text-navy",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// eslint-disable-next-line react-refresh/only-export-components -- variants are part of the UI primitive API.
export { Badge, badgeVariants };
