import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/credits")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/members", replace: true });
  },
});
