import { createHypInvoiceClient, type HypReceiptDocument } from "@/lib/hypInvoiceClient";
import { getHypConfig } from "@/lib/hyp.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type PaymentReceiptRecord = {
  paymentId: string;
  receiptId: string;
  provider: string;
  transactionId: string | null;
  amount: number;
  paidAt: string | null;
  customerName: string | null;
  customerEmail: string | null;
  itemDescription: string | null;
  externalProvider: string | null;
  externalDocumentId: string | null;
  externalDocumentNumber: string | null;
  externalDocumentUrl: string | null;
};

type HypReceiptIssuanceDeps = {
  loadPaymentReceipt(paymentId: string): Promise<PaymentReceiptRecord | null>;
  claimReceipt(receiptId: string): Promise<boolean>;
  completeReceipt(receiptId: string, document: HypReceiptDocument): Promise<void>;
  failReceipt(receiptId: string, message: string): Promise<void>;
  issueReceipt(input: {
    transactionId: string;
    amountAgorot: number;
    customerName: string;
    customerEmail: string;
    itemDescription: string;
    issuedOn: string;
  }): Promise<HypReceiptDocument>;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isoDate(value: string | null) {
  const date = value ? new Date(value) : new Date();
  if (!Number.isFinite(date.getTime())) throw new Error("hyp_invoice_invalid_payment_date");
  return date.toISOString().slice(0, 10);
}

function defaultDeps(): HypReceiptIssuanceDeps {
  const config = getHypConfig();
  const relayUrl =
    process.env.HYP_RELAY_URL?.trim() ||
    process.env.HYP_RELAY_URI?.trim() ||
    process.env.HYP_RELAY_BASE_URL?.trim();
  const client = createHypInvoiceClient({
    relayUrl: relayUrl || "",
    user: config.user,
    password: config.password,
    terminalNumber: config.terminalNumber,
    layoutId: process.env.HYP_INVOICE_LAYOUT_ID?.trim() || undefined,
  });

  return {
    async loadPaymentReceipt(paymentId) {
      const { data, error } = await supabaseAdmin
        .from("receipts")
        .select(
          "id,external_provider,external_doc_id,external_doc_number,external_doc_url,payment:payments!inner(id,provider,provider_payment_id,provider_session_id,amount,paid_at,member:members(name,email),plan:plans(name))",
        )
        .eq("payment_id", paymentId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const payment = data.payment as any;
      return {
        paymentId: payment.id,
        receiptId: data.id,
        provider: payment.provider,
        transactionId: payment.provider_session_id || payment.provider_payment_id || null,
        amount: Number(payment.amount),
        paidAt: payment.paid_at,
        customerName: payment.member?.name ?? null,
        customerEmail: payment.member?.email ?? null,
        itemDescription: payment.plan?.name ?? "תשלום ל-Cloud & Core",
        externalProvider: data.external_provider,
        externalDocumentId: data.external_doc_id,
        externalDocumentNumber: data.external_doc_number,
        externalDocumentUrl: data.external_doc_url,
      };
    },
    async claimReceipt(receiptId) {
      const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data, error } = await supabaseAdmin
        .from("receipts")
        .update({
          external_provider: "hyp_pending",
          external_error: null,
          external_attempted_at: new Date().toISOString(),
        } as any)
        .eq("id", receiptId)
        .or(
          `external_provider.is.null,external_provider.eq.hyp_failed,and(external_provider.eq.hyp_pending,external_attempted_at.lt.${staleBefore})`,
        )
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    async completeReceipt(receiptId, document) {
      const { data: receipt, error: receiptError } = await supabaseAdmin
        .from("receipts")
        .update({
          external_provider: "hyp",
          external_doc_id: document.documentId,
          external_doc_number: document.documentNumber,
          external_doc_url: document.documentUrl,
          external_error: null,
        } as any)
        .eq("id", receiptId)
        .eq("external_provider", "hyp_pending")
        .select("payment_id")
        .single();
      if (receiptError) throw receiptError;
      const { error: paymentError } = await supabaseAdmin
        .from("payments")
        .update({ receipt_url: document.documentUrl })
        .eq("id", receipt.payment_id);
      if (paymentError) throw paymentError;
    },
    async failReceipt(receiptId, message) {
      const { error } = await supabaseAdmin
        .from("receipts")
        .update({
          external_provider: "hyp_failed",
          external_error: message.slice(0, 500),
        } as any)
        .eq("id", receiptId)
        .eq("external_provider", "hyp_pending");
      if (error) console.error("hyp_invoice_failure_persist_failed", error.message);
    },
    issueReceipt: (input) => client.issueReceipt(input),
  };
}

export async function issueHypReceiptForPayment(
  paymentId: string,
  deps: HypReceiptIssuanceDeps = defaultDeps(),
) {
  const record = await deps.loadPaymentReceipt(paymentId);
  if (!record) return { status: "receipt_not_found" as const };
  if (record.provider !== "hyp") return { status: "not_hyp_payment" as const };
  if (record.externalProvider === "hyp" && record.externalDocumentUrl) {
    return {
      status: "already_issued" as const,
      documentNumber: record.externalDocumentNumber,
      documentUrl: record.externalDocumentUrl,
    };
  }
  if (!record.transactionId) throw new Error("hyp_invoice_missing_transaction_id");
  if (!record.customerName?.trim()) throw new Error("hyp_invoice_missing_customer_name");
  if (!record.customerEmail?.trim()) throw new Error("hyp_invoice_missing_customer_email");

  const claimed = await deps.claimReceipt(record.receiptId);
  if (!claimed) return { status: "already_claimed" as const };

  try {
    const document = await deps.issueReceipt({
      transactionId: record.transactionId,
      amountAgorot: Math.round(Number(record.amount) * 100),
      customerName: record.customerName,
      customerEmail: record.customerEmail,
      itemDescription: record.itemDescription?.trim() || "תשלום ל-Cloud & Core",
      issuedOn: isoDate(record.paidAt),
    });
    await deps.completeReceipt(record.receiptId, document);
    return {
      status: "issued" as const,
      documentNumber: document.documentNumber,
      documentUrl: document.documentUrl,
    };
  } catch (error) {
    await deps.failReceipt(record.receiptId, errorMessage(error));
    throw error;
  }
}
