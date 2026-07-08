import { createFileRoute, redirect } from "@tanstack/react-router";
import { getHypConfig, hypRedirectMetadata, validateHypRedirect } from "@/lib/hyp.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

        throw redirect(paymentResult("success", paymentId));
      },
    },
  },
});
