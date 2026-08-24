import { createFileRoute } from "@tanstack/react-router";

import {
  AppMarketingRoutePage,
  getAppMarketingRouteHead,
  getAppMarketingRouteLoader,
} from "./app-marketing-route";

export const Route = createFileRoute("/app/he")({
  loader: ({ location }) => getAppMarketingRouteLoader("he", location.searchStr),
  head: ({ loaderData }) => getAppMarketingRouteHead("he", loaderData),
  component: AppHebrewMarketingRoute,
});

function AppHebrewMarketingRoute() {
  return <AppMarketingRoutePage data={Route.useLoaderData()} />;
}
