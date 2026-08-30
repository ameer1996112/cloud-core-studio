import { createFileRoute, Outlet } from "@tanstack/react-router";
import { use } from "react";
import { requireRouteRole } from "@/lib/route-guards";
import { ensureI18nNamespaces, i18nNamespaceReady } from "@/lib/i18n";
import { loadAuthorizedRoleNamespace } from "@/lib/role-namespace";
import memberCss from "@/styles/member.css?url";

export const Route = createFileRoute("/_authenticated/member")({
  head: () => ({ links: [{ rel: "stylesheet", href: memberCss }] }),
  beforeLoad: async ({ location }) => {
    return loadAuthorizedRoleNamespace(
      () =>
        requireRouteRole(["member"], `${location.pathname}${location.searchStr}${location.hash}`),
      () => ensureI18nNamespaces(["member"]),
    );
  },
  component: MemberLayout,
});

function MemberLayout() {
  use(i18nNamespaceReady("member"));
  return <Outlet />;
}
