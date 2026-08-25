import { createFileRoute } from "@tanstack/react-router";

import {
  AppMarketingRoutePage,
  getAppMarketingRouteHead,
  getAppMarketingRouteLoader,
} from "@/components/app-marketing/AppMarketingRoute";

export const Route = createFileRoute("/app/en")({
  loader: ({ location }) => getAppMarketingRouteLoader("en", location.searchStr),
  head: ({ loaderData }) => getAppMarketingRouteHead("en", loaderData),
  component: AppEnglishMarketingRoute,
});

function AppEnglishMarketingRoute() {
  return <AppMarketingRoutePage data={Route.useLoaderData()} />;
}
