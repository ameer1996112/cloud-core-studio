import { afterEach, describe, expect, test } from "bun:test";
import { createHypPaymentPage, type HypConfig } from "../../src/lib/hyp.server";

const config: HypConfig = {
  payBaseUrl: "https://pay.hyp.example/p/",
  user: "api-key",
  password: "passp",
  terminalNumber: "4502357839",
  recurringMode: "hyp_managed_hk",
  publicBaseUrl: "https://cloudandcorestudio.com",
  mode: "live",
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function capturePaymentPageRequest() {
  let requestedUrl = "";
  globalThis.fetch = (async (input) => {
    requestedUrl = String(input);
    return new Response("action=pay&signature=checkout-signature&Order=payment-1");
  }) as typeof fetch;

  return {
    url: () => new URL(requestedUrl),
  };
}

describe("HYP hosted payment page", () => {
  test("one-time checkout lets HYP display every eligible payment method", async () => {
    const request = capturePaymentPageRequest();

    await createHypPaymentPage(
      {
        paymentId: "payment-1",
        amountAgorot: 28000,
        paymentMethod: "card",
      },
      config,
    );

    expect(request.url().searchParams.get("hideBtns")).toBe("false");
  });

  test("recurring checkout stays card-only", async () => {
    const request = capturePaymentPageRequest();

    await createHypPaymentPage(
      {
        paymentId: "payment-1",
        amountAgorot: 35000,
        paymentMethod: "card",
        recurring: true,
        recurringMode: "hyp_managed_hk",
      },
      config,
    );

    expect(request.url().searchParams.get("hideBtns")).toBe("true");
    expect(request.url().searchParams.get("HK")).toBe("True");
  });

  test("Bit can buy a monthly plan once without creating a subscription", async () => {
    const request = capturePaymentPageRequest();

    await createHypPaymentPage(
      {
        paymentId: "payment-1",
        amountAgorot: 28000,
        paymentMethod: "bit",
        recurring: false,
      },
      config,
    );

    expect(request.url().searchParams.get("hideBtns")).toBe("false");
    expect(request.url().searchParams.has("HK")).toBe(false);
  });
});
