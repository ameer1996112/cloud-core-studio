export type HypNotificationEvidence =
  | "signed_callback"
  | "legacy_sns_webhook"
  | "server_inquiry"
  | "server_token_charge";

export function authorizeLegacyHypNotification(input: {
  configuredToken: string | undefined;
  suppliedToken: string | undefined;
}) {
  const configured = input.configuredToken?.trim();
  if (!configured) return true;
  return input.suppliedToken?.trim() === configured;
}

export function adultTrialNotificationDisposition(evidence: HypNotificationEvidence) {
  return evidence === "signed_callback"
    ? "confirm_adult_trial"
    : "adult_trial_legacy_notification_rejected";
}

export function adultHypProviderEventPayload(params: URLSearchParams) {
  const orderId = params.get("Order") ?? params.get("uniqueID") ?? params.get("uniqueId");
  const providerEventId = params.get("Id") ?? params.get("txId");
  const resultCode = params.get("CCode");
  const amount = params.get("Amount") ?? params.get("amount");
  const configuredCurrency = params.get("Currency") ?? params.get("currency");
  const coin = params.get("Coin") ?? params.get("coin");
  const currency = configuredCurrency ?? (coin === "1" ? "ILS" : coin);

  return Object.fromEntries(
    [
      ["order_id", orderId],
      ["provider_event_id", providerEventId],
      ["provider_result_code", resultCode],
      ["amount", amount],
      ["currency", currency],
    ].filter(([, value]) => value),
  );
}
