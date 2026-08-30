import { createFileRoute, Outlet } from "@tanstack/react-router";
import { use } from "react";
import { ensureI18nNamespaces, i18nNamespaceReady } from "@/lib/i18n";
import { requireRouteRole } from "@/lib/route-guards";
import { loadAuthorizedRoleNamespace } from "@/lib/role-namespace";
import adminCss from "@/styles/admin.css?url";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ links: [{ rel: "stylesheet", href: adminCss }] }),
  beforeLoad: async ({ location }) => {
    return loadAuthorizedRoleNamespace(
      () =>
        requireRouteRole(["admin"], `${location.pathname}${location.searchStr}${location.hash}`),
      () => ensureI18nNamespaces(["admin"]),
    );
  },
  component: AdminLayout,
});

function AdminLayout() {
  use(i18nNamespaceReady("admin"));
  return <Outlet />;
}
