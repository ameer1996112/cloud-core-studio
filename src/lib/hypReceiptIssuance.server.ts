import {
  createHypInvoiceClient,
  type HypReceiptDocument,
  type HypReceiptRequest,
} from "@/lib/hypInvoiceClient";
import {
  buildHypReconciliationId,
  getHypConfig,
  inquireHypTransactionsByUser,
} from "@/lib/hyp.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type PaymentReceiptRecord = {
  paymentId: string;
  receiptId: string;
  provider: string;
  transactionId: string | null;
  terminalKind: "primary" | "recurring";
  amount: number;
  paidAt: string | null;
  customerName: string | null;
  customerEmail: string | null;
  itemDescription: string | null;
  externalProvider: string | null;
  externalStatus: string | null;
  externalDocumentId: string | null;
  externalDocumentNumber: string | null;
  externalDocumentUrl: string | null;
};

type HypReceiptIssuanceDeps = {
  loadPaymentReceipt(paymentId: string): Promise<PaymentReceiptRecord | null>;
  claimReceipt(receiptId: string): Promise<boolean>;
  completeReceipt(receiptId: string, document: HypReceiptDocument): Promise<void>;
  failReceipt(receiptId: string, message: string, ambiguous: boolean): Promise<void>;
  issueReceipt(
    input: HypReceiptRequest,
    terminalKind: "primary" | "recurring",
  ): Promise<HypReceiptDocument>;
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
  const primaryClient = createHypInvoiceClient({
    relayUrl: relayUrl || "",
    user: config.user,
    password: config.password,
    terminalNumber: config.terminalNumber,
    layoutId: process.env.HYP_INVOICE_LAYOUT_ID?.trim() || undefined,
  });
  const recurringClient = createHypInvoiceClient({
    relayUrl: relayUrl || "",
    user: config.user,
    password: config.recurringPassword || config.password,
    terminalNumber: config.recurringTerminalNumber || config.terminalNumber,
    layoutId: process.env.HYP_INVOICE_LAYOUT_ID?.trim() || undefined,
  });

  return {
    async loadPaymentReceipt(paymentId) {
      const { data, error } = await supabaseAdmin
        .from("receipts")
        .select(
          "id,external_provider,external_status,external_doc_id,external_doc_number,external_doc_url,payment:payments!inner(id,provider,amount,paid_at,metadata,member:members(name,email),plan:plans(name))",
        )
        .eq("payment_id", paymentId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const payment = data.payment as any;
      const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
      let transactionId = String(metadata.Id ?? "").trim() || null;
      if (!transactionId) {
        const transactions = await inquireHypTransactionsByUser(
          buildHypReconciliationId(payment.id),
        );
        const debit = transactions.find(
          (transaction) =>
            (transaction.status === "000" || transaction.status === "0") &&
            transaction.validation.toLowerCase() !== "txnsetup" &&
            Boolean(transaction.tranId),
        );
        transactionId = debit?.tranId || null;
      }
      return {
        paymentId: payment.id,
        receiptId: data.id,
        provider: payment.provider,
        transactionId,
        terminalKind:
          metadata.subscription_management === "hyp_merchant_token" ? "recurring" : "primary",
        amount: Number(payment.amount),
        paidAt: payment.paid_at,
        customerName: payment.member?.name ?? null,
        customerEmail: payment.member?.email ?? null,
        itemDescription: payment.plan?.name ?? "תשלום ל-Cloud & Core",
        externalProvider: data.external_provider,
        externalStatus: data.external_status,
        externalDocumentId: data.external_doc_id,
        externalDocumentNumber: data.external_doc_number,
        externalDocumentUrl: data.external_doc_url,
      };
    },
    async claimReceipt(receiptId) {
      const { data, error } = await supabaseAdmin
        .from("receipts")
        .update({
          external_provider: "hyp",
          external_status: "pending",
          external_error: null,
          external_attempted_at: new Date().toISOString(),
        } as any)
        .eq("id", receiptId)
        .or("external_status.is.null,external_status.eq.failed")
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
          external_status: "issued",
          external_doc_id: document.documentId,
          external_doc_number: document.documentNumber,
          external_doc_url: document.documentUrl,
          external_error: null,
        } as any)
        .eq("id", receiptId)
        .eq("external_status", "pending")
        .select("payment_id")
        .single();
      if (receiptError) throw receiptError;
      const { error: paymentError } = await supabaseAdmin
        .from("payments")
        .update({ receipt_url: document.documentUrl })
        .eq("id", receipt.payment_id);
      if (paymentError) throw paymentError;
    },
    async failReceipt(receiptId, message, ambiguous) {
      const { error } = await supabaseAdmin
        .from("receipts")
        .update({
          external_provider: "hyp",
          external_status: ambiguous ? "ambiguous" : "failed",
          external_error: message.slice(0, 500),
        } as any)
        .eq("id", receiptId)
        .eq("external_status", "pending");
      if (error) console.error("hyp_invoice_failure_persist_failed", error.message);
    },
    issueReceipt: (input, terminalKind) =>
      (terminalKind === "recurring" ? recurringClient : primaryClient).issueReceipt(input),
  };
}

