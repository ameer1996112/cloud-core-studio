import { createFileRoute, redirect } from "@tanstack/react-router";
import { getHypConfig, hypRedirectMetadata, validateHypRedirect } from "@/lib/hyp.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { handleHypConfirmedPayment } from "@/lib/hypPaymentConfirmation.server";
import { kickUnifiedMessagingAfterCommit } from "@/lib/unifiedMessagingKick.server";
import { createSubscriptionFromInitialPayment } from "@/lib/subscriptions.server";
import { processKidsHypReturn } from "@/lib/kids.server";

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
  audience?: "member" | "kids",
) {
  return {
    to: "/payment-result",
    search: {
      status,
      ...(paymentId ? { paymentId } : {}),
      ...(audience ? { audience } : {}),
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

        const { data: kidsPayment, error: kidsPaymentError } = await (supabaseAdmin as any)
          .from("kid_aerial_payments")
          .select("id,status")
          .eq("id", paymentId)
          .maybeSingle();
        if (kidsPaymentError) console.error("hyp_return_kids_lookup_failed", kidsPaymentError);

        if (kidsPayment) {
          if (returnStatus === "cancel") {
            await processKidsHypReturn(params);
            throw redirect(paymentResult("cancelled", paymentId, "kids"));
          }

          let isValid = false;
          try {
            isValid = await validateHypRedirect(params, getHypConfig());
          } catch (error) {
            console.error("hyp_return_kids_validation_config_failed", error);
          }

          if (!isValid) {
            await (supabaseAdmin as any)
              .from("kid_aerial_payments")
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
            throw redirect(paymentResult("failed", paymentId, "kids"));
          }

          const kidsResult = await processKidsHypReturn(params);
          if (kidsResult.status === "success") {
            throw redirect(paymentResult("success", paymentId, "kids"));
          }
          console.error("hyp_return_kids_confirm_failed", kidsResult);
          throw redirect(paymentResult("pending", paymentId, "kids"));
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

        const result = data as {
          status: string;
          payment_id: string;
          receipt_id: string;
          receipt_number: string;
          member_plan_id?: string | null;
        };
        if (result.status === "confirmed" || result.status === "already_confirmed") {
          try {
            await createSubscriptionFromInitialPayment({
              paymentId,
              memberPlanId: result.member_plan_id ?? null,
              hkId: pickSearchParam(params, "HKId", "hkId"),
              cardMask: pickSearchParam(params, "cardMask", "L4digit"),
              transId: pickSearchParam(params, "Id", "txId"),
              userId: pickSearchParam(params, "UserId"),
            });
          } catch (subscriptionError) {
            console.error("hyp_return_subscription_setup_failed", subscriptionError);
          }
          await handleHypConfirmedPayment(result);
          await kickUnifiedMessagingAfterCommit();
        }

        throw redirect(paymentResult("success", paymentId));
      },
    },
  },
});
