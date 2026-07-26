import { extractInstagramAttribution } from "@/lib/instagramLanding";

export type InstagramLandingEventName =
  | "instagram_landing_view"
  | "women_trial_cta_click"
  | "kids_trial_cta_click"
  | "whatsapp_click"
  | "instagram_direct_click"
  | "app_store_click"
  | "map_click"
  | "pricing_view"
  | "limited_offer_view";

export type InstagramLandingEvent = Record<string, unknown> & {
  event: InstagramLandingEventName;
};

type InstagramAnalyticsRuntime = {
  dataLayer?: Array<Record<string, unknown>>;
  dispatch: (detail: InstagramLandingEvent) => void;
  getContext: () => Record<string, unknown>;
};

export function createInstagramAnalytics(runtime: InstagramAnalyticsRuntime) {
  const trackedOnce = new Set<string>();

  const track = (event: InstagramLandingEventName, parameters: Record<string, unknown> = {}) => {
    const detail: InstagramLandingEvent = {
      event,
      ...runtime.getContext(),
      ...parameters,
    };
    runtime.dispatch(detail);
    runtime.dataLayer?.push(detail);
  };

  return {
    track,
    trackOnce(key: string, event: InstagramLandingEventName, parameters = {}) {
      if (trackedOnce.has(key)) return;
      trackedOnce.add(key);
      track(event, parameters);
    },
  };
}

export type InstagramAnalytics = ReturnType<typeof createInstagramAnalytics>;

let browserAnalytics: InstagramAnalytics | null = null;

export function getInstagramAnalytics() {
  if (browserAnalytics) return browserAnalytics;
  if (typeof window === "undefined") return null;

  const analyticsWindow = window as Window & {
    dataLayer?: Array<Record<string, unknown>>;
  };

  browserAnalytics = createInstagramAnalytics({
    dataLayer: analyticsWindow.dataLayer,
    dispatch: (detail) => {
      window.dispatchEvent(new CustomEvent("cloudcore:analytics", { detail }));
    },
    getContext: () => ({
      ...extractInstagramAttribution(window.location.search),
      device_type: window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
      language:
        document.querySelector<HTMLElement>(".igc-page")?.lang ||
        document.documentElement.lang ||
        "ar",
      page_path: window.location.pathname,
    }),
  });

  return browserAnalytics;
}

export function trackTrialWhatsappClick(audience: "women" | "kids", ctaLocation: string) {
  const analytics = getInstagramAnalytics();
  if (!analytics) return;

  analytics.track(audience === "women" ? "women_trial_cta_click" : "kids_trial_cta_click", {
    audience_type: audience,
    cta_location: ctaLocation,
  });
  analytics.track("whatsapp_click", {
    audience_type: audience,
    cta_location: ctaLocation,
  });
}
