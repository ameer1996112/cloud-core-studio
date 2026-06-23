type AppErrorReporter = (error: unknown, context?: Record<string, unknown>) => void;

declare global {
  interface Window {
    cloudCoreErrorReporter?: AppErrorReporter;
  }
}

export function reportAppError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  window.cloudCoreErrorReporter?.(error, {
    source: "react_error_boundary",
    route: window.location.pathname,
    ...context,
  });
}
