import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizePhoneForWa } from "@/lib/messageTemplate";

async function ensureStaff(supabase: any, userId: string, level: "admin" | "staff" = "staff") {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  const role = data?.role;
  if (level === "admin" && role !== "admin") throw new Error("forbidden");
  if (level === "staff" && role !== "admin" && role !== "instructor") throw new Error("forbidden");
}

// ===== Templates =====
export const listMessageTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    const { data } = await context.supabase
      .from("notification_templates")
      .select("*")
      .order("trigger_type", { ascending: true })
      .order("label", { ascending: true });
    return data ?? [];
  });

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  key: z.string().min(1),
  label: z.string().min(1),
  channel: z.enum(["whatsapp", "email", "in_app"]),
  trigger_type: z.string().min(1),
  language: z.enum(["en", "he", "ar"]),
  subject: z.string().nullable().optional(),
  body: z.string().min(1),
  description: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export const upsertMessageTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => templateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { id, ...rest } = data;
    if (id) {
      const { error } = await context.supabase
        .from("notification_templates")
        .update(rest)
        .eq("id", id);
      if (error) throw error;
      return { id };
    }
    const { data: row, error } = await context.supabase
      .from("notification_templates")
      .insert(rest)
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const duplicateMessageTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { data: src, error } = await context.supabase
      .from("notification_templates")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw error;
    const { id, created_at, updated_at, ...rest } = src as any;
    const { data: row, error: e2 } = await context.supabase
      .from("notification_templates")
      .insert({
        ...rest,
        key: `${rest.key}_copy_${Date.now().toString(36)}`,
        label: `${rest.label} (copy)`,
      })
      .select("id")
      .single();
    if (e2) throw e2;
    return { id: row.id };
  });

export const setTemplateActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { error } = await context.supabase
      .from("notification_templates")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ===== Audience =====
const audienceSchema = z.object({
  kind: z.enum([
    "class_roster",
    "class_waitlist",
    "low_credits",
    "package_expiring",
    "first_timers",
    "no_show_recent",
    "inactive_60d",
    "no_upcoming_booking",
    "specific",
  ]),
  classId: z.string().uuid().optional(),
  memberIds: z.array(z.string().uuid()).optional(),
});

export type AudienceMember = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  remaining_credits: number;
  preferred_language: string | null;
  context: Record<string, any>;
};