export async function issueHypReceiptForPayment(paymentId: string, deps?: HypReceiptIssuanceDeps) {
  if (!deps && process.env.HYP_INVOICE_API_ENABLED?.trim().toLowerCase() !== "true") {
    return { status: "disabled" as const };
  }
  const runtimeDeps = deps ?? defaultDeps();
  const record = await runtimeDeps.loadPaymentReceipt(paymentId);
  if (!record) return { status: "receipt_not_found" as const };
  if (record.provider !== "hyp") return { status: "not_hyp_payment" as const };
  if (
    record.externalProvider === "hyp" &&
    record.externalStatus === "issued" &&
    record.externalDocumentUrl
  ) {
    return {
      status: "already_issued" as const,
      documentNumber: record.externalDocumentNumber,
      documentUrl: record.externalDocumentUrl,
    };
  }
  if (!record.transactionId) throw new Error("hyp_invoice_missing_transaction_id");
  if (!record.customerName?.trim()) throw new Error("hyp_invoice_missing_customer_name");
  if (!record.customerEmail?.trim()) throw new Error("hyp_invoice_missing_customer_email");

  const claimed = await runtimeDeps.claimReceipt(record.receiptId);
  if (!claimed) return { status: "already_claimed" as const };

  try {
    const document = await runtimeDeps.issueReceipt(
      {
        transactionId: record.transactionId,
        amountAgorot: Math.round(Number(record.amount) * 100),
        customerName: record.customerName,
        customerEmail: record.customerEmail,
        itemDescription: record.itemDescription?.trim() || "תשלום ל-Cloud & Core",
        issuedOn: isoDate(record.paidAt),
      },
      record.terminalKind,
    );
    await runtimeDeps.completeReceipt(record.receiptId, document);
    return {
      status: "issued" as const,
      documentNumber: document.documentNumber,
      documentUrl: document.documentUrl,
    };
  } catch (error) {
    const message = errorMessage(error);
    await runtimeDeps.failReceipt(
      record.receiptId,
      message,
      !message.startsWith("hyp_invoice_failed:"),
    );
    throw error;
  }
}

export async function sweepFailedHypReceipts(limit = 10) {
  if (process.env.HYP_INVOICE_API_ENABLED?.trim().toLowerCase() !== "true") {
    return { status: "disabled" as const, checked: 0, results: [] };
  }
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: staleClaims, error: staleError } = await supabaseAdmin
    .from("receipts")
    .update({
      external_status: "ambiguous",
      external_error: "stale_pending_requires_reconciliation",
    })
    .eq("external_provider", "hyp")
    .eq("external_status", "pending")
    .lt("external_attempted_at", staleBefore)
    .select("payment_id");
  if (staleError) throw staleError;
  if (staleClaims?.length) {
    console.error(
      "hyp_invoice_ambiguous_receipts_require_reconciliation",
      staleClaims.map((receipt) => receipt.payment_id),
    );
  }

  const { data, error } = await supabaseAdmin
    .from("receipts")
    .select("payment_id")
    .eq("external_provider", "hyp")
    .eq("external_status", "failed")
    .order("external_attempted_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 50)));
  if (error) throw error;
  const results = [];
  for (const receipt of data ?? []) {
    try {
      results.push(await issueHypReceiptForPayment(receipt.payment_id));
    } catch (receiptError) {
      results.push({ status: "failed" as const, error: errorMessage(receiptError) });
    }
  }
  return {
    status: "ok" as const,
    checked: (data ?? []).length,
    ambiguous: (staleClaims ?? []).length,
    results,
  };
}
