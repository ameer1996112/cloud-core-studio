import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasTestPlanRecord, isTestRecord } from "@/lib/test-records";

const manualPaymentInput = z.object({
  planId: z.string().uuid(),
  method: z.enum(["cash", "bit"]),
  messageText: z.string().max(2000).optional(),
});

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

export const createManualPackagePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => manualPaymentInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [memberRes, planRes] = await Promise.all([
      context.supabase.from("members").select("id").eq("id", context.userId).maybeSingle(),
      context.supabase
        .from("plans")
        .select("id,name,description,price_cents,currency,credits,duration_days,active")
        .eq("id", data.planId)
        .eq("active", true)
        .maybeSingle(),
    ]);

    if (memberRes.error) throw memberRes.error;
    if (planRes.error) throw planRes.error;
    if (!memberRes.data) throw new Error("member_profile_missing");
    if (!planRes.data || hasTestPlanRecord(planRes.data)) throw new Error("plan_not_found");

    const amount = Number(planRes.data.price_cents ?? 0) / 100;
    if (!amount || amount <= 0) throw new Error("invalid_plan_amount");

    const { data: row, error } = await supabaseAdmin
      .from("payments")
      .insert({
        member_id: context.userId,
        plan_id: planRes.data.id,
        amount,
        currency: planRes.data.currency ?? "ILS",
        method: data.method,
        status: "pending",
        notes: data.messageText ?? null,
      })
      .select("id,status,method,amount,currency,plan_id")
      .single();
    if (error) throw error;

    return row;
  });

export const getMyPackageRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("package_requests")
      .select("*, plan:plans(name,description,price_cents,currency)")
      .eq("member_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return (data ?? []).filter(
      (row: any) => !hasTestPlanRecord(row) && !isTestRecord(row.message_text),
    );
  });
