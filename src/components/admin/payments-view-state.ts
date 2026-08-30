import type { AsyncViewState } from "@/components/ui/async-state";
import { safeErrorMessage } from "@/lib/error-messages";

type QuerySnapshot<T> = {
  data: T | null | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
};

type LocalizedQueryCopy = {
  loadingLabel: string;
  errorTitle: string;
  errorBody: string;
};

export function paymentAuxiliaryViewState<T>({
  data,
  isLoading,
  isError,
  error,
  retry,
  loadingLabel,
  errorTitle,
  errorBody,
}: QuerySnapshot<T> & LocalizedQueryCopy & { retry: () => void }): AsyncViewState<T> {
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

export function paymentSummaryViewState<TPayment, TSummary>({
  payments,
  summary,
  retry,
  loadingLabel,
  errorTitle,
  errorBody,
}: {
  payments: QuerySnapshot<TPayment>;
  summary: QuerySnapshot<TSummary>;
  retry: () => void;
} & LocalizedQueryCopy): AsyncViewState<{ payments: TPayment; summary: TSummary }> {
  if (payments.isLoading || summary.isLoading) {
    return { status: "loading", label: loadingLabel };
  }
  if (payments.isError || summary.isError || payments.data == null || summary.data == null) {
    return {
      status: "error",
      title: errorTitle,
      body: safeErrorMessage(payments.error ?? summary.error, errorBody),
      retry,
    };
  }
  return { status: "ready", data: { payments: payments.data, summary: summary.data } };
}

export function paymentRecordFailureState(error: unknown, localizedFallback: string) {
  const body = safeErrorMessage(error, localizedFallback);
  return {
    open: true as const,
    outcome: { tone: "error" as const, title: localizedFallback, body },
  };
}
