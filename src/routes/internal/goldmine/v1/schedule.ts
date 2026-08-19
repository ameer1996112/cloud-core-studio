import { createFileRoute } from "@tanstack/react-router";
import { handleGoldmineScheduleRequest } from "@/lib/goldmineScheduleSource.server";

export const Route = createFileRoute("/internal/goldmine/v1/schedule")({
  server: {
    handlers: {
      GET: async ({ request }) => handleGoldmineScheduleRequest(request),
    },
  },
});
