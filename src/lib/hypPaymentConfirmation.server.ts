import {
  enqueuePaymentConfirmedNotifications,
  type ConfirmPaymentResult,
} from "@/lib/paymentNotifications.server";
import { issueHypReceiptForPayment } from "@/lib/hypReceiptIssuance.server";

export async function handleHypConfirmedPayment(result: ConfirmPaymentResult) {
  try {
    await issueHypReceiptForPayment(result.payment_id);
  } catch (invoiceError) {
    console.error(
      "hyp_legal_receipt_issue_failed",
      invoiceError instanceof Error ? invoiceError.message : String(invoiceError),
    );
  }
  await enqueuePaymentConfirmedNotifications(result);
}
