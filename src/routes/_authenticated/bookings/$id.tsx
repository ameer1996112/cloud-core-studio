import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/bookings/$id")({
  beforeLoad: () => {
    throw redirect({ to: "/member/bookings", replace: true });
  },
});
