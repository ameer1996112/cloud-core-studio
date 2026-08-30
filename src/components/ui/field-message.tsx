import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const fieldMessageVariants = cva("mt-1.5 text-start text-[length:var(--text-sm)]", {
  variants: {
    tone: {
      help: "text-[var(--cc-text-secondary)]",
      error: "text-[var(--cc-state-danger)]",
    },
  },
  defaultVariants: {
    tone: "help",
  },
});

interface FieldMessageProps
  extends React.HTMLAttributes<HTMLParagraphElement>, VariantProps<typeof fieldMessageVariants> {
  id: string;
}

function FieldMessage({ id, tone = "help", className, children, ...props }: FieldMessageProps) {
  return (
    <p
      id={id}
      role={tone === "error" ? "alert" : undefined}
      className={cn(fieldMessageVariants({ tone }), className)}
      {...props}
    >
      {children}
    </p>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- variants are part of the UI primitive API.
export { FieldMessage, fieldMessageVariants, type FieldMessageProps };
