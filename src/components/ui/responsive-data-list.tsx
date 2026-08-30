import * as React from "react";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type ResponsiveDataListColumn<T> = {
  id: string;
  label: string;
  cell: (item: T, index: number) => React.ReactNode;
  className?: string;
};

interface ResponsiveDataListProps<T> extends React.HTMLAttributes<HTMLDivElement> {
  caption: string;
  columns: readonly ResponsiveDataListColumn<T>[];
  data: readonly T[];
  getRowKey: (item: T, index: number) => React.Key;
  empty?: React.ReactNode;
}

function ResponsiveDataList<T>({
  caption,
  columns,
  data,
  getRowKey,
  empty,
  className,
  ...props
}: ResponsiveDataListProps<T>) {
  if (data.length === 0 && empty) {
    return (
      <div className={className} {...props}>
        {empty}
      </div>
    );
  }

  return (
    <div className={className} {...props}>
      <div className="hidden md:block">
        <Table>
          <TableCaption>{caption}</TableCaption>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.id} scope="col" className={column.className}>
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow key={getRowKey(item, index)}>
                {columns.map((column) => (
                  <TableCell key={column.id} className={column.className}>
                    {column.cell(item, index)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {data.map((item, index) => (
          <article
            key={getRowKey(item, index)}
            aria-label={caption}
            className="rounded-[var(--cc-radius-card)] border border-border p-4"
          >
            <dl className="space-y-3">
              {columns.map((column) => (
                <div
                  key={column.id}
                  data-label={column.label}
                  className={cn("grid gap-1", column.className)}
                >
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {column.label}
                  </dt>
                  <dd className="text-sm text-foreground">{column.cell(item, index)}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}

export { ResponsiveDataList };
