import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-[var(--cc-control-height)] items-center justify-center gap-2 whitespace-nowrap rounded-[var(--cc-radius-button)] border text-[length:var(--text-sm)] font-semibold tracking-normal cursor-pointer transition-[background-color,border-color,color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-navy bg-navy text-ivory hover:border-[var(--color-navy-strong)] hover:bg-[var(--color-navy-strong)] active:translate-y-px",
        destructive:
          "border-[color:color-mix(in_srgb,var(--color-danger)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--color-danger)_8%,var(--color-surface))] text-[var(--color-danger)] hover:border-[color:color-mix(in_srgb,var(--color-danger)_42%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--color-danger)_12%,var(--color-surface))]",
        outline:
          "border-gold/45 bg-[color:color-mix(in_srgb,var(--color-surface)_86%,transparent)] text-navy hover:border-gold/60 hover:bg-sand/46",
        secondary:
          "border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,var(--color-surface)_92%,transparent)] text-navy hover:border-gold/45 hover:bg-sand/36",
        ghost: "border-transparent bg-transparent text-slate hover:bg-gold/8 hover:text-navy",
        link: "min-h-0 border-transparent bg-transparent px-0 py-0 text-primary underline-offset-4 hover:underline",
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

type IconButtonProps = Omit<ButtonProps, "children" | "size"> & {
  "aria-label": string;
  children: React.ReactNode;
  size?: "icon" | "sm";
};

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = "secondary", size = "icon", children, ...props }, ref) => (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn("cc-icon-button shrink-0 p-0", className)}
      {...props}
    >
      {children}
    </Button>
  ),
);
IconButton.displayName = "IconButton";

function ButtonGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("cc-button-group", className)} {...props} />;
}

function CardActionRow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("cc-card-action-row", className)} {...props} />;
}

function StickyActionBar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("cc-sticky-action-bar", className)} {...props} />;
}

export { Button, IconButton, ButtonGroup, CardActionRow, StickyActionBar, buttonVariants };