export const buildAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => audienceSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ members: AudienceMember[]; cls?: any }> => {
    await ensureStaff(context.supabase, context.userId, "staff");
    const sb = context.supabase;
    const now = new Date();

    if (data.kind === "specific" && data.memberIds?.length) {
      const { data: rows } = await sb
        .from("members")
        .select("id,name,phone,email,remaining_credits,preferred_language")
        .in("id", data.memberIds);
      return { members: (rows ?? []).map((m: any) => ({ ...m, context: {} })) };
    }

    if (data.kind === "class_roster" || data.kind === "class_waitlist") {
      if (!data.classId) return { members: [] };
      const { data: cls } = await sb
        .from("classes")
        .select("*, instructor:instructors(id,name), room_ref:rooms(id,name,address)")
        .eq("id", data.classId)
        .maybeSingle();
      if (data.kind === "class_roster") {
        const { data: rows } = await sb
          .from("bookings")
          .select("member:members(id,name,phone,email,remaining_credits,preferred_language)")
          .eq("class_id", data.classId)
          .eq("status", "booked");
        const members = (rows ?? [])
          .map((r: any) => r.member)
          .filter(Boolean)
          .map((m: any) => ({ ...m, context: { class: cls } }));
        return { members, cls };
      } else {
        const { data: rows } = await sb
          .from("waitlist_entries")
          .select(
            "status, created_at, member:members(id,name,phone,email,remaining_credits,preferred_language)",
          )
          .eq("class_id", data.classId)
          .in("status", ["waiting", "offered", "ready"])
          .order("created_at");
        const members = (rows ?? [])
          .map((r: any, i: number) =>
            r.member
              ? {
                  ...r.member,
                  context: { class: cls, waitlist_position: i + 1, waitlist_status: r.status },
                }
              : null,
          )
          .filter(Boolean) as AudienceMember[];
        return { members, cls };
      }
    }

    if (data.kind === "low_credits") {
      const { data: rows } = await sb
        .from("members")
        .select("id,name,phone,email,remaining_credits,preferred_language")
        .lte("remaining_credits", 2)
        .order("remaining_credits");
      return { members: (rows ?? []).map((m: any) => ({ ...m, context: {} })) };
    }

    if (data.kind === "package_expiring") {
      const horizon = new Date(now.getTime() + 7 * 86400_000);
      const { data: plans } = await sb
        .from("member_plans")
        .select(
          "expires_at, plan:plans(name), member:members(id,name,phone,email,remaining_credits,preferred_language)",
        )
        .eq("status", "active")
        .not("expires_at", "is", null)
        .gte("expires_at", now.toISOString())
        .lte("expires_at", horizon.toISOString());
      const members = (plans ?? [])
        .map((p: any) =>
          p.member
            ? { ...p.member, context: { package_name: p.plan?.name, package_expiry: p.expires_at } }
            : null,
        )
        .filter(Boolean) as AudienceMember[];
      return { members };
    }

    if (data.kind === "first_timers") {
      const { data: rows } = await sb
        .from("members")
        .select("id,name,phone,email,remaining_credits,preferred_language")
        .eq("attendance_count", 0)
        .order("created_at", { ascending: false })
        .limit(100);
      return { members: (rows ?? []).map((m: any) => ({ ...m, context: {} })) };
    }

    if (data.kind === "no_show_recent") {
      const since = new Date(now.getTime() - 30 * 86400_000).toISOString();
      const { data: rows } = await sb
        .from("attendance_records")
        .select(
          "member:members(id,name,phone,email,remaining_credits,preferred_language), class:classes(title,starts_at)",
        )
        .eq("status", "no_show")
        .gte("marked_at", since)
        .limit(100);
      const seen = new Set<string>();
      const members: AudienceMember[] = [];
      for (const r of rows ?? []) {
        const m = (r as any).member;
        if (m && !seen.has(m.id)) {
          seen.add(m.id);
          members.push({ ...m, context: { class: (r as any).class } });
        }
      }
      return { members };
    }

    if (data.kind === "inactive_60d") {
      const cutoff = new Date(now.getTime() - 60 * 86400_000).toISOString();
      const { data: rows } = await sb
        .from("members")
        .select("id,name,phone,email,remaining_credits,preferred_language,last_visit_at")
        .or(`last_visit_at.lt.${cutoff},last_visit_at.is.null`)
        .order("name")
        .limit(200);
      return { members: (rows ?? []).map((m: any) => ({ ...m, context: {} })) };
    }

    if (data.kind === "no_upcoming_booking") {
      const { data: bookings } = await sb
        .from("bookings")
        .select("member_id, class:classes(starts_at)")
        .eq("status", "booked");
      const withFuture = new Set<string>();
      for (const b of bookings ?? []) {
        const sa = (b as any).class?.starts_at;
        if (sa && new Date(sa).getTime() > now.getTime()) withFuture.add((b as any).member_id);
      }
      const { data: members } = await sb
        .from("members")
        .select("id,name,phone,email,remaining_credits,preferred_language")
        .order("name")
        .limit(500);
      return {
        members: (members ?? [])
          .filter((m: any) => !withFuture.has(m.id))
          .map((m: any) => ({ ...m, context: {} })),
      };
    }

    return { members: [] };
  });

export const searchMembersBasic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ q: z.string().default("") }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    let q = context.supabase
      .from("members")
      .select("id,name,phone,email,remaining_credits")
      .order("name")
      .limit(20);
    if (data.q) q = q.ilike("name", `%${data.q}%`);
    const { data: rows } = await q;
    return rows ?? [];
  });

// ===== Logging =====
const logSchema = z.object({
  templateId: z.string().uuid().nullable().optional(),
  templateKey: z.string().nullable().optional(),
  triggerType: z.string().min(1),
  channel: z.enum(["whatsapp", "email", "in_app"]),
  recipientMemberId: z.string().uuid(),
  generatedText: z.string().min(1),
  subject: z.string().nullable().optional(),
  status: z.enum(["generated", "copied", "opened", "marked_sent", "failed"]).default("generated"),
  relatedClassId: z.string().uuid().nullable().optional(),
  relatedBookingId: z.string().uuid().nullable().optional(),
  relatedMemberPlanId: z.string().uuid().nullable().optional(),
});

function openWaConfig() {
  const baseUrl = process.env.OPENWA_BASE_URL?.replace(/\/+$/, "");
  const apiKey = process.env.OPENWA_API_KEY;
  const sessionId = process.env.OPENWA_SESSION_ID;
  if (!baseUrl || !apiKey || !sessionId) return null;
  return { baseUrl, apiKey, sessionId };
}

