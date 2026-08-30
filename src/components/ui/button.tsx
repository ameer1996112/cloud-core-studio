import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-[var(--cc-target-min)] items-center justify-center gap-2 whitespace-nowrap rounded-[var(--cc-radius-button)] border text-[length:var(--text-sm)] font-semibold tracking-normal cursor-pointer transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--cc-motion-fast)] focus-visible:outline-[var(--cc-focus-outline)] focus-visible:outline-offset-[var(--cc-focus-offset)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-[var(--cc-action-primary)] bg-[var(--cc-action-primary)] text-[var(--cc-action-primary-foreground)] hover:border-[var(--color-navy-strong)] hover:bg-[var(--color-navy-strong)] active:translate-y-px",
        destructive:
          "border-[color:color-mix(in_srgb,var(--cc-action-destructive)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--cc-action-destructive)_8%,var(--color-surface))] text-[var(--cc-action-destructive)] hover:border-[color:color-mix(in_srgb,var(--cc-action-destructive)_42%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--cc-action-destructive)_12%,var(--color-surface))]",
        outline:
          "border-gold/45 bg-[color:color-mix(in_srgb,var(--color-surface)_86%,transparent)] text-navy hover:border-gold/60 hover:bg-sand/46",
        secondary:
          "border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,var(--color-surface)_92%,transparent)] text-navy hover:border-gold/45 hover:bg-sand/36",
        ghost: "border-transparent bg-transparent text-slate hover:bg-gold/8 hover:text-navy",
        link: "border-transparent bg-transparent px-0 py-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "px-4 py-2",
        sm: "px-3 text-[length:var(--text-xs)]",
        lg: "px-8 text-[length:var(--text-base)]",
        icon: "size-[var(--cc-target-min)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonStateProps = {
  loading?: boolean;
  loadingLabel?: string;
};

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants>,
    ButtonStateProps {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      loadingLabel = "Loading",
      disabled,
      onClick,
      children,
      "aria-busy": ariaBusy,
      "aria-disabled": ariaDisabled,
      ...props
    }: ButtonProps,
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (loading) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      onClick?.(event);
    };

    const sharedProps = {
      className: cn(buttonVariants({ variant, size, className })),
      ref,
      "aria-busy": loading ? true : ariaBusy,
      "aria-disabled": loading ? true : ariaDisabled,
      disabled: disabled || loading,
      onClick: handleClick,
    };

    if (asChild && loading && React.isValidElement(children)) {
      return React.cloneElement(children, {
        ...props,
        ...children.props,
        ...sharedProps,
        children: (
          <>
            {children.props.children}
            <span className="sr-only">{loadingLabel}</span>
          </>
        ),
      });
    }

    return (
      <Comp {...sharedProps} {...props}>
        {children}
        {loading && <span className="sr-only">{loadingLabel}</span>}
      </Comp>
    );
  },
);
Button.displayName = "Button";

function ButtonGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("cc-button-group", className)} {...props} />;
}

function CardActionRow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("cc-card-action-row", className)} {...props} />;
}

function StickyActionBar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("cc-sticky-action-bar", className)} {...props} />;
}

// eslint-disable-next-line react-refresh/only-export-components -- variants are part of the UI primitive API.
export { Button, ButtonGroup, CardActionRow, StickyActionBar, buttonVariants };
export { IconButton } from "./icon-button";
