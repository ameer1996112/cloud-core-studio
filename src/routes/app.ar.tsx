import { createFileRoute } from "@tanstack/react-router";

import {
  AppMarketingRoutePage,
  getAppMarketingRouteHead,
  getAppMarketingRouteLoader,
} from "@/components/app-marketing/AppMarketingRoute";

export const Route = createFileRoute("/app/ar")({
  loader: ({ location }) => getAppMarketingRouteLoader("ar", location.searchStr),
  head: ({ loaderData }) => getAppMarketingRouteHead("ar", loaderData),
  component: AppArabicMarketingRoute,
});

function AppArabicMarketingRoute() {
  return <AppMarketingRoutePage data={Route.useLoaderData()} />;
}
