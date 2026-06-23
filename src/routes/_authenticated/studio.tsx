import { createFileRoute, redirect } from "@tanstack/react-router";
import { homeForCurrentUser } from "@/lib/auth-redirect";

// Legacy "Studio" surface: bounce by role.
export const Route = createFileRoute("/_authenticated/studio")({
  beforeLoad: async () => {
    const to = await homeForCurrentUser();
    throw redirect({ to, replace: true });
  },
});
