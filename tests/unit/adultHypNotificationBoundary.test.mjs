import { describe, expect, test } from "bun:test";
import {
  authorizeLegacyHypNotification,
  adultHypProviderEventPayload,
  adultTrialNotificationDisposition,
} from "../../src/lib/adultHypNotificationBoundary.server";

describe("Adult HYP notification boundary", () => {
  test("preserves the configured-token contract for legacy member SNS notifications", () => {
    expect(
      authorizeLegacyHypNotification({
        configuredToken: "legacy-secret",
        suppliedToken: "legacy-secret",
      }),
    ).toBe(true);
    expect(
      authorizeLegacyHypNotification({ configuredToken: "legacy-secret", suppliedToken: "wrong" }),
    ).toBe(false);
  });

  test("rejects legacy JSON or SNS evidence for an Adult trial before confirmation", () => {
    expect(adultTrialNotificationDisposition("legacy_sns_webhook")).toBe(
      "adult_trial_legacy_notification_rejected",
    );
    expect(adultTrialNotificationDisposition("signed_callback")).toBe("confirm_adult_trial");
  });

  test("retains only reconciliation fields from an Adult signed callback", () => {
    const payload = adultHypProviderEventPayload(
      new URLSearchParams({
        Order: "payment-id",
        Id: "safe-provider-reference",
        CCode: "0",
        Amount: "80",
        Coin: "1",
        Currency: "ILS",
        Sign: "must-not-persist",
        ACode: "authorization-value",
        Token: "bearer-like-value",
        UserId: "unnecessary-customer-field",
        cardMask: "1234",
      }),
    );

    expect(payload).toEqual({
      order_id: "payment-id",
      provider_event_id: "safe-provider-reference",
      provider_result_code: "0",
      amount: "80",
      currency: "ILS",
    });
  });
});
