import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createMyPackageRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        planId: z.string().uuid(),
        messageText: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("package_requests")
      .insert({
        member_id: context.userId,
        plan_id: data.planId,
        message_text: data.messageText ?? null,
        status: "requested",
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const getMyPackageRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("package_requests")
      .select("*, plan:plans(name,price_cents,currency)")
      .eq("member_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return data ?? [];
  });
