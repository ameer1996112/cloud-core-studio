import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getStartContext } from "@tanstack/start-storage-context";

import {
  parseAppMarketingSearch,
  resolveMarketingLocale,
  sanitizeMarketingUtm,
} from "@/lib/app-marketing";
import { readLangCookieHeader } from "@/lib/i18n";

const getAppMarketingRedirectLocale = createIsomorphicFn()
  .server((search: Record<string, unknown>) => {
    const request = getStartContext().request;
    return resolveMarketingLocale({
      explicit: search.lang,
      saved: readLangCookieHeader(request.headers.get("cookie")),
      accepted: request.headers.get("accept-language"),
    });
  })
  .client((search: Record<string, unknown>) =>
    resolveMarketingLocale({
      explicit: search.lang,
      saved: typeof document === "undefined" ? null : readLangCookieHeader(document.cookie),
      accepted: typeof navigator === "undefined" ? null : [...navigator.languages],
    }),
  );

export const Route = createFileRoute("/app")({
  validateSearch: parseAppMarketingSearch,
  beforeLoad: ({ location }) => {
    if (location.pathname !== "/app") return;

    const lang = getAppMarketingRedirectLocale(location.search);
    const utm = sanitizeMarketingUtm(location.searchStr);

    throw redirect({
      to: `/app/${lang}`,
      search: Object.fromEntries(utm),
      replace: true,
      statusCode: 307,
    });
  },
  component: Outlet,
});
