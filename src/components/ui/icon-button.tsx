import * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type IconButtonProps = Omit<ButtonProps, "children" | "size"> & {
  "aria-label": string;
  children: React.ReactNode;
  size?: "icon" | "sm";
};

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { "aria-label": label, className, variant = "secondary", size = "icon", children, ...props },
    ref,
  ) => {
    if (!label.trim()) {
      throw new Error("IconButton requires a non-empty aria-label.");
    }

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        aria-label={label}
        className={cn("cc-icon-button size-[var(--cc-target-min)] shrink-0 p-0", className)}
        {...props}
      >
        {children}
      </Button>
    );
  },
);
IconButton.displayName = "IconButton";

export { IconButton, type IconButtonProps };
