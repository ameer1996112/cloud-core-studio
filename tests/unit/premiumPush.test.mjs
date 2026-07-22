import { describe, expect, test } from "bun:test";
import {
  buildPremiumPushPayload,
  renderPremiumPush,
  validatePremiumPushCatalog,
} from "../../src/lib/premiumPush.ts";
import { NOTIFICATION_EVENT_CATALOG } from "../../src/lib/premiumNotificationCatalog.ts";

const variables = {
  member_name: "PRIVATE-MEMBER-NAME",
  class_name: "פילאטיס מזרן",
  class_date: "24/07/2026",
  class_time: "18:00",
  instructor_name: "ירין",
  location_name: "הסטודיו הראשי",
  offer_expires_at: "17:15",
  spots_available: 2,
  waitlist_position: 1,
  package_name: "מינוי חודשי",
  amount: "₪350",
  expiry_date: "31/07/2026",
  renewal_date: "01/08/2026",
  credits_remaining: 2,
  recommendation_summary: "פילאטיס מזרן ביום ו׳ בשעה 18:00",
  announcement_title: "עדכון מהסטודיו",
  announcement_body: "מחר הסטודיו ייפתח בשעה 09:00.",
  staff_message_preview: "נשמח לעזור לך כאן.",
  receipt_url: "https://example.test/private-receipt",
};

describe("premium push presentation", () => {
  test("covers every canonical event that can deliver push", () => {
    const pushEvents = Object.entries(NOTIFICATION_EVENT_CATALOG)
      .filter(([, definition]) => definition.channels.includes("push"))
      .map(([eventType]) => eventType);

    expect(pushEvents).toHaveLength(35);
    expect(validatePremiumPushCatalog()).toEqual({ ok: true, errors: [] });

    for (const eventType of pushEvents) {
      for (const language of ["he", "ar", "en"]) {
        const rendered = renderPremiumPush({ eventType, language, variables });
        expect(rendered.presentationKey).toBe(`${eventType}:push:v1`);
        expect(rendered.title.length).toBeGreaterThan(0);
        expect(rendered.title.length).toBeLessThanOrEqual(60);
        expect(rendered.subtitle?.length ?? 0).toBeLessThanOrEqual(72);
        expect(rendered.body.length).toBeGreaterThan(0);
        expect(rendered.body.length).toBeLessThanOrEqual(132);
        expect(`${rendered.title} ${rendered.subtitle ?? ""} ${rendered.body}`).not.toContain(
          "PRIVATE-MEMBER-NAME",
        );
        expect(`${rendered.title} ${rendered.subtitle ?? ""} ${rendered.body}`).not.toMatch(
          /https?:\/\//,
        );
        expect(`${rendered.title}${rendered.subtitle ?? ""}${rendered.body}`).not.toContain("\n");
      }
    }
  });

  test("renders a concise caring Hebrew booking confirmation", () => {
    expect(
      renderPremiumPush({ eventType: "booking_confirmed", language: "he", variables }),
    ).toEqual({
      title: "המקום שלך שמור 🤍",
      subtitle: "פילאטיס מזרן · 24/07/2026 · 18:00",
      body: "הכול מוכן. נתראה עם ירין בסטודיו.",
      presentationKey: "booking_confirmed:push:v1",
    });
  });

  test("uses the real Arabic waitlist deadline without false urgency", () => {
    expect(
      renderPremiumPush({ eventType: "waitlist_spot_available", language: "ar", variables }),
    ).toEqual({
      title: "أصبح مكان متاحاً لك 🤍",
      subtitle: "פילאטיס מזרן · 24/07/2026 · 18:00",
      body: "حفظناه لك حتى 17:15. يمكنك تأكيده من التطبيق.",
      presentationKey: "waitlist_spot_available:push:v1",
    });
  });

  test("keeps payment failures private on the lock screen", () => {
    const rendered = renderPremiumPush({
      eventType: "payment_failed",
      language: "en",
      variables,
    });

    expect(rendered).toEqual({
      title: "A quick account check",
      subtitle: "Secure payment update",
      body: "We could not complete the payment. Review it securely whenever you are ready—we are here to help.",
      presentationKey: "payment_failed:push:v1",
    });
    expect(JSON.stringify(rendered)).not.toContain("₪350");
    expect(JSON.stringify(rendered)).not.toContain("מינוי חודשי");
    expect(JSON.stringify(rendered)).not.toContain("private-receipt");
  });

  test("projects premium copy into the existing APNs delivery metadata", () => {
    const expiresAt = new Date("2026-07-24T14:15:00.000Z");
    expect(
      buildPremiumPushPayload({
        eventType: "waitlist_spot_available",
        language: "he",
        variables,
        notificationId: "message-1",
        url: "/member/schedule?class=class-1",
        badge: 3,
        sound: "cloud_core_important.caf",
        category: "CC_WAITLIST_OFFER",
        threadId: "waitlist:class-1",
        interruptionLevel: "time-sensitive",
        relevanceScore: 1,
        actions: ["claim_spot", "view_class"],
        collapseId: "waitlist_spot_available:class-1",
        expiresAt,
      }),
    ).toEqual({
      title: "התפנה לך מקום 🤍",
      subtitle: "פילאטיס מזרן · 24/07/2026 · 18:00",
      body: "שמרנו אותו עד 17:15. אפשר לאשר דרך האפליקציה.",
      notificationId: "message-1",
      url: "/member/schedule?class=class-1",
      badge: 3,
      sound: "cloud_core_important.caf",
      category: "CC_WAITLIST_OFFER",
      threadId: "waitlist:class-1",
      interruptionLevel: "time-sensitive",
      relevanceScore: 1,
      actions: ["claim_spot", "view_class"],
      collapseId: "waitlist_spot_available:class-1",
      expiresAt,
    });
  });
});
