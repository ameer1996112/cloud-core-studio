import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getMetaTemplateVariant, renderMessageContent } from "@/lib/messageTemplateCatalog";
import { MESSAGE_CHANNELS, type MessageEventType } from "@/lib/messaging.types";
import {
  conversationReplyMode,
  resolveMessagingRuntime,
  runtimeAllowsRolloutRecipient,
} from "@/lib/messagingPolicy";
import { NOTIFICATION_EVENT_CATALOG } from "@/lib/premiumNotificationCatalog";
import {
  buildPremiumJourneyPreviews,
  buildPremiumJourneyTestOutbox,
} from "@/lib/premiumJourneyLab";
import { kickUnifiedMessagingAfterCommit } from "@/lib/unifiedMessagingKick.server";
import { summarizeOutboxHealth } from "@/lib/messageOutboxMaintenance";
import {
  classifyDeliveryTraffic,
  buildDeliveryMonitorPage,
  firstRelation,
  type DeliveryMonitorAttempt,
  type DeliveryMonitorMember,
  type DeliveryMonitorMessage,
  type DeliveryMonitorRow,
  type DeliveryMonitorTarget,
} from "@/lib/deliveryMonitoring";

type RawDeliveryTrafficSource = {
  member_id: string | null;
  event_type: string | null;
  audience: string | null;
  template_version: string | null;
  legacy_source_table: string | null;
  content: { staff_test?: unknown; variables?: Record<string, unknown> } | null;
  outbox: { aggregate_type: string | null } | Array<{ aggregate_type: string | null }> | null;
};

type RawDeliveryMonitorMessage = Omit<DeliveryMonitorMessage, "member" | "recipient_name"> &
  RawDeliveryTrafficSource & {
    member: DeliveryMonitorMember | DeliveryMonitorMember[] | null;
  };

type RawDeliveryMonitorRow = Omit<
  DeliveryMonitorRow,
  "message" | "attempts" | "targets" | "recipient_contact"
> & {
  recipient_address: string | null;
  message: RawDeliveryMonitorMessage | RawDeliveryMonitorMessage[] | null;
  attempts: DeliveryMonitorAttempt[] | null;
  targets: DeliveryMonitorTarget[] | null;
};

function deliveryTrafficKind(message: RawDeliveryTrafficSource | null) {
  const outbox = firstRelation(message?.outbox);
  return classifyDeliveryTraffic({
    eventType: message?.event_type,
    audience: message?.audience,
    staffTest: message?.content?.staff_test,
    aggregateType: outbox?.aggregate_type,
    templateVersion: message?.template_version,
    legacySourceTable: message?.legacy_source_table,
  });
}

function maskedRecipient(value: string | null) {
  if (!value) return null;
  if (value.includes("@")) {
    const [local, domain] = value.split("@");
    return `${local?.slice(0, 1) ?? "•"}•••@${domain}`;
  }
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `••• ${digits.slice(-4)}` : "•••";
}

