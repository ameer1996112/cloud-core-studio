import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../../src/routes/api/public/payments/hyp.return.ts", import.meta.url),
  "utf8",
);
const webhookSource = await readFile(
  new URL("../../src/routes/api/public/webhooks/payments.$provider.ts", import.meta.url),
  "utf8",
);
const notificationSource = await readFile(
  new URL("../../src/lib/subscriptions.server.ts", import.meta.url),
  "utf8",
);

test("adult trial HYP browser returns never confirm or fail the payment", () => {
  const adultBlock = source.slice(
    source.indexOf("const adultTrialPayment"),
    source.indexOf('if (returnStatus === "cancel")', source.indexOf("const adultTrialPayment")),
  );

  expect(adultBlock).toContain("A customer browser return is not provider confirmation");
  expect(adultBlock).toContain('adultTrialPayment.status === "paid"');
  expect(adultBlock).not.toContain("confirmVerifiedAdultTrialHypPayment");
  expect(adultBlock).not.toContain("failAdultTrialHypPayment");
});

test("legacy member SNS is isolated from Adult signed-form confirmation", () => {
  expect(webhookSource).toContain('"legacy_sns_webhook"');
  expect(webhookSource).toContain("hasConfiguredHypWebhookToken");
  expect(webhookSource).toContain('"signed_callback"');
  expect(webhookSource).toContain("SUBSCRIPTION_AUTOMATION_TOKEN");
  expect(notificationSource).toContain(
    'evidence !== "signed_callback" || (await validateHypRedirect(params))',
  );
  expect(notificationSource).toContain("adultTrialNotificationDisposition(evidence)");
  expect(notificationSource).toContain(
    "Do not create an idempotency record until HYP has authenticated",
  );
});
