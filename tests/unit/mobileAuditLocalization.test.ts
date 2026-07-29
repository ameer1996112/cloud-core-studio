import { describe, expect, test } from "bun:test";
import { MESSAGES } from "../../src/lib/i18n";
import { getPlanDisplay } from "../../src/lib/planDisplay";

describe("mobile conversion localization", () => {
  test("provides checkout navigation and auth validation copy in every language", () => {
    expect(MESSAGES.en["legal.checkout"]).toBe("Checkout");
    expect(MESSAGES.he["legal.checkout"]).toBe("תשלום");
    expect(MESSAGES.ar["legal.checkout"]).toBe("الدفع");

    for (const catalog of [MESSAGES.en, MESSAGES.he, MESSAGES.ar]) {
      expect(catalog["auth.validation.required"]).toBeTruthy();
      expect(catalog["auth.validation.invalidEmail"]).toBeTruthy();
      expect(catalog["auth.validation.passwordTooShort"]).toBeTruthy();
    }
  });

  test("renders known checkout plans without unintended English in Arabic", () => {
    const display = getPlanDisplay(
      {
        description: "cloud_monthly_1x_week",
        credits: 5,
        duration_days: 30,
        name: "Cloud Monthly 1x Week",
      },
      "ar",
    );

    expect(display.name).toBe("اشتراك شهري — مرة بالأسبوع");
    expect(display.memberLine).toBe("5 حصص بالشهر · مناسب لمرة بالأسبوع");
    expect(display.name).not.toContain("Monthly");
    expect(display.memberLine).not.toContain("credits");
  });
});
