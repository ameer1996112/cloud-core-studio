import { createFileRoute, Outlet } from "@tanstack/react-router";
import { use } from "react";
import { ensureI18nNamespaces, i18nNamespaceReady } from "@/lib/i18n";
import { requireRouteRole } from "@/lib/route-guards";
import { loadAuthorizedRoleNamespace } from "@/lib/role-namespace";
import instructorCss from "@/styles/instructor.css?url";

export const Route = createFileRoute("/_authenticated/instructor")({
  head: () => ({ links: [{ rel: "stylesheet", href: instructorCss }] }),
  beforeLoad: async ({ location }) => {
    return loadAuthorizedRoleNamespace(
      () =>
        requireRouteRole(
          ["instructor"],
          `${location.pathname}${location.searchStr}${location.hash}`,
        ),
      () => ensureI18nNamespaces(["instructor"]),
    );
  },
  component: InstructorLayout,
});

function InstructorLayout() {
  use(i18nNamespaceReady("instructor"));
  return <Outlet />;
}
