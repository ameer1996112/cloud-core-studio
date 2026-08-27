import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRouteRole } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/member")({
  beforeLoad: async ({ location }) => {
    return requireRouteRole(
      ["member"],
      `${location.pathname}${location.searchStr}${location.hash}`,
    );
  },
  component: () => <Outlet />,
});
