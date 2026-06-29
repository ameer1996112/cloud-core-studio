import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function LtrInline({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      dir="ltr"
      className={cn("member-ltr-value", className)}
      style={{ unicodeBidi: "isolate" }}
    >
      {children}
    </span>
  );
}

export function AutoInline({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span dir="auto" className={className} style={{ unicodeBidi: "isolate" }}>
      {children}
    </span>
  );
}

export function MixedLessonTitle({
  brand,
  program,
  className,
  as: Tag = "span",
  dir = "auto",
}: {
  brand?: string | null;
  program: string;
  className?: string;
  as?: ElementType;
  dir?: "rtl" | "ltr" | "auto";
}) {
  return (
    <Tag dir={dir} className={className}>
      {brand ? (
        <>
          <bdi>{brand}</bdi>
          <span aria-hidden="true"> — </span>
          <span dir="auto">{program}</span>
        </>
      ) : (
        <span dir="auto">{program}</span>
      )}
    </Tag>
  );
}
