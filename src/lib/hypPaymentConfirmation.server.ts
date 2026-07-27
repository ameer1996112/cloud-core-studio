import {
  enqueuePaymentConfirmedNotifications,
  type ConfirmPaymentResult,
} from "@/lib/paymentNotifications.server";
import { issueEzcountReceiptForPayment } from "@/lib/ezcountReceiptIssuance.server";

export async function handleHypConfirmedPayment(result: ConfirmPaymentResult) {
  try {
    await issueEzcountReceiptForPayment(result.payment_id);
  } catch (invoiceError) {
    console.error(
      "ezcount_legal_receipt_issue_failed",
      invoiceError instanceof Error ? invoiceError.message : String(invoiceError),
    );
  }
  await enqueuePaymentConfirmedNotifications(result);
}
