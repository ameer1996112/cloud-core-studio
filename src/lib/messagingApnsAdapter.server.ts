import type { ApnsAlertPayload } from "@/lib/apns.server";

type ApnsToken = { id: string; token: string };
type ApnsProviderResult =
  | { ok: true; apnsId: string | null }
  | { ok: false; error?: string; apnsId?: string | null; skipped?: string };

export async function sendApnsDelivery(
  tokens: readonly ApnsToken[],
  payload: ApnsAlertPayload,
  deps: {
    send(token: string, payload: ApnsAlertPayload): Promise<ApnsProviderResult>;
    deactivate(tokenId: string): Promise<unknown>;
  },
) {
  if (!tokens.length) {
    return {
      ok: false as const,
      failureClass: "configuration" as const,
      error: "no_active_push_token",
    };
  }
  let successes = 0;
  let permanentFailures = 0;
  let providerMessageId: string | null = null;
  for (const token of tokens) {
    const result = await deps.send(token.token, payload);
    if (result.ok) {
      successes += 1;
      providerMessageId ??= result.apnsId;
      continue;
    }
    const providerError = result.error ?? result.skipped ?? "apns_delivery_failed";
    const permanent = /BadDeviceToken|Unregistered|DeviceTokenNotForTopic/i.test(providerError);
    if (permanent) {
      permanentFailures += 1;
      await deps.deactivate(token.id);
    }
  }
  if (successes) return { ok: true as const, providerMessageId, status: "sent" as const };
  return {
    ok: false as const,
    failureClass:
      permanentFailures === tokens.length ? ("permanent" as const) : ("transient" as const),
    error: "apns_delivery_failed",
  };
}
