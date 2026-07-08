import { createFileRoute, redirect } from "@tanstack/react-router";
import { getHypConfig, hypRedirectMetadata, validateHypRedirect } from "@/lib/hyp.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildNotificationDraftRows } from "@/lib/notificationDrafts";

function pickSearchParam(params: URLSearchParams, ...names: string[]) {
  for (const name of names) {
    const value = params.get(name);
    if (value !== null) return value;
  }
  return "";
}

async function firstAdminUserId() {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

type ConfirmPaymentResult = {
  status: string;
  payment_id: string;
  receipt_id: string;
  receipt_number: string;
  member_plan_id?: string | null;
};

async function insertNotificationDraftRows(rows: ReturnType<typeof buildNotificationDraftRows>) {
  if (!rows.length) return;
  const { error } = await supabaseAdmin
    .from("notification_logs")
    .upsert(rows, { onConflict: "idempotency_key", ignoreDuplicates: true });
  if (error) console.error("hyp_return_notification_insert_failed", error.message);
}

async function enqueuePaymentConfirmedNotifications(result: ConfirmPaymentResult) {
  if (!result.payment_id || !result.receipt_id) return;

  try {
    const [paymentRes, receiptRes, settingsRes] = await Promise.all([
      supabaseAdmin
        .from("payments")
        .select(
          "id,amount,currency,member:members(id,name,phone,email,preferred_language),plan:plans(name)",
        )
        .eq("id", result.payment_id)
        .maybeSingle(),
      supabaseAdmin
        .from("receipts")
        .select("id,receipt_number,plan_name_snapshot")
        .eq("id", result.receipt_id)
        .maybeSingle(),
      supabaseAdmin.from("studio_settings").select("*").eq("id", 1).maybeSingle(),
    ]);

    if (paymentRes.error) throw paymentRes.error;
    if (receiptRes.error) throw receiptRes.error;
    if (settingsRes.error) throw settingsRes.error;

    const payment = paymentRes.data as any;
    const receipt = receiptRes.data as any;
    if (!payment?.member) return;

    const packageName = payment.plan?.name ?? receipt?.plan_name_snapshot ?? "Studio payment";
    const paymentRows = buildNotificationDraftRows({
      eventKey: "payment_confirmed",
      channels: ["whatsapp", "email"],
      audience: "member",
      member: payment.member,
      appLanguage: null,
      studioSettings: settingsRes.data ?? null,
      relatedIds: {
        paymentId: result.payment_id,
        receiptId: result.receipt_id,
        memberPlanId: result.member_plan_id ?? null,
      },
      variables: {
        package_name: packageName,
        amount: payment.amount,
        currency: payment.currency,
      },
    });
    const receiptRows = receipt
      ? buildNotificationDraftRows({
          eventKey: "receipt_issued",
          channels: ["whatsapp", "email"],
          audience: "member",
          member: payment.member,
          appLanguage: null,
          studioSettings: settingsRes.data ?? null,
          relatedIds: {
            paymentId: result.payment_id,
            receiptId: result.receipt_id,
            memberPlanId: result.member_plan_id ?? null,
          },
          variables: {
            package_name: packageName,
            receipt_number: receipt.receipt_number ?? result.receipt_number,
          },
        })
      : [];

    await insertNotificationDraftRows([...paymentRows, ...receiptRows]);
  } catch (error) {
    console.error("hyp_return_notification_prepare_failed", error);
  }
}

function paymentResult(
  status: "success" | "failed" | "cancelled" | "pending" | "missing",
  paymentId?: string,
) {
  return {
    to: "/payment-result",
    search: {
      status,
      ...(paymentId ? { paymentId } : {}),
    },
  } as const;
}

export const Route = createFileRoute("/api/public/payments/hyp/return")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const params = url.searchParams;
        const returnStatus = pickSearchParam(params, "status");
        const paymentId = pickSearchParam(params, "Order", "uniqueID", "uniqueId", "uniqueid");
        const txId = pickSearchParam(params, "Id", "txId");
        const cgUid = pickSearchParam(params, "ACode", "cgUid");

        if (!paymentId) {
          throw redirect(paymentResult("missing"));
        }

        if (returnStatus === "cancel") {
          await supabaseAdmin
            .from("payments")
            .update({
              status: "failed",
              provider_status: "cancelled",
              metadata: hypRedirectMetadata(params),
            })
            .eq("id", paymentId)
            .eq("provider", "hyp")
            .eq("status", "pending");
          throw redirect(paymentResult("cancelled", paymentId));
        }

        let isValid = false;
        try {
          isValid = await validateHypRedirect(params, getHypConfig());
        } catch (error) {
          console.error("hyp_return_validation_config_failed", error);
        }

        if (!isValid) {
          await supabaseAdmin
            .from("payments")
            .update({
              status: "failed",
              provider_status: returnStatus || "invalid",
              provider_payment_id: cgUid || null,
              provider_session_id: txId || null,
              metadata: hypRedirectMetadata(params),
            })
            .eq("id", paymentId)
            .eq("provider", "hyp")
            .eq("status", "pending");
          throw redirect(paymentResult("failed", paymentId));
        }

        const actorId = await firstAdminUserId();
        if (!actorId) {
          console.error("hyp_return_no_admin_actor");
          throw redirect(paymentResult("pending", paymentId));
        }

        const { data, error } = await (supabaseAdmin as any).rpc(
          "confirm_payment_and_issue_receipt",
          {
            p_actor_id: actorId,
            p_payment_id: paymentId,
            p_provider_payment_id: cgUid || null,
            p_provider_session_id: txId || null,
            p_provider_status: "paid",
            p_receipt_url: null,
            p_metadata: hypRedirectMetadata(params),
          },
        );
        if (error || (data as any)?.status === "error") {
          console.error("hyp_return_confirm_failed", error ?? data);
          throw redirect(paymentResult("pending", paymentId));
        }

        const result = data as ConfirmPaymentResult;
        if (result.status === "confirmed" || result.status === "already_confirmed") {
          await enqueuePaymentConfirmedNotifications(result);
        }

        throw redirect(paymentResult("success", paymentId));
      },
    },
  },
});
