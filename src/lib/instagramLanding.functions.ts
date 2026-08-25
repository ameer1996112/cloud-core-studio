import { createServerFn } from "@tanstack/react-start";

import { loadInstagramLandingData } from "@/lib/instagramLanding.server";

export type {
  InstagramAdultPlan,
  InstagramKidsPlan,
  InstagramLandingData,
} from "@/lib/instagramLanding.server";

export const getInstagramLandingData = createServerFn({ method: "GET" }).handler(
  loadInstagramLandingData,
);
