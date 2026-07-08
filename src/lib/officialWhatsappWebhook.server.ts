import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type JsonObject = Record<string, unknown>;

export type OfficialWhatsappStatusUpdate = {
  messageId: string;
  status: string;
  timestamp: string | null;
  error: string | null;
};

type OfficialWhatsappWebhookDeps = {
  updateMessageStatus(input: OfficialWhatsappStatusUpdate): Promise<void>;
};

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstWebhookError(status: JsonObject) {
  const firstError = asObject(asArray(status.errors)[0]);
  if (!firstError) return null;

  const code = firstError.code == null ? null : String(firstError.code);
  const title = asString(firstError.title);
  const message = asString(firstError.message);
  return [code, title, message].filter(Boolean).join(": ") || null;
}

export function parseOfficialWhatsappStatuses(payload: unknown): OfficialWhatsappStatusUpdate[] {
  const root = asObject(payload);
  if (!root) return [];

  const updates: OfficialWhatsappStatusUpdate[] = [];
  for (const entry of asArray(root.entry)) {
    const entryObject = asObject(entry);
    if (!entryObject) continue;

    for (const change of asArray(entryObject.changes)) {
      const changeObject = asObject(change);
      const value = asObject(changeObject?.value);
      if (!value) continue;

      for (const status of asArray(value.statuses)) {
        const statusObject = asObject(status);
        if (!statusObject) continue;

        const messageId = asString(statusObject.id);
        const nextStatus = asString(statusObject.status);
        if (!messageId || !nextStatus) continue;

        updates.push({
          messageId,
          status: nextStatus.toLowerCase(),
          timestamp: asString(statusObject.timestamp),
          error: firstWebhookError(statusObject),
        });
      }
    }
  }

  return updates;
}

export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
) {
  const signature = signatureHeader?.trim() ?? "";
  if (!signature.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const actual = signature.slice("sha256=".length);

  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");
  return (
    expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

function timestampToIso(value: string | null) {
  if (!value) return new Date().toISOString();
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return new Date().toISOString();
  return new Date(seconds * 1000).toISOString();
}

function toStoredStatus(status: string) {
  if (status === "failed") return "failed";
  if (["sent", "delivered", "read"].includes(status)) return "sent";
  return null;
}

function buildOfficialWhatsappWebhookDeps(): OfficialWhatsappWebhookDeps {
  return {
    async updateMessageStatus(input) {
      const storedStatus = toStoredStatus(input.status);
      if (!storedStatus) return;

      const update =
        storedStatus === "failed"
          ? {
              status: "failed",
              error_message: input.error ?? `official_whatsapp_${input.status}`,
              next_attempt_at: null,
            }
          : {
              status: "sent",
              sent_at: timestampToIso(input.timestamp),
              error_message: null,
              next_attempt_at: null,
            };

      const { error } = await supabaseAdmin
        .from("notification_logs")
        .update(update)
        .eq("provider", "official_whatsapp")
        .eq("channel", "whatsapp")
        .eq("provider_message_id", input.messageId);

      if (error) throw error;
    },
  };
}

export async function recordOfficialWhatsappStatuses(
  payload: unknown,
  deps: OfficialWhatsappWebhookDeps = buildOfficialWhatsappWebhookDeps(),
) {
  const updates = parseOfficialWhatsappStatuses(payload);
  for (const update of updates) {
    await deps.updateMessageStatus(update);
  }
  return { processed: updates.length };
}
