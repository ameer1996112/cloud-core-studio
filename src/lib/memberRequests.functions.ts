import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildNotificationDraftRows } from "@/lib/notificationDrafts";
import { hasTestPlanRecord, isTestRecord } from "@/lib/test-records";

const manualPaymentInput = z.object({
  planId: z.string().uuid(),
  method: z.enum(["cash", "bit"]),
  messageText: z.string().max(2000).optional(),
});

async function insertNotificationDraftRows(_supabase: any, rows: any[]) {
  if (!rows.length) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("notification_logs")
    .upsert(rows, { onConflict: "idempotency_key", ignoreDuplicates: true });
  if (error) console.error("notification_draft_insert_failed", error.message);
}

async function assertNoUsableActivePackage(supabase: any, memberId: string) {
  const now = new Date().toISOString();
  const [memberRes, activePlanRes] = await Promise.all([
    supabase.from("members").select("remaining_credits").eq("id", memberId).maybeSingle(),
    supabase
      .from("member_plans")
      .select("id,expires_at")
      .eq("member_id", memberId)
      .eq("status", "active")
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .limit(1),
  ]);
  if (memberRes.error) throw memberRes.error;
  if (activePlanRes.error) throw activePlanRes.error;
  if (Number(memberRes.data?.remaining_credits ?? 0) > 0 && (activePlanRes.data ?? []).length > 0) {
    throw new Error("active_package_exists");
  }
}

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
    await assertNoUsableActivePackage(context.supabase, context.userId);
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
    try {
      const [memberRes, planRes, settingsRes] = await Promise.all([
        context.supabase
          .from("members")
          .select("id,name,phone,email,preferred_language")
          .eq("id", context.userId)
          .maybeSingle(),
        context.supabase.from("plans").select("id,name").eq("id", data.planId).maybeSingle(),
        context.supabase.from("studio_settings").select("*").eq("id", 1).maybeSingle(),
      ]);
      if (memberRes.error) throw memberRes.error;
      if (planRes.error) throw planRes.error;
      if (settingsRes.error) throw settingsRes.error;
      if (memberRes.data && planRes.data) {
        const rows = [
          ...buildNotificationDraftRows({
            eventKey: "payment_request_received",
            channels: ["whatsapp", "email"],
            audience: "member",
            member: memberRes.data,
            appLanguage: null,
            studioSettings: settingsRes.data ?? null,
            relatedIds: { packageRequestId: row.id },
            variables: { package_name: planRes.data.name ?? "" },
          }),
          ...buildNotificationDraftRows({
            eventKey: "payment_request_received",
            channels: ["whatsapp", "email"],
            audience: "admin",
            member: memberRes.data,
            appLanguage: null,
            studioSettings: settingsRes.data ?? null,
            relatedIds: { packageRequestId: row.id },
            variables: { package_name: planRes.data.name ?? "" },
          }),
        ];
        await insertNotificationDraftRows(context.supabase, rows);
      }
    } catch (draftError) {
      console.error("payment_request_received_draft_prepare_failed", draftError);
    }
    return { id: row.id };
  });

export const createManualPackagePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => manualPaymentInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertNoUsableActivePackage(context.supabase, context.userId);
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

    try {
      const [memberDraftRes, planDraftRes, requestRes, settingsRes] = await Promise.all([
        context.supabase
          .from("members")
          .select("id,name,phone,email,preferred_language")
          .eq("id", context.userId)
          .maybeSingle(),
        context.supabase.from("plans").select("id,name").eq("id", data.planId).maybeSingle(),
        context.supabase
          .from("package_requests")
          .select("id")
          .eq("member_id", context.userId)
          .eq("plan_id", data.planId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        context.supabase.from("studio_settings").select("*").eq("id", 1).maybeSingle(),
      ]);
      if (memberDraftRes.error) throw memberDraftRes.error;
      if (planDraftRes.error) throw planDraftRes.error;
      if (requestRes.error) throw requestRes.error;
      if (settingsRes.error) throw settingsRes.error;
      if (memberDraftRes.data && planDraftRes.data) {
        const packageRequestId = requestRes.data?.id ?? null;
        let draftRows = buildNotificationDraftRows({
          eventKey: "payment_request_received",
          channels: ["whatsapp", "email"],
          audience: "admin",
          member: memberDraftRes.data,
          appLanguage: null,
          studioSettings: settingsRes.data ?? null,
          relatedIds: {
            packageRequestId,
            paymentId: row.id,
          },
          variables: {
            package_name: planDraftRes.data.name ?? "",
            payment_id: row.id,
            payment_method: row.method,
            amount: row.amount,
            currency: row.currency,
          },
        });
        if (!packageRequestId) {
          draftRows = draftRows.map((draftRow: any) => ({
            ...draftRow,
            idempotency_key: `payment_request:${row.id}:payment_request_received:${draftRow.channel}:admin`,
          }));
        }
        await insertNotificationDraftRows(context.supabase, draftRows);
      }
    } catch (draftError) {
      console.error("manual_package_payment_draft_prepare_failed", draftError);
    }

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
