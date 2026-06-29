import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--cc-radius-button)] text-[length:var(--text-sm)] font-semibold cursor-pointer transition-[background-color,border-color,color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-70 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-navy bg-navy text-ivory shadow-[var(--shadow-card)] hover:border-[var(--color-navy-strong)] hover:bg-[var(--color-navy-strong)] hover:shadow-[var(--shadow-elevated)] active:translate-y-px",
        destructive:
          "border border-destructive/25 bg-destructive/8 text-destructive hover:bg-destructive/12 hover:border-destructive/35",
        outline:
          "border border-gold/45 bg-[color:color-mix(in_srgb,var(--color-surface)_82%,transparent)] text-navy shadow-[var(--shadow-card)] hover:border-gold/60 hover:bg-sand/46",
        secondary:
          "border border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,var(--color-surface)_92%,transparent)] text-navy shadow-[var(--shadow-card)] hover:border-gold/45 hover:bg-sand/36",
        ghost: "border border-transparent text-slate hover:bg-gold/8 hover:text-navy",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-[var(--cc-control-height)] px-4 py-2",
        sm: "min-h-[var(--cc-control-height-sm)] px-3 text-[length:var(--text-xs)]",
        lg: "min-h-[var(--cc-control-height-lg)] px-8 text-[length:var(--text-base)]",
        icon: "h-[var(--cc-control-height-sm)] w-[var(--cc-control-height-sm)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
