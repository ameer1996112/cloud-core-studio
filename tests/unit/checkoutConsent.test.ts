import { describe, expect, test } from "bun:test";
import { checkoutConsentSchema } from "../../src/lib/checkoutConsent";

describe("hosted checkout consent", () => {
  test("requires terms acceptance without requiring customer details", () => {
    expect(checkoutConsentSchema.parse({ termsAccepted: true })).toEqual({
      termsAccepted: true,
    });
    expect(() => checkoutConsentSchema.parse({ termsAccepted: false })).toThrow();
  });
});
