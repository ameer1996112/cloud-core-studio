import { describe, expect, test } from "bun:test";
import { createHypInvoiceClient } from "../../src/lib/hypInvoiceClient.ts";
import { issueHypReceiptForPayment } from "../../src/lib/hypReceiptIssuance.server.ts";

const successXml = `<?xml version="1.0"?>
<ashrait>
  <response>
    <command>addCgInvoice</command>
    <result>000</result>
    <message>Permitted transaction</message>
    <addCgInvoice>
      <invoice>
        <invoiceResponseCode>100</invoiceResponseCode>
        <invoiceResponseName>Proper Invoice Request</invoiceResponseName>
        <invoiceDocNumber>3001</invoiceDocNumber>
        <invoiceDocUrl>https://demo.ezcount.co.il/front/documents/get/receipt-1/copy_he</invoiceDocUrl>
        <invoiceAtranId>119328971</invoiceAtranId>
      </invoice>
    </addCgInvoice>
  </response>
</ashrait>`;

describe("HYP legal receipt client", () => {
  test("issues and emails a receipt for the confirmed transaction", async () => {
    const calls = [];
    const client = createHypInvoiceClient({
      relayUrl: "https://hyp.example/xpo/Relay",
      user: "api-user",
      password: "api-password",
      terminalNumber: "0882819014",
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return new Response(successXml, { status: 200 });
      },
    });

    const result = await client.issueReceipt({
      transactionId: "119284861",
      amountAgorot: 12500,
      customerName: "נועה ישראלי",
      customerEmail: "noa@example.com",
      itemDescription: "חבילת 10 שיעורים",
      issuedOn: "2026-07-26",
    });

    expect(result).toEqual({
      documentId: "119328971",
      documentNumber: "3001",
      documentUrl: "https://demo.ezcount.co.il/front/documents/get/receipt-1/copy_he",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://hyp.example/xpo/Relay");
    expect(calls[0].init.method).toBe("POST");
    const body = new URLSearchParams(calls[0].init.body);
    expect(body.get("user")).toBe("api-user");
    expect(body.get("password")).toBe("api-password");
    expect(body.get("int_in")).toContain("<command>addCgInvoice</command>");
    expect(body.get("int_in")).toContain("<invoiceAtranId>119284861</invoiceAtranId>");
    expect(body.get("int_in")).toContain("<invoiceType>receipt</invoiceType>");
    expect(body.get("int_in")).toContain("<invoiceItemPrice>12500</invoiceItemPrice>");
    expect(body.get("int_in")).toContain("<companyInfo>נועה ישראלי</companyInfo>");
    expect(body.get("int_in")).toContain("<mailTo>noa@example.com</mailTo>");
    expect(body.get("int_in")).toContain("<sendMail>1</sendMail>");
    expect(body.get("int_in")).toContain("<DocNotMaam>0</DocNotMaam>");
  });

  test("escapes customer data before embedding it in XML", async () => {
    let requestXml = "";
    const client = createHypInvoiceClient({
      relayUrl: "https://hyp.example/xpo/Relay",
      user: "api-user",
      password: "api-password",
      terminalNumber: "0882819014",
      fetchImpl: async (_url, init) => {
        requestXml = new URLSearchParams(init.body).get("int_in");
        return new Response(successXml, { status: 200 });
      },
    });

    await client.issueReceipt({
      transactionId: "119284861",
      amountAgorot: 100,
      customerName: "Cloud & Core <Studio>",
      customerEmail: "billing+test@example.com",
      itemDescription: "Yoga & Pilates",
      issuedOn: "2026-07-26",
    });

    expect(requestXml).toContain("<companyInfo>Cloud &amp; Core &lt;Studio&gt;</companyInfo>");
    expect(requestXml).toContain(
      "<invoiceItemDescription>Yoga &amp; Pilates</invoiceItemDescription>",
    );
  });

  test("rejects an unsuccessful HYP invoice response", async () => {
    const client = createHypInvoiceClient({
      relayUrl: "https://hyp.example/xpo/Relay",
      user: "api-user",
      password: "api-password",
      terminalNumber: "0882819014",
      fetchImpl: async () =>
        new Response(
          "<ashrait><response><result>000</result><invoiceResponseCode>131</invoiceResponseCode><invoiceResponseName>Amount mismatch</invoiceResponseName></response></ashrait>",
          { status: 200 },
        ),
    });

    await expect(
      client.issueReceipt({
        transactionId: "119284861",
        amountAgorot: 12500,
        customerName: "נועה ישראלי",
        customerEmail: "noa@example.com",
        itemDescription: "חבילה",
        issuedOn: "2026-07-26",
      }),
    ).rejects.toThrow("hyp_invoice_failed:131:Amount mismatch");
  });
});

describe("confirmed HYP payment receipt issuance", () => {
  test("persists one legal receipt when the confirmation is delivered twice", async () => {
    const record = {
      paymentId: "payment-1",
      receiptId: "receipt-1",
      provider: "hyp",
      transactionId: "119284861",
      terminalKind: "primary",
      amount: 125,
      paidAt: "2026-07-26T09:30:00.000Z",
      customerName: "נועה ישראלי",
      customerEmail: "noa@example.com",
      itemDescription: "חבילת 10 שיעורים",
      externalProvider: null,
      externalStatus: null,
      externalDocumentId: null,
      externalDocumentNumber: null,
      externalDocumentUrl: null,
    };
    const calls = [];
    const deps = {
      loadPaymentReceipt: async () => ({ ...record }),
      claimReceipt: async () => {
        if (record.externalStatus === "pending" || record.externalStatus === "issued") return false;
        record.externalProvider = "hyp";
        record.externalStatus = "pending";
        return true;
      },
      completeReceipt: async (_receiptId, document) => {
        record.externalProvider = "hyp";
        record.externalStatus = "issued";
        record.externalDocumentId = document.documentId;
        record.externalDocumentNumber = document.documentNumber;
        record.externalDocumentUrl = document.documentUrl;
      },
      failReceipt: async () => {
        record.externalProvider = "hyp";
        record.externalStatus = "failed";
      },
      issueReceipt: async (input, terminalKind) => {
        calls.push(input);
        expect(terminalKind).toBe("primary");
        return {
          documentId: "119328971",
          documentNumber: "3001",
          documentUrl: "https://ezcount.example/receipt-1",
        };
      },
    };

    const first = await issueHypReceiptForPayment("payment-1", deps);
    const second = await issueHypReceiptForPayment("payment-1", deps);

    expect(first).toEqual({
      status: "issued",
      documentNumber: "3001",
      documentUrl: "https://ezcount.example/receipt-1",
    });
    expect(second).toEqual({
      status: "already_issued",
      documentNumber: "3001",
      documentUrl: "https://ezcount.example/receipt-1",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      transactionId: "119284861",
      amountAgorot: 12500,
      customerName: "נועה ישראלי",
      customerEmail: "noa@example.com",
      itemDescription: "חבילת 10 שיעורים",
      issuedOn: "2026-07-26",
    });
  });

  test("leaves an approved payment intact and marks issuance for retry when HYP fails", async () => {
    let failedMessage = "";
    const deps = {
      loadPaymentReceipt: async () => ({
        paymentId: "payment-1",
        receiptId: "receipt-1",
        provider: "hyp",
        transactionId: "119284861",
        terminalKind: "primary",
        amount: 125,
        paidAt: "2026-07-26T09:30:00.000Z",
        customerName: "נועה ישראלי",
        customerEmail: "noa@example.com",
        itemDescription: "חבילה",
        externalProvider: null,
        externalStatus: null,
        externalDocumentId: null,
        externalDocumentNumber: null,
        externalDocumentUrl: null,
      }),
      claimReceipt: async () => true,
      completeReceipt: async () => {
        throw new Error("should_not_complete");
      },
      failReceipt: async (_receiptId, message, ambiguous) => {
        failedMessage = message;
        expect(ambiguous).toBe(true);
      },
      issueReceipt: async () => {
        throw new Error("hyp_invoice_http_503");
      },
    };

    await expect(issueHypReceiptForPayment("payment-1", deps)).rejects.toThrow(
      "hyp_invoice_http_503",
    );
    expect(failedMessage).toBe("hyp_invoice_http_503");
  });
});
