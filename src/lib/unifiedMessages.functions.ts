import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getMetaTemplateVariant, renderMessageContent } from "@/lib/messageTemplateCatalog";
import { conversationReplyMode } from "@/lib/messagingPolicy";

async function requireAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const profile = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile.error) throw profile.error;
  if (profile.data?.role !== "admin") throw new Error("forbidden");
  return db;
}

export const listCanonicalConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireAdmin(context.userId);
    const result = await db
      .from("message_conversations")
      .select(
        "id,status,assigned_to,member_id,last_inbound_at,service_window_expires_at,created_at,member:members(name)",
      )
      .order("last_inbound_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (result.error) throw result.error;
    return result.data ?? [];
  });

export const getCanonicalConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ conversationId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const db = await requireAdmin(context.userId);
    const [conversation, messages] = await Promise.all([
      db.from("message_conversations").select("*").eq("id", data.conversationId).single(),
      db
        .from("messages")
        .select("id,direction,body,content,created_at")
        .eq("conversation_id", data.conversationId)
        .order("created_at", { ascending: true })
        .limit(500),
    ]);
    if (conversation.error) throw conversation.error;
    if (messages.error) throw messages.error;
    return { conversation: conversation.data, messages: messages.data ?? [] };
  });

export const listCanonicalDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireAdmin(context.userId);
    const result = await db
      .from("message_deliveries")
      .select(
        "id,message_id,channel,provider,recipient_address,status,provider_status,attempt_count,error_code,error_message,scheduled_for,last_attempt_at,accepted_at,sent_at,delivered_at,read_at,failed_at,created_at,updated_at,message:messages(event_type,subject,language,template_key,created_at,member:members(name))",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (result.error) throw result.error;
    return result.data ?? [];
  });

export const listWhatsappTemplateDeployments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireAdmin(context.userId);
    const result = await db
      .from("whatsapp_template_deployments")
      .select("*")
      .order("template_name", { ascending: true })
      .order("language", { ascending: true });
    if (result.error) throw result.error;
    return result.data ?? [];
  });

const conversationActionSchema = z.object({ conversationId: z.string().uuid() });

export const claimCanonicalConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => conversationActionSchema.parse(data))
  .handler(async ({ context, data }) => {
    const db = await requireAdmin(context.userId);
    const result = await db
      .from("message_conversations")
      .update({
        status: "claimed",
        assigned_to: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.conversationId)
      .eq("status", "unassigned")
      .select("id")
      .maybeSingle();
    if (result.error) throw result.error;
    return { ok: Boolean(result.data) };
  });

export const releaseCanonicalConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => conversationActionSchema.parse(data))
  .handler(async ({ context, data }) => {
    const db = await requireAdmin(context.userId);
    const result = await db
      .from("message_conversations")
      .update({ status: "unassigned", assigned_to: null, updated_at: new Date().toISOString() })
      .eq("id", data.conversationId)
      .eq("assigned_to", context.userId)
      .select("id")
      .maybeSingle();
    if (result.error) throw result.error;
    return { ok: Boolean(result.data) };
  });

export const resolveCanonicalConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => conversationActionSchema.parse(data))
  .handler(async ({ context, data }) => {
    const db = await requireAdmin(context.userId);
    const now = new Date().toISOString();
    const result = await db
      .from("message_conversations")
      .update({ status: "resolved", assigned_to: null, resolved_at: now, updated_at: now })
      .eq("id", data.conversationId)
      .select("id")
      .maybeSingle();
    if (result.error) throw result.error;
    return { ok: Boolean(result.data) };
  });

export const linkCanonicalGuestConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ conversationId: z.string().uuid(), memberId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const db = await requireAdmin(context.userId);
    const member = await db.from("members").select("id").eq("id", data.memberId).maybeSingle();
    if (member.error) throw member.error;
    if (!member.data) throw new Error("member_not_found");
    const result = await db
      .from("message_conversations")
      .update({ member_id: data.memberId, updated_at: new Date().toISOString() })
      .eq("id", data.conversationId);
    if (result.error) throw result.error;
    return { ok: true };
  });

