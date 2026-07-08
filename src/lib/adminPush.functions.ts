import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SignupMember = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
};

type AdminPushToken = {
  token: string;
  platform: "ios" | "android";
};

const RECENT_SIGNUP_WINDOW_MS = 15 * 60_000;

function cleanText(value: string | null | undefined, fallback = "-") {
  const text = value?.trim();
  return text || fallback;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function findRecentSignupMember(memberId: string): Promise<SignupMember | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from("members")
      .select("id,name,email,phone,created_at")
      .eq("id", memberId)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      const createdAt = new Date(data.created_at).getTime();
      if (!Number.isFinite(createdAt)) return null;
      if (Date.now() - createdAt > RECENT_SIGNUP_WINDOW_MS) return null;
      return data as SignupMember;
    }

    await sleep(250);
  }

  return null;
}

export const registerAdminPushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        token: z.string().min(20).max(1000),
        platform: z.enum(["ios", "android"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (profile?.role !== "admin") return { ok: false, skipped: "not_admin" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("admin_push_tokens").upsert(
      {
        user_id: context.userId,
        token: data.token,
        platform: data.platform,
        active: true,
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: "token" },
    );
    if (error) throw error;

    return { ok: true };
  });

export const notifyAdminMemberSignup = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ memberId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const member = await findRecentSignupMember(data.memberId);
    if (!member) return { ok: false, skipped: "member_not_found_or_not_recent" };
    const { isApnsConfigured, sendApnsAlert } = await import("@/lib/apns.server");
    if (!isApnsConfigured()) return { ok: false, skipped: "missing_apns_config" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tokens, error } = await supabaseAdmin
      .from("admin_push_tokens")
      .select("token,platform")
      .eq("active", true)
      .eq("platform", "ios");

    if (error) throw error;
    const rows = (tokens ?? []) as AdminPushToken[];
    if (!rows.length) return { ok: false, skipped: "no_admin_push_tokens" };

    const name = cleanText(member.name, "לקוחה חדשה");
    const phone = cleanText(member.phone);
    const email = cleanText(member.email);
    const results = await Promise.allSettled(
      rows.map((row) =>
        sendApnsAlert(row.token, {
          title: "לקוחה חדשה נרשמה",
          body: `${name}\nטלפון: ${phone}\nאימייל: ${email}`,
          url: "/admin/members",
        }),
      ),
    );

    const sent = results.filter(
      (result) => result.status === "fulfilled" && result.value.ok,
    ).length;
    const failed = results.length - sent;
    if (failed > 0) {
      console.warn("admin_signup_push_partial_failure", { sent, failed });
    }

    return { ok: sent > 0, sent, failed };
  });
