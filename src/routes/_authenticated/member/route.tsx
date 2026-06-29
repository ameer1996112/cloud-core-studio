import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRouteRole } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/member")({
  beforeLoad: async () => {
    return requireRouteRole(["member"]);
  },
  component: () => <Outlet />,
});
