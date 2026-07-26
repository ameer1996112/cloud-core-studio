import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { DeliveryStatus, MessageLanguage } from "@/lib/messaging.types";
import { isWhatsappOptOut } from "@/lib/messagingPolicy";
import { normalizeOfficialWhatsappRecipient } from "@/lib/officialWhatsapp.server";
import { getMetaTemplateVariant, renderMessageContent } from "@/lib/messageTemplateCatalog";
import { applyProviderDeliveryStatus } from "@/lib/messageStatus.server";

type JsonObject = Record<string, unknown>;

export type OfficialWhatsappStatusUpdate = {
  messageId: string;
  status: string;
  timestamp: string | null;
  error: string | null;
};

export type OfficialWhatsappInboundMessage = {
  messageId: string;
  from: string;
  timestamp: string | null;
  kind: "text" | "interactive" | "media" | "unsupported";
  text: string | null;
  messageType: string;
  media: {
    id: string;
    mimeType: string | null;
    caption: string | null;
    filename: string | null;
  } | null;
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

export function parseOfficialWhatsappInboundMessages(
  payload: unknown,
): OfficialWhatsappInboundMessage[] {
  const root = asObject(payload);
  if (!root) return [];
  const inbound: OfficialWhatsappInboundMessage[] = [];
  for (const entry of asArray(root.entry)) {
    for (const change of asArray(asObject(entry)?.changes)) {
      const value = asObject(asObject(change)?.value);
      if (!value) continue;
      for (const messageValue of asArray(value.messages)) {
        const message = asObject(messageValue);
        const messageId = asString(message?.id);
        const from = asString(message?.from);
        const messageType = asString(message?.type)?.toLowerCase() ?? "unknown";
        if (!messageId || !from) continue;

        const textBody = asString(asObject(message?.text)?.body);
        const button = asObject(message?.button);
        const interactive = asObject(message?.interactive);
        const buttonReply = asObject(interactive?.button_reply);
        const listReply = asObject(interactive?.list_reply);
        const interactiveText =
          asString(button?.text) ?? asString(buttonReply?.title) ?? asString(listReply?.title);
        const mediaObject = ["image", "video", "audio", "document", "sticker"]
          .map((key) => asObject(message?.[key]))
          .find(Boolean);
        const mediaId = asString(mediaObject?.id);

        inbound.push({
          messageId,
          from,
          timestamp: asString(message?.timestamp),
          kind: textBody
            ? "text"
            : interactiveText
              ? "interactive"
              : mediaId
                ? "media"
                : "unsupported",
          text: textBody ?? interactiveText,
          messageType,
          media: mediaId
            ? {
                id: mediaId,
                mimeType: asString(mediaObject?.mime_type),
                caption: asString(mediaObject?.caption),
                filename: asString(mediaObject?.filename),
              }
            : null,
        });
      }
    }
  }
  return inbound;
}

type VerifiedWhatsappWebhookDeps = {
  persistEvent(input: {
    provider: "whatsapp";
    eventKey: string;
    eventType: string;
    providerMessageId: string;
    payloadHash: string;
    payload: Record<string, unknown>;
  }): Promise<{ inserted: boolean; processed?: boolean; eventId?: string }>;
  applyStatus?(status: OfficialWhatsappStatusUpdate): Promise<boolean>;
  openConversation?(input: { from: string; receivedAt: string; text: string | null }): Promise<{
    conversationId: string;
    newlyOpened: boolean;
    acknowledgementNeeded: boolean;
    openGeneration: string;
    memberId: string | null;
    language: MessageLanguage;
  }>;
  recordInbound?(input: {
    message: OfficialWhatsappInboundMessage;
    conversationId: string;
    memberId: string | null;
  }): Promise<void>;
  optOutWhatsapp?(input: { from: string; memberId: string | null }): Promise<void>;
  enqueueAcknowledgement?(input: {
    conversationId: string;
    memberId: string | null;
    to: string;
    language: MessageLanguage;
    inboundMessageId: string;
    openGeneration: string;
  }): Promise<void>;
  alertAdmins?(input: {
    conversationId: string;
    inboundMessageId: string;
    memberId: string | null;
  }): Promise<void>;
  markProcessed?(eventId: string | undefined): Promise<void>;
};

function verifiedIdentity(payload: unknown, wabaId: string, phoneNumberId: string) {
  const root = asObject(payload);
  const entries = asArray(root?.entry);
  if (!entries.length) return false;
  for (const entryValue of entries) {
    const entry = asObject(entryValue);
    if (asString(entry?.id) !== wabaId) return false;
    for (const change of asArray(entry?.changes)) {
      const value = asObject(asObject(change)?.value);
      if (!value) return false;
      if (asString(asObject(value.metadata)?.phone_number_id) !== phoneNumberId) return false;
    }
  }
  return true;
}

function inferredLanguage(text: string | null): MessageLanguage {
  if (text && /[\u0600-\u06ff]/u.test(text)) return "ar";
  if (text && /[\u0590-\u05ff]/u.test(text)) return "he";
  return "en";
}

export async function handleVerifiedWhatsappWebhook(
  input: { rawBody: string; signature: string | null },
  config: { appSecret?: string; wabaId?: string; phoneNumberId?: string; maxBodyBytes?: number },
  deps: VerifiedWhatsappWebhookDeps,
) {
  if (!config.appSecret?.trim()) {
    return { ok: false as const, status: 503, reason: "missing_whatsapp_app_secret" };
  }
  if (Buffer.byteLength(input.rawBody, "utf8") > (config.maxBodyBytes ?? 1_048_576)) {
    return { ok: false as const, status: 413, reason: "webhook_body_too_large" };
  }
  if (!verifyMetaSignature(input.rawBody, input.signature, config.appSecret)) {
    return { ok: false as const, status: 401, reason: "invalid_signature" };
  }
  if (!config.wabaId || !config.phoneNumberId) {
    return { ok: false as const, status: 503, reason: "missing_whatsapp_identity_config" };
  }
  let payload: unknown;
  try {
    payload = input.rawBody.trim() ? JSON.parse(input.rawBody) : {};
  } catch {
    return { ok: false as const, status: 400, reason: "invalid_json_body" };
  }
  if (!verifiedIdentity(payload, config.wabaId, config.phoneNumberId)) {
    return { ok: false as const, status: 401, reason: "whatsapp_identity_mismatch" };
  }

  const payloadHash = createHash("sha256").update(input.rawBody).digest("hex");
  const statuses = parseOfficialWhatsappStatuses(payload);
  const inbound = parseOfficialWhatsappInboundMessages(payload);
  let processed = 0;
  let duplicates = 0;
  for (const status of statuses) {
    let persisted;
    try {
      persisted = await deps.persistEvent({
        provider: "whatsapp",
        eventKey: `status:${status.messageId}:${status.status}:${status.timestamp ?? "unknown"}`,
        eventType: `message_status_${status.status}`,
        providerMessageId: status.messageId,
        payloadHash,
        payload: { ...status },
      });
    } catch {
      return { ok: false as const, status: 503, reason: "webhook_storage_failed" };
    }
    if (!persisted.inserted && persisted.processed !== false) {
      duplicates += 1;
      continue;
    }
    try {
      const matched = (await deps.applyStatus?.(status)) ?? true;
      if (!matched) {
        return { ok: false as const, status: 503, reason: "webhook_delivery_unmatched" };
      }
      await deps.markProcessed?.(persisted.eventId);
      processed += 1;
    } catch {
      return { ok: false as const, status: 500, reason: "webhook_processing_failed" };
    }
  }

  for (const message of inbound) {
    let persisted;
    try {
      persisted = await deps.persistEvent({
        provider: "whatsapp",
        eventKey: `message:${message.messageId}`,
        eventType: `inbound_${message.messageType}`,
        providerMessageId: message.messageId,
        payloadHash,
        payload: { ...message },
      });
    } catch {
      return { ok: false as const, status: 503, reason: "webhook_storage_failed" };
    }
    if (!persisted.inserted && persisted.processed !== false) {
      duplicates += 1;
      continue;
    }
    try {
      const receivedAt = timestampToIso(message.timestamp);
      const conversation = deps.openConversation
        ? await deps.openConversation({ from: message.from, receivedAt, text: message.text })
        : {
            conversationId: "",
            newlyOpened: false,
            acknowledgementNeeded: false,
            openGeneration: "",
            memberId: null,
            language: inferredLanguage(message.text),
          };
      await deps.recordInbound?.({
        message,
        conversationId: conversation.conversationId,
        memberId: conversation.memberId,
      });
      if (message.text && isWhatsappOptOut(message.text)) {
        await deps.optOutWhatsapp?.({ from: message.from, memberId: conversation.memberId });
      }
      if (conversation.acknowledgementNeeded) {
        await deps.enqueueAcknowledgement?.({
          conversationId: conversation.conversationId,
          memberId: conversation.memberId,
          to: message.from,
          language: conversation.language,
          inboundMessageId: message.messageId,
          openGeneration: conversation.openGeneration,
        });
      }
      await deps.alertAdmins?.({
        conversationId: conversation.conversationId,
        inboundMessageId: message.messageId,
        memberId: conversation.memberId,
      });
      await deps.markProcessed?.(persisted.eventId);
      processed += 1;
    } catch {
      return { ok: false as const, status: 500, reason: "webhook_processing_failed" };
    }
  }
  return { ok: true as const, status: 200, processed, duplicates };
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

function buildVerifiedWhatsappWebhookDeps(): VerifiedWhatsappWebhookDeps {
  const db = supabaseAdmin as any;
  return {
    async persistEvent(input) {
      const { data, error } = await db
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
      if (!error) return { inserted: true, processed: false, eventId: data.id };
      if (error.code !== "23505") throw error;
      const existing = await db
        .from("message_webhook_events")
        .select("id,processed_at")
        .eq("provider", "whatsapp")
        .eq("event_key", input.eventKey)
        .single();
      if (existing.error) throw existing.error;
      return {
        inserted: false,
        processed: Boolean(existing.data.processed_at),
        eventId: existing.data.id,
      };
    },
    async applyStatus(input) {
      const incoming = input.status as DeliveryStatus;
      if (!["sent", "delivered", "read", "failed"].includes(incoming)) return true;
      const applied = await applyProviderDeliveryStatus({
        provider: "official_whatsapp",
        providerMessageId: input.messageId,
        incomingStatus: incoming as "sent" | "delivered" | "read" | "failed",
        providerStatus: input.status,
        occurredAt: timestampToIso(input.timestamp),
        errorMessage: input.error ?? (incoming === "failed" ? "whatsapp_delivery_failed" : null),
        failureClass: incoming === "failed" ? "permanent" : null,
      });
      if (!applied.matched) return false;

      await buildOfficialWhatsappWebhookDeps().updateMessageStatus(input);
      return true;
    },
    async openConversation(input) {
      const normalized = normalizeOfficialWhatsappRecipient(input.from) ?? input.from;
      const membersResult = await db
        .from("members")
        .select("id,phone,preferred_language")
        .not("phone", "is", null)
        .limit(10_000);
      if (membersResult.error) throw membersResult.error;
      const matches = (membersResult.data ?? []).filter(
        (member: { phone: string | null }) =>
          normalizeOfficialWhatsappRecipient(member.phone) === normalized,
      );
      const matchedMember = matches.length === 1 ? matches[0] : null;
      const opened = await db.rpc("open_whatsapp_message_conversation", {
        p_external_contact_id: normalized,
        p_member_id: matchedMember?.id ?? null,
        p_received_at: input.receivedAt,
      });
      if (opened.error) throw opened.error;
      const openedRow = Array.isArray(opened.data) ? opened.data[0] : opened.data;
      if (!openedRow?.conversation_id) throw new Error("conversation_open_failed");
      const memberLanguage = matchedMember?.preferred_language;
      const language: MessageLanguage = ["he", "ar", "en"].includes(memberLanguage)
        ? memberLanguage
        : inferredLanguage(input.text);
      return {
        conversationId: openedRow.conversation_id,
        newlyOpened: openedRow.newly_opened === true,
        acknowledgementNeeded: openedRow.acknowledgement_needed === true,
        openGeneration: openedRow.open_generation,
        memberId: matchedMember?.id ?? null,
        language,
      };
    },
    async recordInbound(input) {
      const { error } = await db.from("messages").upsert(
        {
          conversation_id: input.conversationId,
          member_id: input.memberId,
          direction: "inbound",
          audience: "admin",
          event_type: "human_handoff",
          language: inferredLanguage(input.message.text),
          template_version: "v2",
          body: input.message.text ?? input.message.media?.caption ?? null,
          content: {
            provider_message_id: input.message.messageId,
            kind: input.message.kind,
            message_type: input.message.messageType,
            media: input.message.media,
          },
          member_visible: false,
          idempotency_key: `whatsapp:inbound:${input.message.messageId}`,
        },
        { onConflict: "idempotency_key", ignoreDuplicates: true },
      );
      if (error) throw error;
    },
    async optOutWhatsapp(input) {
      if (!input.memberId) return;
      const { error } = await db
        .from("member_notification_preferences")
        .update({
          whatsapp_enabled: false,
          whatsapp_opted_out_at: new Date().toISOString(),
          whatsapp_consent_source: "whatsapp_keyword_opt_out",
          updated_at: new Date().toISOString(),
        })
        .eq("member_id", input.memberId);
      if (error) throw error;
    },
    async enqueueAcknowledgement(input) {
      const variant = getMetaTemplateVariant("human_handoff", input.language);
      if (!variant) throw new Error("missing_handoff_template_locale");
      const deployment = await db
        .from("whatsapp_template_deployments")
        .select("approval_status")
        .eq("waba_id", process.env.META_WABA_ID?.trim() ?? "")
        .eq("template_name", variant.name)
        .eq("language", variant.metaLanguage)
        .maybeSingle();
      if (deployment.error) throw deployment.error;
      const approved = deployment.data?.approval_status?.toUpperCase() === "APPROVED";
      const genericName =
        input.language === "he" ? "היי" : input.language === "ar" ? "مرحباً" : "Hi";
      const rendered = renderMessageContent("human_handoff", input.language, {
        member_name: genericName,
      });
      const message = await db
        .from("messages")
        .upsert(
          {
            conversation_id: input.conversationId,
            member_id: input.memberId,
            direction: "outbound",
            audience: "admin",
            event_type: "human_handoff",
            language: input.language,
            template_key: variant.name,
            template_version: "v2",
            body: rendered.body,
            content: { variables: { member_name: genericName } },
            member_visible: false,
            idempotency_key: `whatsapp:handoff-ack:${input.conversationId}:${input.openGeneration}`,
          },
          { onConflict: "idempotency_key" },
        )
        .select("id")
        .single();
      if (message.error) throw message.error;
      const delivery = await db.from("message_deliveries").upsert(
        {
          message_id: message.data.id,
          channel: "whatsapp",
          provider: "official_whatsapp",
          recipient_address: normalizeOfficialWhatsappRecipient(input.to),
          status: approved ? "queued" : "suppressed",
          failure_class: approved ? null : "configuration",
          error_code: approved ? null : "whatsapp_template_locale_unapproved",
          provider_payload: {
            template_name: variant.name,
            template_language: variant.metaLanguage,
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: genericName }],
              },
            ],
          },
          idempotency_key: `whatsapp:handoff-ack:${input.conversationId}:${input.openGeneration}:delivery`,
        },
        { onConflict: "idempotency_key", ignoreDuplicates: true },
      );
      if (delivery.error) throw delivery.error;
      const acknowledged = await db
        .from("message_conversations")
        .update({ acknowledged_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", input.conversationId);
      if (acknowledged.error) throw acknowledged.error;
    },
    async alertAdmins(input) {
      const message = await db
        .from("messages")
        .upsert(
          {
            conversation_id: input.conversationId,
            member_id: input.memberId,
            direction: "outbound",
            audience: "admin",
            event_type: "human_handoff",
            language: "en",
            template_key: "admin_whatsapp_handoff_v2",
            template_version: "v2",
            subject: "WhatsApp reply needs attention",
            body: "A WhatsApp conversation has a new reply.",
            content: { conversation_id: input.conversationId },
            member_visible: false,
            idempotency_key: `admin:handoff:${input.inboundMessageId}`,
          },
          { onConflict: "idempotency_key" },
        )
        .select("id")
        .single();
      if (message.error) throw message.error;
      const deliveries = await db.from("message_deliveries").upsert(
        [
          {
            message_id: message.data.id,
            channel: "in_app",
            provider: "internal",
            recipient_address: "admin_group",
            status: "delivered",
            delivered_at: new Date().toISOString(),
            idempotency_key: `admin:handoff:${input.inboundMessageId}:in_app`,
          },
          {
            message_id: message.data.id,
            channel: "push",
            provider: "apns",
            recipient_address: "admin_group",
            status: "queued",
            idempotency_key: `admin:handoff:${input.inboundMessageId}:push`,
          },
        ],
        { onConflict: "idempotency_key", ignoreDuplicates: true },
      );
      if (deliveries.error) throw deliveries.error;
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

export async function ingestOfficialWhatsappWebhook(input: {
  rawBody: string;
  signature: string | null;
}) {
  return handleVerifiedWhatsappWebhook(
    input,
    {
      appSecret: process.env.WHATSAPP_APP_SECRET?.trim(),
      wabaId: process.env.META_WABA_ID?.trim(),
      phoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim(),
    },
    buildVerifiedWhatsappWebhookDeps(),
  );
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
