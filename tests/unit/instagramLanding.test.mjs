import { strict as assert } from "node:assert";

import {
  KIDS_TRIAL_WHATSAPP_MESSAGE,
  WOMEN_TRIAL_WHATSAPP_MESSAGE,
  buildGoogleMapsHref,
  buildWhatsappHref,
  extractInstagramAttribution,
  normalizeWhatsappNumber,
} from "../../src/lib/instagramLanding.ts";
import { createInstagramAnalytics } from "../../src/lib/instagramLanding.analytics.ts";

assert.equal(normalizeWhatsappNumber("+972 55-939-8438"), "972559398438");
assert.equal(normalizeWhatsappNumber("055-939-8438"), "972559398438");
assert.equal(normalizeWhatsappNumber(""), "");

const womenHref = buildWhatsappHref("+972559398438", WOMEN_TRIAL_WHATSAPP_MESSAGE);
const kidsHref = buildWhatsappHref("+972559398438", KIDS_TRIAL_WHATSAPP_MESSAGE);

assert.equal(new URL(womenHref).hostname, "wa.me");
assert.equal(new URL(womenHref).pathname, "/972559398438");
assert.equal(new URL(womenHref).searchParams.get("text"), WOMEN_TRIAL_WHATSAPP_MESSAGE);
assert.equal(new URL(kidsHref).searchParams.get("text"), KIDS_TRIAL_WHATSAPP_MESSAGE);
assert.notEqual(womenHref, kidsHref);
assert.match(WOMEN_TRIAL_WHATSAPP_MESSAGE, /80 ₪/);
assert.match(KIDS_TRIAL_WHATSAPP_MESSAGE, /7 سنوات/);

assert.deepEqual(
  extractInstagramAttribution(
    "?utm_source=instagram&utm_campaign=summer&fbclid=abc&email=private@example.com",
  ),
  {
    utm_source: "instagram",
    utm_campaign: "summer",
    fbclid: "abc",
  },
);

const mapHref = buildGoogleMapsHref("חורפיש, כביש ראשי 89");
assert.equal(new URL(mapHref).hostname, "www.google.com");
assert.equal(new URL(mapHref).searchParams.get("query"), "חורפיש, כביש ראשי 89");

{
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

  assert.equal(events.length, 2);
  assert.equal(dataLayer.length, 2);
  assert.equal(events[0].event, "instagram_landing_view");
  assert.equal(events[1].audience_type, "women");
  assert.equal(dataLayer[1].event, "women_trial_cta_click");
}

console.log("instagram landing helpers OK");
