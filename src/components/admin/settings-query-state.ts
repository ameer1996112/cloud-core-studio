import type { AsyncViewState } from "@/components/ui/async-state";
import { safeErrorMessage } from "@/lib/error-messages";

type SettingsQueryViewStateInput<T> = {
  data: T | null | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  retry: () => void;
  loadingLabel: string;
  errorTitle: string;
  errorBody: string;
};

export function settingsQueryViewState<T>({
  data,
  isLoading,
  isError,
  error,
  retry,
  loadingLabel,
  errorTitle,
  errorBody,
}: SettingsQueryViewStateInput<T>): AsyncViewState<T> {
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

export function settingsPushRegistrationFailure(error: unknown, localizedFallback: string) {
  return safeErrorMessage(error, localizedFallback);
}