async function getOpenWaSessionStatus(config: NonNullable<ReturnType<typeof openWaConfig>>) {
  const res = await fetch(
    `${config.baseUrl}/api/sessions/${encodeURIComponent(config.sessionId)}`,
    {
      headers: { "X-API-Key": config.apiKey },
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenWA status check failed (${res.status})${body ? `: ${body}` : ""}`);
  }

  const session = await res.json();
  return String(session?.status ?? "unknown");
}

function openWaConnectionMessage(status: string) {
  if (status === "ready" || status === "connected") return null;
  if (status === "qr_ready" || status === "authenticating" || status === "initializing") {
    return "OpenWA is waiting for phone pairing. Scan the WhatsApp QR in the OpenWA dashboard, then try again.";
  }
  return `OpenWA is not connected yet (status: ${status}). Run bun run openwa:start, scan the QR, then try again.`;
}

export const logNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => logSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    const { error } = await context.supabase.from("notification_logs").insert({
      template_id: data.templateId ?? null,
      template_key: data.templateKey ?? null,
      trigger_type: data.triggerType,
      channel: data.channel,
      recipient_member_id: data.recipientMemberId,
      generated_text: data.generatedText,
      subject: data.subject ?? null,
      status: data.status,
      sent_by: context.userId,
      related_class_id: data.relatedClassId ?? null,
      related_booking_id: data.relatedBookingId ?? null,
      related_member_plan_id: data.relatedMemberPlanId ?? null,
      marked_sent_at: data.status === "marked_sent" ? new Date().toISOString() : null,
    });
    if (error) throw error;
    return { ok: true };
  });

const sendWhatsAppSchema = z.object({
  templateId: z.string().uuid().nullable().optional(),
  templateKey: z.string().nullable().optional(),
  triggerType: z.string().min(1),
  recipientMemberId: z.string().uuid(),
  recipientPhone: z.string().nullable().optional(),
  generatedText: z.string().min(1),
  subject: z.string().nullable().optional(),
  relatedClassId: z.string().uuid().nullable().optional(),
  relatedBookingId: z.string().uuid().nullable().optional(),
  relatedMemberPlanId: z.string().uuid().nullable().optional(),
});

export const sendWhatsAppMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => sendWhatsAppSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");

    const config = openWaConfig();
    const phone = normalizePhoneForWa(data.recipientPhone);

    const log = async (status: "marked_sent" | "failed", errorMessage?: string) => {
      const { error } = await context.supabase.from("notification_logs").insert({
        template_id: data.templateId ?? null,
        template_key: data.templateKey ?? null,
        trigger_type: data.triggerType,
        channel: "whatsapp",
        recipient_member_id: data.recipientMemberId,
        generated_text: errorMessage
          ? `${data.generatedText}\n\n[OpenWA error] ${errorMessage}`
          : data.generatedText,
        subject: data.subject ?? null,
        status,
        sent_by: context.userId,
        related_class_id: data.relatedClassId ?? null,
        related_booking_id: data.relatedBookingId ?? null,
        related_member_plan_id: data.relatedMemberPlanId ?? null,
        marked_sent_at: status === "marked_sent" ? new Date().toISOString() : null,
      });
      if (error) throw error;
    };

    if (!config) {
      await log("failed", "OpenWA is not configured");
      throw new Error(
        "OpenWA is not configured. Add OPENWA_BASE_URL, OPENWA_API_KEY, and OPENWA_SESSION_ID.",
      );
    }

    if (!phone) {
      await log("failed", "Recipient has no valid WhatsApp phone number");
      throw new Error("Recipient has no valid WhatsApp phone number.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const status = await getOpenWaSessionStatus(config);
      const connectionMessage = openWaConnectionMessage(status);
      if (connectionMessage) throw new Error(connectionMessage);

      const res = await fetch(
        `${config.baseUrl}/api/sessions/${encodeURIComponent(config.sessionId)}/messages/send-text`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": config.apiKey,
          },
          body: JSON.stringify({
            chatId: `${phone}@c.us`,
            text: data.generatedText,
          }),
          signal: controller.signal,
        },
      );

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const inactiveSession = body.includes("is not active") || body.includes("not active");
        if (inactiveSession) {
          throw new Error(
            "OpenWA is not connected yet. Open the OpenWA dashboard, scan the WhatsApp QR, then try again.",
          );
        }
        throw new Error(`OpenWA returned ${res.status}${body ? `: ${body.slice(0, 240)}` : ""}`);
      }

      await log("marked_sent");
      return { ok: true, provider: "openwa" as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : "OpenWA send failed";
      await log("failed", message);
      throw new Error(message);
    } finally {
      clearTimeout(timeout);
    }
  });

export const markNotificationSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    const { error } = await context.supabase
      .from("notification_logs")
      .update({ status: "marked_sent", marked_sent_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listNotificationLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ limit: z.number().int().positive().max(200).default(50) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    const { data: rows } = await context.supabase
      .from("notification_logs")
      .select("*, member:members(id,name)")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    return rows ?? [];
  });

// ===== Package requests =====
export const listPackageRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    const { data } = await context.supabase
      .from("package_requests")
      .select("*, member:members(id,name,phone,email), plan:plans(id,name,price_cents,currency)")
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const updatePackageRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["requested", "contacted", "paid", "cancelled"]),
        admin_notes: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("package_requests").update(rest).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

// ===== Waitlist offer =====
export const waitlistOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ entryId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r, error } = await supabaseAdmin.rpc("admin_waitlist_offer", {
      p_actor_id: context.userId,
      p_entry_id: data.entryId,
    });
    if (error) throw error;
    return r;
  });
