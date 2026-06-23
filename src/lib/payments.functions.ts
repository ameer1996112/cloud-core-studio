import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (data?.role !== "admin") throw new Error("forbidden");
}

export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        memberId: z.string().uuid().optional(),
        sinceDays: z.number().int().positive().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("payments")
      .select(
        "*, member:members(id,name), plan:plans(id,name), receipt:receipts(id,receipt_number)",
      )
      .order("paid_at", { ascending: false })
      .limit(300);
    if (data.memberId) q = q.eq("member_id", data.memberId);
    if (data.sinceDays) {
      const since = new Date(Date.now() - data.sinceDays * 86400000).toISOString();
      q = q.gte("paid_at", since);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

const paymentInput = z.object({
  id: z.string().uuid().optional(),
  member_id: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(["cash", "bit", "card", "transfer", "stripe", "other"]),
  status: z.enum(["pending", "paid", "failed", "refunded", "partially_refunded"]).optional(),
  plan_id: z.string().uuid().nullable().optional(),
  member_plan_id: z.string().uuid().nullable().optional(),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  paid_at: z.string().optional(),
});

export const upsertPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => paymentInput.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const payload: any = {
      ...data,
      status: data.status ?? "paid",
      recorded_by: context.userId,
    };
    if (data.id) {
      const { id, ...rest } = payload;
      const { error } = await (context.supabase as any).from("payments").update(rest).eq("id", id);
      if (error) throw error;
      return { id };
    }
    const { data: row, error } = await context.supabase
      .from("payments")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const refundPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), amount: z.number().positive() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data: pay, error: e1 } = await context.supabase
      .from("payments")
      .select("amount, refunded_amount")
      .eq("id", data.id)
      .single();
    if (e1) throw e1;
    const total = Number(pay.refunded_amount ?? 0) + data.amount;
    const status = total >= Number(pay.amount) ? "refunded" : "partially_refunded";
    const { error } = await context.supabase
      .from("payments")
      .update({ refunded_amount: total, status })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true, status, refunded: total };
  });

export const revenueSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const { data: thisMonth } = await context.supabase
      .from("payments")
      .select("amount, refunded_amount")
      .eq("status", "paid")
      .gte("paid_at", monthStart.toISOString());
    const total = (thisMonth ?? []).reduce(
      (a: number, r: any) => a + Number(r.amount) - Number(r.refunded_amount ?? 0),
      0,
    );
    const { count: outstanding } = await context.supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    return { monthRevenueIls: total, outstandingCount: outstanding ?? 0 };
  });
