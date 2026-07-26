export type HypInvoiceClientConfig = {
  relayUrl: string;
  user: string;
  password: string;
  terminalNumber: string;
  layoutId?: string;
  fetchImpl?: typeof fetch;
};

export type HypReceiptRequest = {
  transactionId: string;
  amountAgorot: number;
  customerName: string;
  customerEmail: string;
  itemDescription: string;
  issuedOn: string;
};

export type HypReceiptDocument = {
  documentId: string;
  documentNumber: string;
  documentUrl: string;
};

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function xmlText(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match) return "";
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function required(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`hyp_invoice_missing_${field}`);
  return normalized;
}

function buildReceiptXml(input: HypReceiptRequest, config: HypInvoiceClientConfig) {
  const amountAgorot = Math.round(Number(input.amountAgorot));
  if (!Number.isSafeInteger(amountAgorot) || amountAgorot <= 0) {
    throw new Error("hyp_invoice_invalid_amount");
  }

  const invoice = [
    "<invoiceCreationMethod>wait</invoiceCreationMethod>",
    "<invoiceType>receipt</invoiceType>",
    `<invoiceSubject>${xmlEscape(required(input.itemDescription, "item_description"))}</invoiceSubject>`,
    "<invoiceItemCode>1</invoiceItemCode>",
    `<invoiceItemDescription>${xmlEscape(required(input.itemDescription, "item_description"))}</invoiceItemDescription>`,
    "<invoiceItemQuantity>1</invoiceItemQuantity>",
    `<invoiceItemPrice>${amountAgorot}</invoiceItemPrice>`,
    `<companyInfo>${xmlEscape(required(input.customerName, "customer_name"))}</companyInfo>`,
    `<mailTo>${xmlEscape(required(input.customerEmail, "customer_email"))}</mailTo>`,
    "<isItemPriceWithTax>1</isItemPriceWithTax>",
    "<invoiceItemMaam>0</invoiceItemMaam>",
    "<DocNotMaam>0</DocNotMaam>",
    "<sendMail>1</sendMail>",
    `<ccDate>${xmlEscape(required(input.issuedOn, "issued_on"))}</ccDate>`,
    config.layoutId?.trim() ? `<ua_uuid>${xmlEscape(config.layoutId.trim())}</ua_uuid>` : "",
  ].join("");

  return `<ashrait><request><version>2000</version><language>HEB</language><dateTime/><requestId/><command>addCgInvoice</command><addCgInvoice><invoiceAtranId>${xmlEscape(required(input.transactionId, "transaction_id"))}</invoiceAtranId><terminalNumber>${xmlEscape(required(config.terminalNumber, "terminal_number"))}</terminalNumber><invoice>${invoice}</invoice></addCgInvoice></request></ashrait>`;
}

function parseReceiptResponse(xml: string): HypReceiptDocument {
  const result = xmlText(xml, "result");
  const invoiceResponseCode = xmlText(xml, "invoiceResponseCode");
  const message =
    xmlText(xml, "invoiceResponseName") || xmlText(xml, "userMessage") || xmlText(xml, "message");
  if (result !== "000" || invoiceResponseCode !== "100") {
    throw new Error(
      `hyp_invoice_failed:${invoiceResponseCode || result || "unknown"}:${message || "unknown"}`,
    );
  }

  return {
    documentId: required(xmlText(xml, "invoiceAtranId"), "document_id"),
    documentNumber: required(xmlText(xml, "invoiceDocNumber"), "document_number"),
    documentUrl: required(xmlText(xml, "invoiceDocUrl"), "document_url"),
  };
}

export function createHypInvoiceClient(config: HypInvoiceClientConfig) {
  const fetchImpl = config.fetchImpl ?? fetch;
  return {
    async issueReceipt(input: HypReceiptRequest): Promise<HypReceiptDocument> {
      const xml = buildReceiptXml(input, config);
      const response = await fetchImpl(required(config.relayUrl, "relay_url"), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          user: required(config.user, "api_user"),
          password: required(config.password, "api_password"),
          int_in: xml,
        }),
      });
      const responseText = await response.text();
      if (!response.ok) throw new Error(`hyp_invoice_http_${response.status}`);
      return parseReceiptResponse(responseText);
    },
  };
}
