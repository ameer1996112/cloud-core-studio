import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/planner")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/calendar", replace: true });
  },
});
