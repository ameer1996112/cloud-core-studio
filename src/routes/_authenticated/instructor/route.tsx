import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRouteRole } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/instructor")({
  beforeLoad: async () => {
    return requireRouteRole(["instructor"]);
  },
  component: () => <Outlet />,
});
