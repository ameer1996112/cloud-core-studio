import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRouteRole } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/instructor")({
  beforeLoad: async ({ location }) => {
    return requireRouteRole(
      ["instructor"],
      `${location.pathname}${location.searchStr}${location.hash}`,
    );
  },
  component: () => <Outlet />,
});
