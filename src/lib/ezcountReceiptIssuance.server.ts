import {
  createEzcountReceiptClient,
  type EzcountReceiptDocument,
  type EzcountReceiptRequest,
} from "@/lib/ezcountReceiptClient";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type PaymentReceiptRecord = {
  paymentId: string;
  receiptId: string;
  provider: string;
  amount: number;
  paidAt: string | null;
  customerName: string | null;
  customerEmail: string | null;
  itemDescription: string | null;
  cardLast4: string | null;
  externalProvider: string | null;
  externalStatus: string | null;
  externalDocumentId: string | null;
  externalDocumentNumber: string | null;
  externalDocumentUrl: string | null;
};

type EzcountReceiptIssuanceDeps = {
  loadPaymentReceipt(paymentId: string): Promise<PaymentReceiptRecord | null>;
  claimReceipt(receiptId: string): Promise<boolean>;
  completeReceipt(receiptId: string, document: EzcountReceiptDocument): Promise<void>;
  failReceipt(receiptId: string, message: string, ambiguous: boolean): Promise<void>;
  issueReceipt(input: EzcountReceiptRequest): Promise<EzcountReceiptDocument>;
};

type KidsReceiptIssuanceDeps = {
  loadPayment(paymentId: string): Promise<PaymentReceiptRecord | null>;
  claimPayment(paymentId: string): Promise<boolean>;
  completePayment(paymentId: string, document: EzcountReceiptDocument): Promise<void>;
  failPayment(paymentId: string, message: string, ambiguous: boolean): Promise<void>;
  issueReceipt(input: EzcountReceiptRequest): Promise<EzcountReceiptDocument>;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isoDate(value: string | null) {
  const date = value ? new Date(value) : new Date();
  if (!Number.isFinite(date.getTime())) throw new Error("hyp_invoice_invalid_payment_date");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function defaultDeps(): EzcountReceiptIssuanceDeps {
  const client = createEzcountReceiptClient({
    apiKey: process.env.EZCOUNT_API_KEY?.trim() || "",
    developerEmail:
      process.env.EZCOUNT_DEVELOPER_EMAIL?.trim() ||
      process.env.PAYMENT_NOTIFICATION_EMAIL?.trim() ||
      "",
    endpoint: process.env.EZCOUNT_API_URL?.trim() || undefined,
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
      const cardLast4 =
        String(metadata.L4digit ?? metadata.cardMask ?? metadata.token_last4 ?? "")
          .replace(/\D/g, "")
          .slice(-4) || null;
      return {
        paymentId: payment.id,
        receiptId: data.id,
        provider: payment.provider,
        amount: Number(payment.amount),
        paidAt: payment.paid_at,
        customerName: payment.member?.name ?? null,
        customerEmail: payment.member?.email ?? null,
        itemDescription: payment.plan?.name ?? "תשלום ל-Cloud & Core",
        cardLast4,
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
          external_provider: "ezcount",
          external_status: "pending",
          external_error: null,
          external_attempted_at: new Date().toISOString(),
        } as any)
        .eq("id", receiptId)
        .is("external_status", null)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    async completeReceipt(receiptId, document) {
      const { data: receipt, error: receiptError } = await supabaseAdmin
        .from("receipts")
        .update({
          external_provider: "ezcount",
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
          external_provider: "ezcount",
          external_status: ambiguous ? "ambiguous" : "failed",
          external_error: message.slice(0, 500),
        } as any)
        .eq("id", receiptId)
        .eq("external_status", "pending");
      if (error) console.error("ezcount_receipt_failure_persist_failed", error.message);
    },
    issueReceipt: (input) => client.issueReceipt(input),
  };
}

function defaultKidsDeps(): KidsReceiptIssuanceDeps {
  const client = createEzcountReceiptClient({
    apiKey: process.env.EZCOUNT_API_KEY?.trim() || "",
    developerEmail:
      process.env.EZCOUNT_DEVELOPER_EMAIL?.trim() ||
      process.env.PAYMENT_NOTIFICATION_EMAIL?.trim() ||
      "",
    endpoint: process.env.EZCOUNT_API_URL?.trim() || undefined,
  });

  return {
    async loadPayment(paymentId) {
      const { data, error } = await (supabaseAdmin as any)
        .from("kid_aerial_payments")
        .select(
          "id,provider,amount,paid_at,metadata,external_provider,external_status,external_doc_id,external_doc_number,external_doc_url,child:kid_aerial_children(guardian_name,guardian_email),package:kid_aerial_packages(name)",
        )
        .eq("id", paymentId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const metadata = (data.metadata ?? {}) as Record<string, unknown>;
      const hypPayload = (metadata.hyp_payload ?? {}) as Record<string, unknown>;
      const cardLast4 =
        String(
          metadata.token_last4 ??
            hypPayload.token_last4 ??
            hypPayload.L4digit ??
            hypPayload.cardMask ??
            "",
        )
          .replace(/\D/g, "")
          .slice(-4) || null;
      return {
        paymentId: data.id,
        receiptId: data.id,
        provider: data.provider,
        amount: Number(data.amount),
        paidAt: data.paid_at,
        customerName: data.child?.guardian_name ?? null,
        customerEmail: data.child?.guardian_email ?? null,
        itemDescription: data.package?.name ?? "יוגה אווירית לילדים",
        cardLast4,
        externalProvider: data.external_provider,
        externalStatus: data.external_status,
        externalDocumentId: data.external_doc_id,
        externalDocumentNumber: data.external_doc_number,
        externalDocumentUrl: data.external_doc_url,
      };
    },
    async claimPayment(paymentId) {
      const { data, error } = await (supabaseAdmin as any)
        .from("kid_aerial_payments")
        .update({
          external_provider: "ezcount",
          external_status: "pending",
          external_error: null,
          external_attempted_at: new Date().toISOString(),
        })
        .eq("id", paymentId)
        .is("external_status", null)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    async completePayment(paymentId, document) {
      const { error } = await (supabaseAdmin as any)
        .from("kid_aerial_payments")
        .update({
          external_provider: "ezcount",
          external_status: "issued",
          external_doc_id: document.documentId,
          external_doc_number: document.documentNumber,
          external_doc_url: document.documentUrl,
          external_error: null,
        })
        .eq("id", paymentId)
        .eq("external_status", "pending");
      if (error) throw error;
    },
    async failPayment(paymentId, message, ambiguous) {
      const { error } = await (supabaseAdmin as any)
        .from("kid_aerial_payments")
        .update({
          external_provider: "ezcount",
          external_status: ambiguous ? "ambiguous" : "failed",
          external_error: message.slice(0, 500),
        })
        .eq("id", paymentId)
        .eq("external_status", "pending");
      if (error) console.error("ezcount_kids_receipt_failure_persist_failed", error.message);
    },
    issueReceipt: (input) => client.issueReceipt(input),
  };
}

export async function issueEzcountReceiptForPayment(
  paymentId: string,
  deps?: EzcountReceiptIssuanceDeps,
) {
  if (!deps && process.env.EZCOUNT_RECEIPTS_ENABLED?.trim().toLowerCase() !== "true") {
    return { status: "disabled" as const };
  }
  const runtimeDeps = deps ?? defaultDeps();
  const record = await runtimeDeps.loadPaymentReceipt(paymentId);
  if (!record) return { status: "receipt_not_found" as const };
  if (record.provider !== "hyp") return { status: "not_hyp_payment" as const };
  if (
    record.externalProvider === "ezcount" &&
    record.externalStatus === "issued" &&
    record.externalDocumentUrl
  ) {
    return {
      status: "already_issued" as const,
      documentNumber: record.externalDocumentNumber,
      documentUrl: record.externalDocumentUrl,
    };
  }
  if (!record.customerName?.trim()) throw new Error("ezcount_receipt_missing_customer_name");
  if (!record.customerEmail?.trim()) throw new Error("ezcount_receipt_missing_customer_email");

  const claimed = await runtimeDeps.claimReceipt(record.receiptId);
  if (!claimed) return { status: "already_claimed" as const };

  try {
    const document = await runtimeDeps.issueReceipt({
      paymentId: record.paymentId,
      amountAgorot: Math.round(Number(record.amount) * 100),
      customerName: record.customerName,
      customerEmail: record.customerEmail,
      itemDescription: record.itemDescription?.trim() || "תשלום ל-Cloud & Core",
      issuedOn: isoDate(record.paidAt),
      cardLast4: record.cardLast4,
    });
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
      !message.startsWith("ezcount_receipt_failed:"),
    );
    throw error;
  }
}

export async function issueEzcountReceiptForKidsPayment(
  paymentId: string,
  deps?: KidsReceiptIssuanceDeps,
) {
  if (!deps && process.env.EZCOUNT_RECEIPTS_ENABLED?.trim().toLowerCase() !== "true") {
    return { status: "disabled" as const };
  }
  const runtimeDeps = deps ?? defaultKidsDeps();
  const record = await runtimeDeps.loadPayment(paymentId);
  if (!record) return { status: "payment_not_found" as const };
  if (record.provider !== "hyp") return { status: "not_hyp_payment" as const };
  if (
    record.externalProvider === "ezcount" &&
    record.externalStatus === "issued" &&
    record.externalDocumentUrl
  ) {
    return {
      status: "already_issued" as const,
      documentNumber: record.externalDocumentNumber,
      documentUrl: record.externalDocumentUrl,
    };
  }
  if (!record.customerName?.trim()) throw new Error("ezcount_receipt_missing_customer_name");
  if (!record.customerEmail?.trim()) throw new Error("ezcount_receipt_missing_customer_email");

  const claimed = await runtimeDeps.claimPayment(record.paymentId);
  if (!claimed) return { status: "already_claimed" as const };

  try {
    const document = await runtimeDeps.issueReceipt({
      paymentId: record.paymentId,
      amountAgorot: Math.round(Number(record.amount) * 100),
      customerName: record.customerName,
      customerEmail: record.customerEmail,
      itemDescription: record.itemDescription?.trim() || "יוגה אווירית לילדים",
      issuedOn: isoDate(record.paidAt),
      cardLast4: record.cardLast4,
    });
    await runtimeDeps.completePayment(record.paymentId, document);
    return {
      status: "issued" as const,
      documentNumber: document.documentNumber,
      documentUrl: document.documentUrl,
    };
  } catch (error) {
    const message = errorMessage(error);
    await runtimeDeps.failPayment(
      record.paymentId,
      message,
      !message.startsWith("ezcount_receipt_failed:"),
    );
    throw error;
  }
}

export async function sweepFailedEzcountReceipts(_limit = 10) {
  if (process.env.EZCOUNT_RECEIPTS_ENABLED?.trim().toLowerCase() !== "true") {
    return { status: "disabled" as const, checked: 0, results: [] };
  }
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: staleClaims, error: staleError } = await supabaseAdmin
    .from("receipts")
    .update({
      external_status: "ambiguous",
      external_error: "stale_pending_requires_reconciliation",
    })
    .eq("external_provider", "ezcount")
    .eq("external_status", "pending")
    .lt("external_attempted_at", staleBefore)
    .select("payment_id");
  if (staleError) throw staleError;
  if (staleClaims?.length) {
    console.error(
      "ezcount_ambiguous_receipts_require_reconciliation",
      staleClaims.map((receipt) => receipt.payment_id),
    );
  }

  return {
    status: "ok" as const,
    checked: (staleClaims ?? []).length,
    ambiguous: (staleClaims ?? []).length,
    results: [],
  };
}
