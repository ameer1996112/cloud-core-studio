import { AppMarketingRoutePage } from "@/components/app-marketing/AppMarketingRoute";
import { createFileRoute } from "@tanstack/react-router";

import { getAppMarketingRouteHead, getAppMarketingRouteLoader } from "@/lib/app-marketing-route";

export const Route = createFileRoute("/app/he")({
  loader: ({ location }) => getAppMarketingRouteLoader("he", location.searchStr),
  head: ({ loaderData }) => getAppMarketingRouteHead("he", loaderData),
  component: AppHebrewMarketingRoute,
});

function AppHebrewMarketingRoute() {
  return <AppMarketingRoutePage data={Route.useLoaderData()} />;
}
