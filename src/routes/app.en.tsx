import { AppMarketingRoutePage } from "@/components/app-marketing/AppMarketingRoute";
import { createFileRoute } from "@tanstack/react-router";

import { getAppMarketingRouteHead, getAppMarketingRouteLoader } from "@/lib/app-marketing-route";

export const Route = createFileRoute("/app/en")({
  loader: ({ location }) => getAppMarketingRouteLoader("en", location.searchStr),
  head: ({ loaderData }) => getAppMarketingRouteHead("en", loaderData),
  component: AppEnglishMarketingRoute,
});

function AppEnglishMarketingRoute() {
  return <AppMarketingRoutePage data={Route.useLoaderData()} />;
}
