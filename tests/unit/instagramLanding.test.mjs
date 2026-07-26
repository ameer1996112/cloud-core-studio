import { describe, expect, test } from "bun:test";

import {
  KIDS_TRIAL_WHATSAPP_MESSAGE,
  WOMEN_TRIAL_WHATSAPP_MESSAGE,
  buildGoogleMapsHref,
  buildWhatsappHref,
  extractInstagramAttribution,
  normalizeWhatsappNumber,
} from "../../src/lib/instagramLanding.ts";
import { createInstagramAnalytics } from "../../src/lib/instagramLanding.analytics.ts";

describe("Instagram landing helpers", () => {
  test("normalizes Israeli WhatsApp numbers", () => {
    expect(normalizeWhatsappNumber("+972 55-939-8438")).toBe("972559398438");
    expect(normalizeWhatsappNumber("055-939-8438")).toBe("972559398438");
    expect(normalizeWhatsappNumber("")).toBe("");
  });

  test("builds distinct, prefilled WhatsApp trial links", () => {
    const womenHref = buildWhatsappHref("+972559398438", WOMEN_TRIAL_WHATSAPP_MESSAGE);
    const kidsHref = buildWhatsappHref("+972559398438", KIDS_TRIAL_WHATSAPP_MESSAGE);

    expect(new URL(womenHref).hostname).toBe("wa.me");
    expect(new URL(womenHref).pathname).toBe("/972559398438");
    expect(new URL(womenHref).searchParams.get("text")).toBe(WOMEN_TRIAL_WHATSAPP_MESSAGE);
    expect(new URL(kidsHref).searchParams.get("text")).toBe(KIDS_TRIAL_WHATSAPP_MESSAGE);
    expect(womenHref).not.toBe(kidsHref);
    expect(WOMEN_TRIAL_WHATSAPP_MESSAGE).toMatch(/80 ₪/);
    expect(KIDS_TRIAL_WHATSAPP_MESSAGE).toMatch(/7 سنوات/);
  });

  test("keeps campaign attribution but drops personal query parameters", () => {
    expect(
      extractInstagramAttribution(
        "?utm_source=instagram&utm_campaign=summer&fbclid=abc&email=private@example.com",
      ),
    ).toEqual({
      utm_source: "instagram",
      utm_campaign: "summer",
      fbclid: "abc",
    });
  });

  test("builds a Google Maps search link for the studio", () => {
    const mapHref = buildGoogleMapsHref("חורפיש, כביש ראשי 89");
    expect(new URL(mapHref).hostname).toBe("www.google.com");
    expect(new URL(mapHref).searchParams.get("query")).toBe("חורפיש, כביש ראשי 89");
  });

  test("tracks views once and forwards events to an existing data layer", () => {
    const events = [];
    const dataLayer = [];
    const analytics = createInstagramAnalytics({
      dataLayer,
      dispatch: (detail) => events.push(detail),
      getContext: () => ({
        device_type: "mobile",
        language: "ar",
        page_path: "/instagram",
        utm_source: "instagram",
      }),
    });

    analytics.trackOnce("landing-view", "instagram_landing_view");
    analytics.trackOnce("landing-view", "instagram_landing_view");
    analytics.track("women_trial_cta_click", { cta_location: "hero", audience_type: "women" });

    expect(events).toHaveLength(2);
    expect(dataLayer).toHaveLength(2);
    expect(events[0].event).toBe("instagram_landing_view");
    expect(events[1].audience_type).toBe("women");
    expect(dataLayer[1].event).toBe("women_trial_cta_click");
  });
});
