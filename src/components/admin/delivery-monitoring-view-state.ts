import type { AsyncViewState } from "@/components/ui/async-state";
import { safeErrorMessage } from "@/lib/error-messages";

export function deliveryMomentCountViewState({
  totalMoments,
  isLoading,
  isError,
  error,
  retry,
  loadingLabel,
  errorTitle,
  errorBody,
}: {
  totalMoments: number | null | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  retry: () => void;
  loadingLabel: string;
  errorTitle: string;
  errorBody: string;
}): AsyncViewState<number> {
  if (isLoading) return { status: "loading", label: loadingLabel };
  if (isError) {
    return {
      status: "error",
      title: errorTitle,
      body: safeErrorMessage(error, errorBody),
      retry,
    };
  }
  return { status: "ready", data: totalMoments ?? 0 };
}
