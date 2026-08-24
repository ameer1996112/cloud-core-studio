import { createFileRoute } from "@tanstack/react-router";

import {
  AppMarketingRoutePage,
  getAppMarketingRouteHead,
  getAppMarketingRouteLoader,
} from "./app-marketing-route";

export const Route = createFileRoute("/app/ar")({
  loader: () => getAppMarketingRouteLoader("ar"),
  head: ({ loaderData }) => getAppMarketingRouteHead("ar", loaderData),
  component: AppArabicMarketingRoute,
});

function AppArabicMarketingRoute() {
  return <AppMarketingRoutePage data={Route.useLoaderData()} />;
}
