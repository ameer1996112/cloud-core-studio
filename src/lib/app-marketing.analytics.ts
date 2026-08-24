import type { Lang } from "@/lib/i18n";

export const APP_MARKETING_ANALYTICS_EVENTS = [
  "app_landing_view",
  "app_landing_language_change",
  "app_landing_view_schedule",
  "app_landing_create_account",
  "app_landing_login",
  "app_landing_app_store_click",
  "app_landing_whatsapp_click",
  "app_landing_instagram_click",
  "app_landing_maps_click",
  "app_landing_support_click",
] as const;

export type AppMarketingAnalyticsEventName = (typeof APP_MARKETING_ANALYTICS_EVENTS)[number];
export type AppMarketingCtaLocation = "header" | "hero" | "final" | "location" | "footer";
export type AppMarketingAnalyticsTrackOptions = {
  cta_location?: AppMarketingCtaLocation;
};

type AppMarketingAnalyticsDetail = {
  event: AppMarketingAnalyticsEventName;
  language?: Lang;
  route?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  device_type?: "mobile" | "desktop";
  cta_location?: AppMarketingCtaLocation;
};

type AppMarketingAnalyticsRuntime = {
  dataLayer?: Array<Record<string, unknown>>;
  dispatch: (detail: AppMarketingAnalyticsDetail) => void;
  getContext: () => Record<string, unknown>;
};

const EVENT_SET = new Set<string>(APP_MARKETING_ANALYTICS_EVENTS);
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;
const CTA_LOCATIONS = new Set<AppMarketingCtaLocation>([
  "header",
  "hero",
  "final",
  "location",
  "footer",
]);
const APP_MARKETING_ROUTE = /^\/app(?:\/(?:ar|he|en))?$/;
const SAFE_UTM_VALUE = /^[\p{L}\p{N} _.-]+$/u;
const PRIVATE_UTM_TOKEN = /email|phone|member|booking|payment/i;
const HOSTNAME_LIKE_VALUE = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i;
const UUID_VALUE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_HEX_IDENTIFIER = /^[0-9a-f]{24,}$/i;

function isCtaLocation(value: unknown): value is AppMarketingCtaLocation {
  return typeof value === "string" && CTA_LOCATIONS.has(value as AppMarketingCtaLocation);
}

function sanitizedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : undefined;
}

function looksLikePhoneNumber(value: string) {
  return /^[+\d().\s-]+$/.test(value) && value.replace(/\D/g, "").length >= 7;
}

/**
 * Attribution may reach navigation unchanged, but analytics accepts only plain campaign labels.
 * This deliberately conservative character allowlist excludes contact details, URLs, queries, and IDs.
 */
function sanitizedAnalyticsUtm(value: unknown) {
  const normalized = sanitizedString(value);
  if (
    !normalized ||
    !SAFE_UTM_VALUE.test(normalized) ||
    PRIVATE_UTM_TOKEN.test(normalized) ||
    looksLikePhoneNumber(normalized) ||
    HOSTNAME_LIKE_VALUE.test(normalized) ||
    UUID_VALUE.test(normalized) ||
    LONG_HEX_IDENTIFIER.test(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function sanitizedContext(
  input: Record<string, unknown>,
): Omit<AppMarketingAnalyticsDetail, "event"> {
  const detail: Omit<AppMarketingAnalyticsDetail, "event"> = {};
  const language = input.language;
  if (language === "ar" || language === "he" || language === "en") detail.language = language;

  const route = sanitizedString(input.route);
  if (route && APP_MARKETING_ROUTE.test(route)) detail.route = route;

  for (const key of UTM_KEYS) {
    const value = sanitizedAnalyticsUtm(input[key]);
    if (value) detail[key] = value;
  }

  if (input.device_type === "mobile" || input.device_type === "desktop") {
    detail.device_type = input.device_type;
  }

  if (isCtaLocation(input.cta_location)) {
    detail.cta_location = input.cta_location;
  }

  return detail;
}

export function createAppMarketingAnalytics(runtime: AppMarketingAnalyticsRuntime) {
  const trackedOnce = new Set<string>();

  const emit = (
    event: AppMarketingAnalyticsEventName,
    overrides: Pick<AppMarketingAnalyticsDetail, "language" | "cta_location"> = {},
  ) => {
    if (!EVENT_SET.has(event)) throw new Error("Unsupported app marketing analytics event");

    const detail: AppMarketingAnalyticsDetail = {
      event,
      ...sanitizedContext(runtime.getContext()),
      ...sanitizedContext(overrides),
    };
    runtime.dispatch(detail);
    runtime.dataLayer?.push(detail);
  };

  const track = (
    event: AppMarketingAnalyticsEventName,
    parameters: AppMarketingAnalyticsTrackOptions = {},
  ) => {
    emit(event, { cta_location: parameters.cta_location });
  };

  return {
    track,
    trackView() {
      const context = sanitizedContext(runtime.getContext());
      const key = `view:${context.route ?? ""}:${context.language ?? ""}`;
      if (trackedOnce.has(key)) return;
      trackedOnce.add(key);
      track("app_landing_view");
    },
    trackLanguageChange(language: Lang) {
      emit("app_landing_language_change", { language, cta_location: "header" });
    },
    /** Wire this only to a distinct signup action, not an auth or schedule link. */
    trackCreateAccount(ctaLocation: AppMarketingCtaLocation) {
      track("app_landing_create_account", { cta_location: ctaLocation });
    },
  };
}

export function shouldTrackAppMarketingLanguageChange(current: Lang, target: Lang) {
  return current !== target;
}

export type AppMarketingAnalytics = ReturnType<typeof createAppMarketingAnalytics>;

export function createBrowserAppMarketingAnalytics(
  getPageContext: () => Record<string, unknown>,
): AppMarketingAnalytics | null {
  if (typeof window === "undefined") return null;

  const analyticsWindow = window as Window & { dataLayer?: Array<Record<string, unknown>> };
  return createAppMarketingAnalytics({
    dataLayer: analyticsWindow.dataLayer,
    dispatch: (detail) => {
      window.dispatchEvent(new CustomEvent("cloudcore:analytics", { detail }));
    },
    getContext: () => ({
      ...getPageContext(),
      route: window.location.pathname,
      device_type: window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
    }),
  });
}
