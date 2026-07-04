import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse } from "@/lib/internalAutomationAuth.server";

function deprecatedResponse() {
  return jsonResponse(
    {
      ok: false,
      error: "openwa_run_deprecated",
      message: "Use openwa-claim and openwa-report instead.",
    },
    410,
  );
}

export const Route = createFileRoute("/api/internal/notifications/openwa-run")({
  server: {
    handlers: {
      GET: async () => deprecatedResponse(),
      POST: async () => deprecatedResponse(),
    },
  },
});
