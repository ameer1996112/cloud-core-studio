import { safeErrorMessage } from "@/lib/error-messages";

export function destructiveActionFailureMessage(error: unknown, localizedFallback: string) {
  return safeErrorMessage(error, localizedFallback);
}
