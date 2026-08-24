import { createFileRoute } from "@tanstack/react-router";

import {
  AppMarketingRoutePage,
  getAppMarketingRouteHead,
  getAppMarketingRouteLoader,
} from "./app-marketing-route";

export const Route = createFileRoute("/app/en")({
  loader: () => getAppMarketingRouteLoader("en"),
  head: ({ loaderData }) => getAppMarketingRouteHead("en", loaderData),
  component: AppEnglishMarketingRoute,
});

function AppEnglishMarketingRoute() {
  return <AppMarketingRoutePage data={Route.useLoaderData()} />;
}
