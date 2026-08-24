import { describe, expect, test } from "bun:test";

import {
  APP_MARKETING_ANALYTICS_EVENTS,
  createBrowserAppMarketingAnalytics,
  createAppMarketingAnalytics,
} from "../../src/lib/app-marketing.analytics";

describe("app marketing analytics", () => {
  test("dispatches every approved conversion event and no others", () => {
    const events: Record<string, unknown>[] = [];
    const dataLayer: Record<string, unknown>[] = [];
    const analytics = createAppMarketingAnalytics({
      dispatch: (detail) => events.push(detail),
      dataLayer,
      getContext: () => ({ language: "en", route: "/app/en", device_type: "desktop" }),
    });

    for (const event of APP_MARKETING_ANALYTICS_EVENTS) analytics.track(event);

    expect(events.map((detail) => detail.event)).toEqual(APP_MARKETING_ANALYTICS_EVENTS);
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
        utm_source: "instagram",
        utm_medium: "social",
        utm_campaign: "summer",
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
    });

    expect(events).toEqual([
      {
        event: "app_landing_whatsapp_click",
        language: "he",
        route: "/app/he",
        utm_source: "instagram",
        utm_medium: "social",
        utm_campaign: "summer",
        device_type: "mobile",
        cta_location: "location",
      },
    ]);
  });

  test("filters non-analytics UTMs and PII-like values even when supplied as event parameters", () => {
    const events: Record<string, unknown>[] = [];
    const analytics = createAppMarketingAnalytics({
      dispatch: (detail) => events.push(detail),
      getContext: () => ({
        language: "en",
        route: "/account/private@example.com",
        utm_source: "newsletter",
        utm_content: "private-creative",
        utm_term: "private-term",
        utm_id: "private-id",
        email: "private@example.com",
      }),
    });

    analytics.track("app_landing_support_click", {
      cta_location: "footer",
      utm_campaign: "launch",
      payment_id: "payment-1",
      phone: "055-939-8438",
      href: "/support?email=private@example.com",
    });

    expect(events[0]).toEqual({
      event: "app_landing_support_click",
      language: "en",
      utm_source: "newsletter",
      utm_campaign: "launch",
      cta_location: "footer",
    });
  });

  test("allows only valid CTA locations and uses the target language for language changes", () => {
    const events: Record<string, unknown>[] = [];
    const analytics = createAppMarketingAnalytics({
      dispatch: (detail) => events.push(detail),
      getContext: () => ({ language: "ar", route: "/app/ar", device_type: "desktop" }),
    });

    analytics.trackLanguageChange("en");
    analytics.track("app_landing_login", { cta_location: "not-a-location" });

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
