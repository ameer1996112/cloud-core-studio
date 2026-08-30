import { Fragment, type ElementType, type ReactNode } from "react";

import {
  bidiDateTimeSegments,
  bidiDirectionFor,
  embeddedBidiSegments,
  type BidiKind,
} from "@/lib/bidi-format";
import { cn } from "@/lib/utils";

export function BidiValue({
  kind,
  children,
  className,
}: {
  kind: BidiKind;
  children: ReactNode;
  className?: string;
}) {
  return (
    <bdi dir={bidiDirectionFor(kind)} className={className}>
      {children}
    </bdi>
  );
}

export function BidiDateTime({
  value,
  locales,
  options,
}: {
  value: Date | string | number;
  locales?: Intl.LocalesArgument;
  options?: Intl.DateTimeFormatOptions;
}) {
  return bidiDateTimeSegments(value, locales, options).map((segment, index) =>
    segment.kind ? (
      <BidiValue key={index} kind={segment.kind}>
        {segment.value}
      </BidiValue>
    ) : (
      <Fragment key={index}>{segment.value}</Fragment>
    ),
  );
}

export function EmbeddedContactText({ text }: { text: string }) {
  return embeddedBidiSegments(text).map((segment, index) =>
    segment.kind ? (
      <BidiValue key={index} kind={segment.kind}>
        {segment.value}
      </BidiValue>
    ) : (
      <Fragment key={index}>{segment.value}</Fragment>
    ),
  );
}

export function LtrInline({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <BidiValue kind="identifier" className={cn("member-ltr-value", className)}>
      {children}
    </BidiValue>
  );
}

export function AutoInline({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <BidiValue kind="currency" className={className}>
      {children}
    </BidiValue>
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
