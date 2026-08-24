import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getStartContext } from "@tanstack/start-storage-context";

import { parseAppMarketingSearch, resolveAppMarketingRedirect } from "@/lib/app-marketing";
import { readLangCookieHeader } from "@/lib/i18n";

const getAppMarketingRedirectContext = createIsomorphicFn()
  .server(() => {
    const request = getStartContext().request;
    return {
      saved: readLangCookieHeader(request.headers.get("cookie")),
      accepted: request.headers.get("accept-language"),
    };
  })
  .client(() => ({
    saved: typeof document === "undefined" ? null : readLangCookieHeader(document.cookie),
    accepted: typeof navigator === "undefined" ? null : [...navigator.languages],
  }));

export const Route = createFileRoute("/app")({
  validateSearch: parseAppMarketingSearch,
  beforeLoad: ({ location }) => {
    if (location.pathname !== "/app") return;

    const search = parseAppMarketingSearch(location.search);
    const decision = resolveAppMarketingRedirect({
      explicit: search.lang,
      search: location.searchStr,
      ...getAppMarketingRedirectContext(),
    });

    throw redirect({
      to: decision.to,
      search: decision.search,
      replace: true,
      statusCode: 307,
    });
  },
  component: Outlet,
});
