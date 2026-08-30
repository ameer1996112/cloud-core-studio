import type { AsyncViewState } from "@/components/ui/async-state";
import { safeErrorMessage } from "@/lib/error-messages";

export function adminKpiViewState<T>({
  data,
  isLoading,
  isError,
  error,
  retry,
  loadingLabel,
  errorTitle,
  errorBody,
}: {
  data: T | null | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  retry: () => void;
  loadingLabel: string;
  errorTitle: string;
  errorBody: string;
}): AsyncViewState<T> {
  if (isLoading) return { status: "loading", label: loadingLabel };
  if (isError || data == null) {
    return {
      status: "error",
      title: errorTitle,
      body: safeErrorMessage(error, errorBody),
      retry,
    };
  }
  return { status: "ready", data };
}
