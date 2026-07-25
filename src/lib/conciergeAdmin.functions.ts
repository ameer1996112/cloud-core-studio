import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  chooseNextRecipientAction,
  type PendingRecipientAction,
  type RecipientPolicyState,
} from "@/lib/conciergePolicy";

async function adminDb(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const profile = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile.error) throw profile.error;
  if (profile.data?.role !== "admin") throw new Error("Admin access required");
  return db;
}

export const getConciergeCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb(context.userId);
    const studio = await db
      .from("studios")
      .select("id,name,timezone")
      .eq("slug", "cloud-core")
      .single();
    if (studio.error) throw studio.error;
    const [automations, channels, attention, deliveries] = await Promise.all([
      db
        .from("automation_config_versions")
        .select("id,journey_type,version,mode,config,created_at")
        .eq("studio_id", studio.data.id)
        .is("retired_at", null)
        .order("journey_type"),
      db
        .from("concierge_channel_controls")
        .select("channel,enabled,maintenance_only,updated_at")
        .eq("studio_id", studio.data.id)
        .order("channel"),
      db
        .from("admin_attention_items")
        .select("id,item_type,severity,title,status,created_at")
        .eq("studio_id", studio.data.id)
        .neq("status", "resolved")
        .order("created_at", { ascending: false })
        .limit(25),
      db.from("message_deliveries").select("status").eq("studio_id", studio.data.id).limit(5000),
    ]);
    for (const result of [automations, channels, attention, deliveries]) {
      if (result.error) throw result.error;
    }
    const deliveryHealth = (deliveries.data ?? []).reduce(
      (counts: Record<string, number>, row: { status: string }) => {
        counts[row.status] = (counts[row.status] ?? 0) + 1;
        return counts;
      },
      {},
    );
    return {
      studio: studio.data,
      automations: automations.data ?? [],
      channels: channels.data ?? [],
      attention: attention.data ?? [],
      deliveryHealth,
    };
  });

const modeSchema = z.object({
  automationId: z.string().uuid(),
  mode: z.enum(["paused", "shadow", "test_only"]),
});

export const setConciergeAutomationMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => modeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = await adminDb(context.userId);
    const result = await db
      .from("automation_config_versions")
      .update({ mode: data.mode })
      .eq("id", data.automationId)
      .select("id,mode")
      .single();
    if (result.error) throw result.error;
    const audit = await db.from("admin_activity_log").insert({
      actor_id: context.userId,
      action: "concierge.automation_mode_changed",
      entity_type: "automation_config_version",
      entity_id: data.automationId,
      metadata: { mode: data.mode },
    });
    if (audit.error) throw audit.error;
    return result.data;
  });

const channelSchema = z.object({
  channel: z.enum(["push", "email", "whatsapp"]),
  enabled: z.boolean(),
});

export const setConciergeChannelEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => channelSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = await adminDb(context.userId);
    const studio = await db.from("studios").select("id").eq("slug", "cloud-core").single();
    if (studio.error) throw studio.error;
    const result = await db
      .from("concierge_channel_controls")
      .update({
        enabled: data.enabled,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("studio_id", studio.data.id)
      .eq("channel", data.channel)
      .select("channel,enabled")
      .single();
    if (result.error) throw result.error;
    const audit = await db.from("admin_activity_log").insert({
      actor_id: context.userId,
      action: "concierge.channel_control_changed",
      entity_type: "concierge_channel_control",
      metadata: { channel: data.channel, enabled: data.enabled },
    });
    if (audit.error) throw audit.error;
    return result.data;
  });

const simulatorSchema = z.object({
  recipientId: z.string().min(1),
  locale: z.enum(["ar", "he", "en"]),
  hasPush: z.boolean(),
  event: z.string().min(1),
  purpose: z.enum(["transactional", "operational", "schedule", "promotional", "receipt"]),
  priority: z.number().int().min(1).max(7),
  simulatedAt: z.string().datetime(),
});

export const simulateConciergeDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => simulatorSchema.parse(input))
  .handler(async ({ data, context }) => {
    await adminDb(context.userId);
    const purposeSet = new Set([data.purpose]);
    const recipient: RecipientPolicyState = {
      id: data.recipientId,
      locale: data.locale,
      isAdult: true,
      hasPush: data.hasPush,
      consents: {
        in_app: purposeSet,
        push: purposeSet,
        email: purposeSet,
        whatsapp: purposeSet,
      },
    };
    const action: PendingRecipientAction = {
      id: `simulation:${data.event}`,
      kind: data.event,
      purpose: data.purpose,
      priority: data.priority,
      eligibleAt: new Date(data.simulatedAt),
      urgent: data.priority === 1,
    };
    const result = chooseNextRecipientAction({
      recipient,
      actions: [action],
      recentContacts: [],
      now: new Date(data.simulatedAt),
    });
    return {
      ...result,
      policyVersion: "concierge-2026-07-v1",
      simulated: true,
      deliveriesCreated: 0,
      reservationsCreated: 0,
    };
  });
