import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { applyProviderDeliveryStatus, resendCanonicalStatus } from "@/lib/messageStatus.server";

type ResendStatusEvent = {
  providerMessageId: string;
  providerStatus: string;
  occurredAt: string | null;
};

type ResendWebhookDeps = {
  persistEvent(input: {
    provider: "resend";
    eventKey: string;
    eventType: string;
    providerMessageId: string;
    payloadHash: string;
    payload: Record<string, unknown>;
  }): Promise<{ inserted: boolean; processed?: boolean; eventId?: string }>;
  applyStatus?(event: ResendStatusEvent): Promise<boolean>;
  markProcessed?(eventId: string | undefined): Promise<void>;
};

function decodeSecret(secret: string) {
  const encoded = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  return Buffer.from(encoded, "base64");
}

export function verifyResendWebhookSignature(
  rawBody: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string,
  now = new Date(),
) {
  if (!headers.id || !headers.timestamp || !headers.signature || !secret) return false;
  const timestampSeconds = Number(headers.timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(now.getTime() - timestampSeconds * 1_000) > 5 * 60_000) return false;
  const expected = createHmac("sha256", decodeSecret(secret))
    .update(`${headers.id}.${headers.timestamp}.${rawBody}`)
    .digest();
  return headers.signature
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .some((value) => {
      const encoded = value.startsWith("v1,") ? value.slice(3) : "";
      if (!encoded) return false;
      const actual = Buffer.from(encoded, "base64");
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    });
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function handleVerifiedResendWebhook(
  input: {
    rawBody: string;
    svixId: string | null;
    svixTimestamp: string | null;
    svixSignature: string | null;
  },
  config: { secret?: string; now?: Date; maxBodyBytes?: number },
  deps: ResendWebhookDeps,
) {
  if (!config.secret?.trim()) {
    return { ok: false as const, status: 503, reason: "missing_resend_webhook_secret" };
  }
  if (Buffer.byteLength(input.rawBody, "utf8") > (config.maxBodyBytes ?? 1_048_576)) {
    return { ok: false as const, status: 413, reason: "webhook_body_too_large" };
  }
  if (
    !verifyResendWebhookSignature(
      input.rawBody,
      { id: input.svixId, timestamp: input.svixTimestamp, signature: input.svixSignature },
      config.secret,
      config.now,
    )
  ) {
    return { ok: false as const, status: 401, reason: "invalid_signature" };
  }
  let payload: Record<string, unknown>;
  try {
    payload = asObject(JSON.parse(input.rawBody)) ?? {};
  } catch {
    return { ok: false as const, status: 400, reason: "invalid_json_body" };
  }
  const type = asString(payload.type);
  const data = asObject(payload.data);
  const providerMessageId = asString(data?.email_id);
  if (!type || !providerMessageId || !input.svixId) {
    return { ok: false as const, status: 400, reason: "malformed_resend_event" };
  }
  const providerStatus = type.replace(/^email\./, "");
  let persisted;
  try {
    persisted = await deps.persistEvent({
      provider: "resend",
      eventKey: input.svixId,
      eventType: type,
      providerMessageId,
      payloadHash: createHash("sha256").update(input.rawBody).digest("hex"),
      payload: {
        type,
        email_id: providerMessageId,
        created_at: asString(payload.created_at),
        bounce_type: asString(asObject(data?.bounce)?.type),
      },
    });
  } catch {
    return { ok: false as const, status: 503, reason: "webhook_storage_failed" };
  }
  if (!persisted.inserted && persisted.processed !== false) {
    return { ok: true as const, status: 200, processed: 0, duplicates: 1 };
  }
  try {
    const matched =
      (await deps.applyStatus?.({
        providerMessageId,
        providerStatus,
        occurredAt: asString(payload.created_at),
      })) ?? true;
    if (!matched) {
      return { ok: false as const, status: 503, reason: "webhook_delivery_unmatched" };
    }
    await deps.markProcessed?.(persisted.eventId);
  } catch {
    return { ok: false as const, status: 500, reason: "webhook_processing_failed" };
  }
  return { ok: true as const, status: 200, processed: 1, duplicates: 0 };
}

function buildResendWebhookDeps(): ResendWebhookDeps {
  const db = supabaseAdmin as any;
  return {
    async persistEvent(input) {
      const inserted = await db
        .from("message_webhook_events")
        .insert({
          provider: input.provider,
          event_key: input.eventKey,
          event_type: input.eventType,
          provider_message_id: input.providerMessageId,
          payload_hash: input.payloadHash,
          payload: input.payload,
        })
        .select("id,processed_at")
        .single();
      if (!inserted.error) return { inserted: true, processed: false, eventId: inserted.data.id };
      if (inserted.error.code !== "23505") throw inserted.error;
      const existing = await db
        .from("message_webhook_events")
        .select("id,processed_at")
        .eq("provider", "resend")
        .eq("event_key", input.eventKey)
        .single();
      if (existing.error) throw existing.error;
      return {
        inserted: false,
        processed: Boolean(existing.data.processed_at),
        eventId: existing.data.id,
      };
    },
    async applyStatus(event) {
      const status = resendCanonicalStatus(event.providerStatus);
      if (!status) return true;
      const occurredAt = event.occurredAt ?? new Date().toISOString();
      const applied = await applyProviderDeliveryStatus({
        provider: "resend",
        providerMessageId: event.providerMessageId,
        incomingStatus: status,
        providerStatus: event.providerStatus,
        occurredAt,
        errorMessage: ["bounced", "failed", "complained", "suppressed"].includes(
          event.providerStatus,
        )
          ? `resend_${event.providerStatus}`
          : null,
        failureClass: ["dead_letter", "suppressed"].includes(status) ? "permanent" : null,
      });
      if (!applied.matched) return false;
      return true;
    },
    async markProcessed(eventId) {
      if (!eventId) return;
      const { error } = await db
        .from("message_webhook_events")
        .update({ processed_at: new Date().toISOString(), processing_error: null })
        .eq("id", eventId);
      if (error) throw error;
    },
  };
}

export async function ingestResendWebhook(input: {
  rawBody: string;
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
}) {
  return handleVerifiedResendWebhook(
    input,
    { secret: process.env.RESEND_WEBHOOK_SECRET?.trim() },
    buildResendWebhookDeps(),
  );
}
