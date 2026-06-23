import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/schedule")({
  beforeLoad: () => {
    throw redirect({ to: "/member/schedule", replace: true });
  },
});
