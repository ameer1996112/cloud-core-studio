import { describe, expect, mock, test } from "bun:test";

const providerEvents = [];
const confirmations = [];
let adultPayment = {
  id: "adult-payment-id",
  reservation_id: "reservation-id",
  amount: 80,
  currency: "ILS",
  method: "card",
  provider: "hyp",
  status: "pending",
};

mock.module("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(table) {
      if (table !== "provider_events") throw new Error(`unexpected table: ${table}`);
      return {
        insert: async (row) => {
          providerEvents.push(row);
          return { error: null };
        },
        update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
      };
    },
  },
}));

mock.module("@/lib/hyp.server", () => ({
  chargeHypSavedToken: async () => {
    throw new Error("not used by this test");
  },
  getHypTokenForTransaction: async () => {
    throw new Error("not used by this test");
  },
  inquireHypTransactionsByUser: async () => {
    throw new Error("not used by this test");
  },
  validateHypRedirect: async () => true,
}));

mock.module("@/lib/hypPaymentConfirmation.server", () => ({
  handleHypConfirmedPayment: async () => undefined,
}));

mock.module("@/lib/adultTrialPayments.server", () => ({
  findAdultTrialPayment: async () => adultPayment,
  confirmVerifiedAdultTrialHypPayment: async (input) => {
    confirmations.push(input);
    return { status: "paid", payment_id: input.paymentId };
  },
}));

const { processHypPaymentNotification } = await import("../../src/lib/subscriptions.server.ts");

describe("Adult HYP notification processing", () => {
  test("a legacy SNS evidence path cannot confirm an Adult payment", async () => {
    adultPayment = {
      id: "adult-payment-id",
      reservation_id: "reservation-id",
      amount: 80,
      currency: "ILS",
      method: "card",
      provider: "hyp",
      status: "pending",
    };
    providerEvents.length = 0;
    confirmations.length = 0;

    const result = await processHypPaymentNotification(
      new URLSearchParams({ Order: "adult-payment-id", Id: "legacy-event", CCode: "0" }),
      "legacy_sns_webhook",
    );

    expect(result.status).toBe("adult_trial_legacy_notification_rejected");
    expect(confirmations).toHaveLength(0);
    expect(providerEvents).toHaveLength(0);
  });

  test("the signed-callback test seam confirms Adult payment with a minimized provider event", async () => {
    adultPayment = {
      id: "adult-payment-id",
      reservation_id: "reservation-id",
      amount: 80,
      currency: "ILS",
      method: "card",
      provider: "hyp",
      status: "pending",
    };
    providerEvents.length = 0;
    confirmations.length = 0;

    const result = await processHypPaymentNotification(
      new URLSearchParams({
        Order: "adult-payment-id",
        Id: "safe-event-reference",
        CCode: "0",
        Amount: "80",
        Coin: "1",
        Sign: "signature-must-not-persist",
        ACode: "authorization-must-not-persist",
      }),
      "signed_callback",
    );

    expect(result.status).toBe("confirmed_adult_trial_payment");
    expect(confirmations).toEqual([
      {
        paymentId: "adult-payment-id",
        providerPaymentId: "authorization-must-not-persist",
        providerSessionId: "safe-event-reference",
        providerStatus: "paid",
        providerAmount: 80,
        providerCurrency: "ILS",
        providerOrderId: "adult-payment-id",
      },
    ]);
    expect(providerEvents[0].payload).toEqual({
      order_id: "adult-payment-id",
      provider_event_id: "safe-event-reference",
      provider_result_code: "0",
      amount: "80",
      currency: "ILS",
    });
  });

  test("a valid legacy SNS event remains on the existing member-payment path", async () => {
    adultPayment = null;
    providerEvents.length = 0;
    const legacyCalls = [];

    const result = await processHypPaymentNotification(
      new URLSearchParams({ Order: "member-payment-id", Id: "legacy-event", CCode: "0" }),
      "legacy_sns_webhook",
      {
        confirmExistingMemberPayment: async (paymentId) => {
          legacyCalls.push(paymentId);
          return { status: "confirmed_existing_payment", confirmResult: { payment_id: paymentId } };
        },
      },
    );

    expect(result.status).toBe("confirmed_existing_payment");
    expect(legacyCalls).toEqual(["member-payment-id"]);
    expect(providerEvents[0].payload).toEqual({
      Order: "member-payment-id",
      Id: "legacy-event",
      CCode: "0",
    });
  });
});
