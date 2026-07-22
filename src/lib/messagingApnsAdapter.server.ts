import type { ApnsAlertPayload } from "@/lib/apns.server";

type ApnsToken = { id: string; token: string };
type ApnsProviderResult =
  | { ok: true; apnsId: string | null }
  | { ok: false; error?: string; apnsId?: string | null; skipped?: string };

export type ApnsTargetOutcome = {
  tokenId: string;
  status: "sent" | "failed";
  providerMessageId: string | null;
  failureClass: "permanent" | "transient" | "configuration" | null;
  errorCode: string | null;
};

export class ApnsPersistenceUncertainError extends Error {
  constructor(
    readonly tokenId: string,
    readonly providerMessageId: string | null,
    options: { cause?: unknown } = {},
  ) {
    super("apns_provider_result_persistence_uncertain", options);
  }
}

function classifyApnsFailure(providerError: string) {
  if (/BadDeviceToken/i.test(providerError)) {
    return { failureClass: "permanent" as const, errorCode: "apns_bad_device_token" };
  }
  if (/Unregistered/i.test(providerError)) {
    return { failureClass: "permanent" as const, errorCode: "apns_unregistered" };
  }
  if (/DeviceTokenNotForTopic/i.test(providerError)) {
    return { failureClass: "permanent" as const, errorCode: "apns_wrong_topic" };
  }
  if (/missing_apns_config/i.test(providerError)) {
    return { failureClass: "configuration" as const, errorCode: "apns_not_configured" };
  }
  return { failureClass: "transient" as const, errorCode: "apns_transient_failure" };
}

export async function sendApnsDelivery(
  tokens: readonly ApnsToken[],
  payload: ApnsAlertPayload,
  deps: {
    send(token: string, payload: ApnsAlertPayload): Promise<ApnsProviderResult>;
    deactivate(tokenId: string): Promise<unknown>;
    report?(outcome: ApnsTargetOutcome): Promise<unknown>;
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
  let transientFailures = 0;
  let configurationFailures = 0;
  let providerMessageId: string | null = null;
  const targetOutcomes: ApnsTargetOutcome[] = [];
  for (const token of tokens) {
    const result = await deps.send(token.token, payload);
    if (result.ok) {
      successes += 1;
      providerMessageId ??= result.apnsId;
      const outcome: ApnsTargetOutcome = {
        tokenId: token.id,
        status: "sent",
        providerMessageId: result.apnsId,
        failureClass: null,
        errorCode: null,
      };
      targetOutcomes.push(outcome);
      try {
        await deps.report?.(outcome);
      } catch (error) {
        throw new ApnsPersistenceUncertainError(token.id, result.apnsId, { cause: error });
      }
      continue;
    }
    const providerError = result.error ?? result.skipped ?? "apns_delivery_failed";
    const classification = classifyApnsFailure(providerError);
    if (classification.failureClass === "permanent") {
      permanentFailures += 1;
      await deps.deactivate(token.id);
    } else if (classification.failureClass === "configuration") {
      configurationFailures += 1;
    } else {
      transientFailures += 1;
    }
    const outcome: ApnsTargetOutcome = {
      tokenId: token.id,
      status: "failed",
      providerMessageId: result.apnsId ?? null,
      ...classification,
    };
    targetOutcomes.push(outcome);
    await deps.report?.(outcome);
  }
  if (transientFailures || configurationFailures) {
    return {
      ok: false as const,
      failureClass: configurationFailures ? ("configuration" as const) : ("transient" as const),
      error: configurationFailures ? "apns_not_configured" : "apns_delivery_failed",
      targetOutcomes,
    };
  }
  if (successes) {
    return {
      ok: true as const,
      providerMessageId,
      status: "sent" as const,
      targetOutcomes,
    };
  }
  return {
    ok: false as const,
    failureClass:
      permanentFailures === tokens.length ? ("permanent" as const) : ("transient" as const),
    error: "apns_delivery_failed",
    targetOutcomes,
  };
}