const messageEventSchema = z.enum(
  Object.keys(NOTIFICATION_EVENT_CATALOG) as [MessageEventType, ...MessageEventType[]],
);

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
  .inputValidator((data) =>
    z
      .object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        query: z.string().max(200).default(""),
        traffic: z.enum(["live", "test", "system", "historical", "all"]).default("live"),
        channel: z.enum(["all", ...MESSAGE_CHANNELS]).default("all"),
        status: z
          .enum([
            "all",
            "attention",
            "successful",
            "not_sent",
            "queued",
            "sending",
            "accepted",
            "sent",
            "delivered",
            "read",
            "failed",
            "dead_letter",
            "suppressed",
            "expired",
            "cancelled",
            "delivery_unknown",
          ])
          .default("all"),
        memberId: z.string().uuid().nullable().default(null),
        cursor: z.string().max(200).nullable().default(null),
        pageSize: z.number().int().min(1).max(100).default(25),
      })
      .refine((value) => new Date(value.from) < new Date(value.to), "invalid_delivery_range")
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const db = await requireAdmin(context.userId);
    const rawRows: RawDeliveryMonitorRow[] = [];
    const pendingOutbox: Array<{
      created_at: string;
      available_at: string;
      expires_at: string | null;
    }> = [];
    const chunkSize = 1_000;
    for (let offset = 0; ; offset += chunkSize) {
      const result = await db
        .from("message_deliveries")
        .select(
          "id,message_id,channel,provider,status,provider_status,attempt_count,failure_class,error_code,error_message,recipient_address,scheduled_for,next_attempt_at,expires_at,accepted_at,sent_at,delivered_at,read_at,failed_at,created_at,updated_at,message:messages!inner(id,event_type,subject,member_id,language,template_key,template_version,legacy_source_table,created_at,audience,content,outbox:message_outbox(aggregate_type),member:members(id,name,email,phone,preferred_language,status)),attempts:message_delivery_attempts(id,attempt_number,provider,started_at,finished_at,outcome,provider_http_status,provider_error_code,failure_class,retry_after_seconds,next_attempt_at),targets:message_delivery_targets(id,status,attempt_count,failure_class,error_code,created_at,updated_at)",
        )
        .gte("message.created_at", data.from)
        .lt("message.created_at", data.to)
        .order("created_at", { ascending: false })
        .range(offset, offset + chunkSize - 1);
      if (result.error) throw result.error;
      const chunk = (result.data ?? []) as RawDeliveryMonitorRow[];
      rawRows.push(...chunk);
      if (chunk.length < chunkSize) break;
    }
    for (let offset = 0; ; offset += chunkSize) {
      const result = await db
        .from("message_outbox")
        .select("created_at,available_at,expires_at")
        .is("processed_at", null)
        .order("created_at", { ascending: true })
        .range(offset, offset + chunkSize - 1);
      if (result.error) throw result.error;
      const chunk = result.data ?? [];
      pendingOutbox.push(...chunk);
      if (chunk.length < chunkSize) break;
    }

    const deliveries = rawRows.map((row) => {
      const message = firstRelation(row.message);
      const member = firstRelation(message?.member);
      const safeMember = member
        ? {
            ...member,
            email: maskedRecipient(member.email),
            phone: maskedRecipient(member.phone),
          }
        : null;
      const trafficKind = deliveryTrafficKind(message);
      const recipientName =
        (typeof message?.content?.variables?.member_name === "string"
          ? message.content.variables.member_name
          : null) ??
        member?.name ??
        null;
      const {
        audience: _audience,
        content: _content,
        outbox: _outbox,
        legacy_source_table: _legacySourceTable,
        ...safeMessage
      } = message ?? ({} as RawDeliveryMonitorMessage);
      const { recipient_address: recipientAddress, ...safeRow } = row;
      return {
        ...safeRow,
        recipient_contact: maskedRecipient(recipientAddress),
        traffic_kind: trafficKind,
        message: message
          ? { ...safeMessage, recipient_name: recipientName, member: safeMember }
          : null,
        attempts: [...(row.attempts ?? [])].sort(
          (a: { attempt_number: number }, b: { attempt_number: number }) =>
            a.attempt_number - b.attempt_number,
        ),
        targets: row.targets ?? [],
      } as DeliveryMonitorRow;
    });
    const page = buildDeliveryMonitorPage({
      deliveries,
      filters: {
        query: data.query,
        traffic: data.traffic,
        channel: data.channel,
        status: data.status,
        memberId: data.memberId,
      },
      cursor: data.cursor,
      pageSize: data.pageSize,
    });

    const generatedAt = new Date();
    return {
      deliveries: page.deliveries,
      summary: page.summaries[data.traffic],
      summaries: page.summaries,
      generatedAt: generatedAt.toISOString(),
      from: data.from,
      to: data.to,
      totalMoments: page.totalMoments,
      nextCursor: page.nextCursor,
      pageSize: data.pageSize,
      queueHealth: summarizeOutboxHealth(pendingOutbox, generatedAt),
    };
  });

export const listNotificationEventRollouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireAdmin(context.userId);
    const result = await db.from("notification_event_rollouts").select("*");
    if (result.error) throw result.error;
    const rows = new Map(
      (result.data ?? []).map((row: { event_type: string }) => [row.event_type, row]),
    );
    return Object.entries(NOTIFICATION_EVENT_CATALOG).map(([eventType, definition]) => ({
      eventType,
      ...definition,
      rollout: rows.get(eventType) ?? null,
    }));
  });

export const listPremiumJourneyPreviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ language: z.enum(["he", "ar", "en"]).default("en") }).parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    return buildPremiumJourneyPreviews(data.language);
  });

export const enqueuePremiumJourneyTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        memberId: z.string().uuid(),
        eventType: messageEventSchema,
        channel: z.enum(MESSAGE_CHANNELS),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const db = await requireAdmin(context.userId);
    const eventType = data.eventType;
    const definition = NOTIFICATION_EVENT_CATALOG[eventType];
    if (!definition) throw new Error("unknown_notification_event");
    const runtime = resolveMessagingRuntime(process.env);
    if (runtime.mode !== "allowlist") throw new Error("journey_test_requires_allowlist_mode");
    const member = await db
      .from("members")
      .select("id,phone,email,preferred_language,status")
      .eq("id", data.memberId)
      .maybeSingle();
    if (member.error) throw member.error;
    if (!member.data || member.data.status !== "active") throw new Error("active_member_required");
    if (
      !runtimeAllowsRolloutRecipient(runtime, [
        member.data.id,
        member.data.phone,
        member.data.email,
      ])
    ) {
      throw new Error("member_not_in_messaging_allowlist");
    }
    const language = ["he", "ar", "en"].includes(member.data.preferred_language)
      ? member.data.preferred_language
      : "en";
    const row = buildPremiumJourneyTestOutbox({
      eventType,
      channel: data.channel,
      memberId: member.data.id,
      language,
      runId: randomUUID(),
      now: new Date(),
    });
    const inserted = await db.from("message_outbox").insert(row).select("id").single();
    if (inserted.error) throw inserted.error;
    await kickUnifiedMessagingAfterCommit();
    return {
      ok: true as const,
      outboxId: inserted.data.id,
      eventType,
      channel: data.channel,
    };
  });

