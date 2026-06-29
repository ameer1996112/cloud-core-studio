import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRouteRole } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    return requireRouteRole(["admin"]);
  },
  component: () => <Outlet />,
});
