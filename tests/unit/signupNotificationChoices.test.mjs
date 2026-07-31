import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SignupNotificationChoices } from "../../src/components/auth/SignupNotificationChoices.tsx";

describe("signup notification choices", () => {
  test("presents essential email separately from optional unchecked choices", () => {
    const html = renderToStaticMarkup(
      React.createElement(SignupNotificationChoices, {
        lang: "en",
        phone: "",
        whatsapp: false,
        marketing: false,
        onWhatsappChange: () => undefined,
        onMarketingChange: () => undefined,
      }),
    );

    expect(html).toContain("Essential booking and account emails are included");
    expect(html).toContain("Booking and studio updates on WhatsApp");
    expect(html).toContain("Offers and recommendations by email—and by WhatsApp if enabled above");
    expect(html.match(/type="checkbox"/g)).toHaveLength(2);
    expect(html).not.toContain('checked=""');
    expect(html).toContain('disabled=""');
  });
});