export const replyCanonicalConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        conversationId: z.string().uuid(),
        text: z.string().trim().max(4096).optional(),
        useHandoffTemplate: z.boolean().optional(),
      })
      .refine((value) => Boolean(value.text || value.useHandoffTemplate), "reply_required")
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const db = await requireAdmin(context.userId);
    const conversation = await db
      .from("message_conversations")
      .select(
        "id,status,assigned_to,external_contact_id,member_id,service_window_expires_at,member:members(name,preferred_language)",
      )
      .eq("id", data.conversationId)
      .single();
    if (conversation.error) throw conversation.error;
    if (
      conversation.data.status !== "claimed" ||
      conversation.data.assigned_to !== context.userId
    ) {
      throw new Error("conversation_must_be_claimed_by_current_admin");
    }
    const replyMode = conversationReplyMode(
      conversation.data.service_window_expires_at,
      new Date(),
      data.useHandoffTemplate === true,
    );
    if (replyMode === "rejected") throw new Error("customer_service_window_closed");
    const windowOpen = replyMode === "freeform";
    const member = Array.isArray(conversation.data.member)
      ? conversation.data.member[0]
      : conversation.data.member;
    const locale = ["he", "ar", "en"].includes(member?.preferred_language)
      ? member.preferred_language
      : "en";
    const messageKey = `admin:conversation:${data.conversationId}:${randomUUID()}`;
    let body = data.text ?? "";
    let providerPayload: Record<string, unknown> = { kind: "freeform", text: body };
    let templateKey = "whatsapp_freeform_v2";
    if (!windowOpen || data.useHandoffTemplate) {
      const variant = getMetaTemplateVariant("human_handoff", locale);
      if (!variant) throw new Error("missing_handoff_template_locale");
      const deployment = await db
        .from("whatsapp_template_deployments")
        .select("approval_status")
        .eq("waba_id", process.env.META_WABA_ID?.trim() ?? "")
        .eq("template_name", variant.name)
        .eq("language", variant.metaLanguage)
        .maybeSingle();
      if (deployment.error) throw deployment.error;
      if (deployment.data?.approval_status?.toUpperCase() !== "APPROVED") {
        throw new Error("handoff_template_locale_unapproved");
      }
      const memberName =
        member?.name || (locale === "he" ? "היי" : locale === "ar" ? "مرحباً" : "Hi");
      body = renderMessageContent("human_handoff", locale, { member_name: memberName }).body;
      templateKey = variant.name;
      providerPayload = {
        kind: "template",
        template_name: variant.name,
        template_language: variant.metaLanguage,
        parameters: [memberName],
      };
    }
    const message = await db
      .from("messages")
      .insert({
        conversation_id: data.conversationId,
        member_id: conversation.data.member_id,
        direction: "outbound",
        audience: "admin",
        event_type: "human_handoff",
        language: locale,
        template_key: templateKey,
        template_version: "v2",
        body,
        content: { agent_id: context.userId },
        member_visible: false,
        idempotency_key: messageKey,
      })
      .select("id")
      .single();
    if (message.error) throw message.error;
    const delivery = await db.from("message_deliveries").insert({
      message_id: message.data.id,
      channel: "whatsapp",
      provider: "official_whatsapp",
      recipient_address: conversation.data.external_contact_id,
      status: "queued",
      provider_payload: providerPayload,
      idempotency_key: `${messageKey}:whatsapp`,
    });
    if (delivery.error) throw delivery.error;
    return { ok: true, queued: true, windowOpen: Boolean(windowOpen) };
  });

export const retryCanonicalDeliveryAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ deliveryId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { retryCanonicalDelivery } = await import("@/lib/unifiedMessaging.server");
    return retryCanonicalDelivery(data.deliveryId);
  });