export const updateNotificationEventRollout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        eventType: messageEventSchema,
        enabled: z.boolean(),
        copyReviewed: z.boolean(),
        allowlistOnly: z.boolean(),
        enabledChannels: z.array(z.enum(MESSAGE_CHANNELS)).min(1),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const db = await requireAdmin(context.userId);
    const definition = NOTIFICATION_EVENT_CATALOG[data.eventType];
    if (!data.enabledChannels.includes("in_app")) throw new Error("in_app_channel_required");
    if (
      data.enabledChannels.some(
        (channel) => !(definition.channels as readonly string[]).includes(channel),
      )
    ) {
      throw new Error("event_channel_not_supported");
    }
    if (data.enabled && !data.copyReviewed) throw new Error("copy_review_required");
    const now = new Date().toISOString();
    const result = await db
      .from("notification_event_rollouts")
      .update({
        enabled: data.enabled,
        copy_reviewed: data.copyReviewed,
        enabled_channels: data.enabledChannels,
        allowlist_only: data.allowlistOnly,
        enabled_by: data.enabled ? context.userId : null,
        enabled_at: data.enabled ? now : null,
        updated_at: now,
      })
      .eq("event_type", data.eventType)
      .select("*")
      .single();
    if (result.error) throw result.error;
    return result.data;
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
      .select("id,member_id")
      .maybeSingle();
    if (result.error) throw result.error;
    if (result.data?.member_id) {
      const outbox = await db.from("message_outbox").upsert(
        {
          event_type: "human_handoff_resolved",
          aggregate_type: "message_conversation",
          aggregate_id: data.conversationId,
          member_id: result.data.member_id,
          payload: { conversation_id: data.conversationId },
          deduplication_key: `conversation:${data.conversationId}:resolved:${now}`,
          available_at: now,
        },
        { onConflict: "deduplication_key", ignoreDuplicates: true },
      );
      if (outbox.error) throw outbox.error;
      await kickUnifiedMessagingAfterCommit();
    }
    return { ok: Boolean(result.data) };
  });

export const emitUrgentStudioAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        memberIds: z.array(z.string().uuid()).max(5_000).optional(),
        confirmation: z.literal("SEND_URGENT_STUDIO_ANNOUNCEMENT"),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const db = await requireAdmin(context.userId);
    let query = db.from("members").select("id").eq("status", "active").limit(5_000);
    if (data.memberIds?.length) query = query.in("id", data.memberIds);
    const members = await query;
    if (members.error) throw members.error;
    const announcementId = randomUUID();
    const rows = (members.data ?? []).map((member: { id: string }) => ({
      event_type: "urgent_studio_announcement",
      aggregate_type: "studio_announcement",
      aggregate_id: announcementId,
      member_id: member.id,
      payload: { announcement_id: announcementId },
      deduplication_key: `announcement:${announcementId}:member:${member.id}`,
      available_at: new Date().toISOString(),
    }));
    if (rows.length) {
      const result = await db.from("message_outbox").upsert(rows, {
        onConflict: "deduplication_key",
        ignoreDuplicates: true,
      });
      if (result.error) throw result.error;
      await kickUnifiedMessagingAfterCommit();
    }
    return { ok: true as const, announcementId, recipients: rows.length };
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
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: memberName }],
          },
        ],
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
    if (conversation.data.member_id) {
      const notification = await db.from("message_outbox").upsert(
        {
          event_type: "staff_reply",
          aggregate_type: "message_conversation",
          aggregate_id: data.conversationId,
          member_id: conversation.data.member_id,
          payload: { conversation_id: data.conversationId },
          deduplication_key: `${messageKey}:staff_reply`,
          available_at: new Date().toISOString(),
        },
        { onConflict: "deduplication_key", ignoreDuplicates: true },
      );
      if (notification.error) throw notification.error;
    }
    await kickUnifiedMessagingAfterCommit();
    return { ok: true, queued: true, windowOpen: Boolean(windowOpen) };
  });

export const retryCanonicalDeliveryAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ deliveryId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { retryCanonicalDelivery } = await import("@/lib/unifiedMessaging.server");
    return retryCanonicalDelivery(data.deliveryId, context.userId);
  });
