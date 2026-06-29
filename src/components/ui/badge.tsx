import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-gold/30 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-navy bg-navy text-ivory hover:bg-[var(--color-navy-elevated)]",
        secondary: "border-gold/30 bg-sand/40 text-navy hover:bg-sand/60",
        destructive:
          "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15",
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

export { Badge, badgeVariants };
