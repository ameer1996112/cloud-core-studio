import { describe, expect, test } from "bun:test";

import {
  APP_MARKETING_ANALYTICS_EVENTS,
  createBrowserAppMarketingAnalytics,
  createAppMarketingAnalytics,
  shouldTrackAppMarketingLanguageChange,
} from "../../src/lib/app-marketing.analytics";

const EXPECTED_APP_MARKETING_EVENTS = [
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

describe("app marketing analytics", () => {
  test("dispatches every approved conversion event and no others", () => {
    const events: Record<string, unknown>[] = [];
    const dataLayer: Record<string, unknown>[] = [];
    const analytics = createAppMarketingAnalytics({
      dispatch: (detail) => events.push(detail),
      dataLayer,
      getContext: () => ({ language: "en", route: "/app/en", device_type: "desktop" }),
    });

    for (const event of EXPECTED_APP_MARKETING_EVENTS) analytics.track(event);

    expect(APP_MARKETING_ANALYTICS_EVENTS).toEqual(EXPECTED_APP_MARKETING_EVENTS);
    expect(events.map((detail) => detail.event)).toEqual(EXPECTED_APP_MARKETING_EVENTS);
    expect(dataLayer).toEqual(events);
    expect(() => (analytics.track as (event: string) => void)("unknown_conversion")).toThrow(
      "Unsupported app marketing analytics event",
    );
  });

  test("deduplicates views within a page instance without suppressing a new instance", () => {
    const events: Record<string, unknown>[] = [];
    const runtime = {
      dispatch: (detail: Record<string, unknown>) => events.push(detail),
      getContext: () => ({ language: "ar", route: "/app/ar", device_type: "mobile" }),
    };

    const firstPage = createAppMarketingAnalytics(runtime);
    firstPage.trackView();
    firstPage.trackView();
    createAppMarketingAnalytics(runtime).trackView();

    expect(events.filter((detail) => detail.event === "app_landing_view")).toHaveLength(2);
  });

  test("emits only the approved safe context keys", () => {
    const events: Record<string, unknown>[] = [];
    const analytics = createAppMarketingAnalytics({
      dispatch: (detail) => events.push(detail),
      getContext: () => ({
        language: "he",
        route: "/app/he",
        utm_source: "private@example.com",
        utm_medium: "https://tracking.example/?member_id=42",
        utm_campaign: "summer_launch",
        device_type: "mobile",
        email: "private@example.com",
        phone: "055-939-8438",
        href: "https://example.com/private",
      }),
    });

    analytics.track("app_landing_whatsapp_click", {
      cta_location: "location",
      name: "Private name",
      member_id: "member-1",
    } as never);

    expect(events).toEqual([
      {
        event: "app_landing_whatsapp_click",
        language: "he",
        route: "/app/he",
        utm_campaign: "summer_launch",
        device_type: "mobile",
        cta_location: "location",
      },
    ]);
  });

  test("filters unsafe UTM values and ignores runtime attempts to override analytics context", () => {
    const events: Record<string, unknown>[] = [];
    const analytics = createAppMarketingAnalytics({
      dispatch: (detail) => events.push(detail),
      getContext: () => ({
        language: "en",
        route: "/account/private@example.com",
        utm_source: "newsletter",
        utm_medium: "https://tracking.example/?member_id=42",
        utm_campaign: "summer_launch",
        utm_content: "private-creative",
        utm_term: "private-term",
        utm_id: "private-id",
        email: "private@example.com",
      }),
    });

    analytics.track("app_landing_support_click", {
      cta_location: "footer",
      utm_campaign: "payment_link",
      payment_id: "payment-1",
      phone: "055-939-8438",
      href: "/support?email=private@example.com",
    } as never);

    expect(events[0]).toEqual({
      event: "app_landing_support_click",
      language: "en",
      utm_source: "newsletter",
      utm_campaign: "summer_launch",
      cta_location: "footer",
    });
  });

  test("rejects identifier-shaped UTM values while retaining normal campaign labels", () => {
    const events: Record<string, unknown>[] = [];
    const identifierContext = createAppMarketingAnalytics({
      dispatch: (detail) => events.push(detail),
      getContext: () => ({
        language: "en",
        route: "/app/en",
        utm_source: "055-939-8438",
        utm_medium: "private.example.com",
        utm_campaign: "550e8400-e29b-41d4-a716-446655440000",
      }),
    });

    identifierContext.track("app_landing_app_store_click", { cta_location: "hero" });

    const normalContext = createAppMarketingAnalytics({
      dispatch: (detail) => events.push(detail),
      getContext: () => ({
        language: "en",
        route: "/app/en",
        utm_source: "instagram",
        utm_medium: "paid_social",
        utm_campaign: "summer-launch-2026",
      }),
    });
    normalContext.track("app_landing_app_store_click", { cta_location: "hero" });

    createAppMarketingAnalytics({
      dispatch: (detail) => events.push(detail),
      getContext: () => ({
        language: "en",
        route: "/app/en",
        utm_source: "a3f29d84c7b14e9fa1c4d82b91e760a4",
      }),
    }).track("app_landing_app_store_click", { cta_location: "hero" });

    expect(events).toEqual([
      {
        event: "app_landing_app_store_click",
        language: "en",
        route: "/app/en",
        cta_location: "hero",
      },
      {
        event: "app_landing_app_store_click",
        language: "en",
        route: "/app/en",
        utm_source: "instagram",
        utm_medium: "paid_social",
        utm_campaign: "summer-launch-2026",
        cta_location: "hero",
      },
      {
        event: "app_landing_app_store_click",
        language: "en",
        route: "/app/en",
        cta_location: "hero",
      },
    ]);
  });

  test("allows only valid CTA locations and uses the target language for language changes", () => {
    const events: Record<string, unknown>[] = [];
    const analytics = createAppMarketingAnalytics({
      dispatch: (detail) => events.push(detail),
      getContext: () => ({ language: "ar", route: "/app/ar", device_type: "desktop" }),
    });

    analytics.trackLanguageChange("en");
    analytics.track("app_landing_login", { cta_location: "not-a-location" } as never);

    expect(events).toEqual([
      {
        event: "app_landing_language_change",
        language: "en",
        route: "/app/ar",
        device_type: "desktop",
        cta_location: "header",
      },
      {
        event: "app_landing_login",
        language: "ar",
        route: "/app/ar",
        device_type: "desktop",
      },
    ]);
  });

  test("does not treat the active language anchor as a language change", () => {
    expect(shouldTrackAppMarketingLanguageChange("ar", "ar")).toBe(false);
    expect(shouldTrackAppMarketingLanguageChange("ar", "en")).toBe(true);
  });

  test("exposes only a narrow CTA parameter contract", () => {
    const analytics = createAppMarketingAnalytics({
      dispatch: () => {},
      getContext: () => ({}),
    });

    const compileTimeContract = () => {
      // @ts-expect-error PII-like fields are not valid analytics parameters.
      analytics.track("app_landing_login", { email: "private@example.com" });
      // @ts-expect-error Navigation and attribution overrides are not valid analytics parameters.
      analytics.track("app_landing_support_click", { href: "/support", utm_source: "instagram" });
    };

    expect(compileTimeContract).toBeTypeOf("function");
    analytics.track("app_landing_login", { cta_location: "header" });
  });

  test("exposes create-account tracking for the actual signup action when one is added", () => {
    const events: Record<string, unknown>[] = [];
    const analytics = createAppMarketingAnalytics({
      dispatch: (detail) => events.push(detail),
      getContext: () => ({ language: "en", route: "/app/en", device_type: "desktop" }),
    });

    analytics.trackCreateAccount("hero");

    expect(events[0]).toEqual({
      event: "app_landing_create_account",
      language: "en",
      route: "/app/en",
      device_type: "desktop",
      cta_location: "hero",
    });
  });

  test("browser runtime emits the CustomEvent and optional dataLayer payload", () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const dataLayer: Record<string, unknown>[] = [];
    const dispatched: Event[] = [];
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        dataLayer,
        location: { pathname: "/app/en" },
        matchMedia: () => ({ matches: false }),
        dispatchEvent: (event: Event) => dispatched.push(event),
      },
    });

    try {
      const analytics = createBrowserAppMarketingAnalytics(() => ({
        language: "en",
        utm_source: "instagram",
        email: "private@example.com",
      }));
      analytics?.trackView();

      expect(dataLayer).toEqual([
        {
          event: "app_landing_view",
          language: "en",
          route: "/app/en",
          utm_source: "instagram",
          device_type: "desktop",
        },
      ]);
      expect(dispatched).toHaveLength(1);
      expect(dispatched[0].type).toBe("cloudcore:analytics");
      expect((dispatched[0] as CustomEvent<Record<string, unknown>>).detail).toEqual(dataLayer[0]);
    } finally {
      if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
      else Reflect.deleteProperty(globalThis, "window");
    }
  });
});
