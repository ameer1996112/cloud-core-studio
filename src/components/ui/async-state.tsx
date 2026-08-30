import * as React from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type AsyncViewState<T> =
  | { status: "loading"; label: string }
  | { status: "empty"; title: string; body: string; action?: React.ReactNode }
  | { status: "error"; title: string; body: string; retry?: () => void }
  | { status: "ready"; data: T };

interface AsyncStateProps<T> extends Omit<
  React.HTMLAttributes<HTMLElement>,
  "aria-busy" | "children"
> {
  state: AsyncViewState<T>;
  children?: React.ReactNode | ((data: T) => React.ReactNode);
}

function AsyncState<T>({ state, children, className, ...props }: AsyncStateProps<T>) {
  if (state.status === "ready") {
    return <>{typeof children === "function" ? children(state.data) : children}</>;
  }

  return (
    <section
      {...props}
      aria-busy={state.status === "loading"}
      className={cn("rounded-[var(--cc-radius-card)] border border-border p-5", className)}
    >
      {state.status === "loading" ? (
        <div role="status" aria-live="polite" className="space-y-3">
          <span className="sr-only">{state.label}</span>
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ) : (
        <div role="status" aria-live="polite" className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">{state.title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{state.body}</p>
          {state.status === "empty" ? state.action : null}
          {state.status === "error" && state.retry ? (
            <Button type="button" variant="outline" onClick={state.retry} className="mt-2">
              {t("common.retry")}
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}

export { AsyncState };
