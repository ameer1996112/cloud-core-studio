import { createFileRoute, redirect } from "@tanstack/react-router";

// The Messages Center now owns notification templates.
export const Route = createFileRoute("/_authenticated/admin/templates")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/messages", replace: true });
  },
});
