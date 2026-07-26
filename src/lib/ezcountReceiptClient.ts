export type EzcountReceiptClientConfig = {
  apiKey: string;
  developerEmail: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

export type EzcountReceiptRequest = {
  paymentId: string;
  amountAgorot: number;
  customerName: string;
  customerEmail: string;
  itemDescription: string;
  issuedOn: string;
  cardLast4: string | null;
};

export type EzcountReceiptDocument = {
  documentId: string;
  documentNumber: string;
  documentUrl: string;
};

const DEFAULT_ENDPOINT = "https://api.ezcount.co.il/api/createDoc";
const DOCUMENT_COMMENT = "תודה שבחרת ב-Cloud & Core Studio.\nלשאלות ושירות: 055-939-8438";
const EMAIL_TEXT =
  "שלום,\n\nמצורפת הקבלה שלך מ-Cloud & Core Studio.\n\nתודה שבחרת בנו.\nלשאלות ושירות: 055-939-8438";

function required(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`ezcount_receipt_missing_${field}`);
  return normalized;
}

function amountFromAgorot(value: number) {
  const amountAgorot = Math.round(Number(value));
  if (!Number.isSafeInteger(amountAgorot) || amountAgorot <= 0) {
    throw new Error("ezcount_receipt_invalid_amount");
  }
  return amountAgorot / 100;
}

function apiError(payload: Record<string, unknown>) {
  for (const key of ["err", "error", "message", "error_message"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "unknown";
}

function formatDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error("ezcount_receipt_invalid_issued_on");
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function createEzcountReceiptClient(config: EzcountReceiptClientConfig) {
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    async issueReceipt(input: EzcountReceiptRequest): Promise<EzcountReceiptDocument> {
      const amount = amountFromAgorot(input.amountAgorot);
      const paymentId = required(input.paymentId, "payment_id");
      const customerName = required(input.customerName, "customer_name");
      const customerEmail = required(input.customerEmail, "customer_email");
      const itemDescription = required(input.itemDescription, "item_description");
      const cardLast4 = input.cardLast4?.replace(/\D/g, "").slice(-4) || "";

      const response = await fetchImpl(config.endpoint?.trim() || DEFAULT_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          developer_email: required(config.developerEmail, "developer_email"),
          api_key: required(config.apiKey, "api_key"),
          type: 400,
          created_by_api_key: required(config.apiKey, "api_key"),
          transaction_id: paymentId,
          date: formatDate(input.issuedOn),
          lang: "he",
          description: itemDescription,
          customer_name: customerName,
          customer_email: customerEmail,
          forceItemsIntoNonItemsDocument: 1,
          item: [
            {
              catalog_number: "CC-STUDIO",
              details: itemDescription,
              price: amount,
              amount: 1,
            },
          ],
          payment: [
            {
              payment_type: 3,
              payment_sum: amount,
              cc_type: 0,
              cc_type_name: "HYP",
              cc_number: cardLast4,
              cc_deal_type: 1,
              cc_num_of_payments: 1,
              cc_payment_num: 1,
            },
          ],
          vat: 0,
          price_total: amount,
          comment: DOCUMENT_COMMENT,
          email_text: EMAIL_TEXT,
          dont_send_email: 0,
          send_copy: 0,
          print_type: "PDF",
          auto_balance: 1,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) throw new Error(`ezcount_receipt_http_${response.status}`);
      if (payload.success !== true) {
        throw new Error(`ezcount_receipt_failed:${apiError(payload)}`);
      }

      return {
        documentId: required(String(payload.doc_uuid ?? ""), "document_id"),
        documentNumber: required(String(payload.doc_number ?? ""), "document_number"),
        documentUrl: required(String(payload.pdf_link ?? ""), "document_url"),
      };
    },
  };
}
