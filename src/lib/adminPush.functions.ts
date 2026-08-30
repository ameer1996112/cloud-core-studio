import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const registerAdminPushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        token: z.string().min(20).max(1000),
        platform: z.enum(["ios", "android"]),
        environment: z.enum(["sandbox", "production"]),
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
        apns_environment: data.environment,
        active: true,
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: "token" },
    );
    if (error) throw error;

    return { ok: true };
  });
