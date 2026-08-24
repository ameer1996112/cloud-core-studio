import { createServerFn } from "@tanstack/react-start";

import { loadAppMarketingPublicData } from "@/lib/appMarketing.server";

export type { AppMarketingPublicData } from "@/lib/appMarketing.server";

export const getAppMarketingPublicData = createServerFn({ method: "GET" }).handler(
  loadAppMarketingPublicData,
);
