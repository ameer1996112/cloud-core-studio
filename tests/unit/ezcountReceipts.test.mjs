import { describe, expect, test } from "bun:test";
import { createEzcountReceiptClient } from "../../src/lib/ezcountReceiptClient.ts";
import {
  issueEzcountReceiptForKidsPayment,
  issueEzcountReceiptForPayment,
} from "../../src/lib/ezcountReceiptIssuance.server.ts";

describe("EZcount legal receipt client", () => {
  test("creates and emails one Hebrew receipt for a confirmed HYP payment", async () => {
    const calls = [];
    const client = createEzcountReceiptClient({
      apiKey: "ezcount-api-key",
      developerEmail: "cloudandcorestudio@gmail.com",
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return Response.json({
          success: true,
          doc_uuid: "b638add7-26a3-4f66-968e-7942e9fb850f",
          doc_number: "3001",
          pdf_link: "https://www.ezcount.co.il/front/documents/get/receipt-1",
          sent_mails: ["noa@example.com"],
        });
      },
    });

    const result = await client.issueReceipt({
      paymentId: "payment-1",
      amountAgorot: 12500,
      customerName: "נועה ישראלי",
      customerEmail: "noa@example.com",
      itemDescription: "חבילת 10 שיעורים",
      issuedOn: "2026-07-26",
      cardLast4: "9876",
    });

    expect(result).toEqual({
      documentId: "b638add7-26a3-4f66-968e-7942e9fb850f",
      documentNumber: "3001",
      documentUrl: "https://www.ezcount.co.il/front/documents/get/receipt-1",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.ezcount.co.il/api/createDoc");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers["content-type"]).toBe("application/json");

    const body = JSON.parse(calls[0].init.body);
    expect(body.created_by_api_key).toBeUndefined();
    expect(body).toMatchObject({
      developer_email: "cloudandcorestudio@gmail.com",
      api_key: "ezcount-api-key",
      type: 400,
      transaction_id: "payment-1",
      date: "26/07/2026",
      lang: "he",
      customer_name: "נועה ישראלי",
      customer_email: "noa@example.com",
      forceItemsIntoNonItemsDocument: 1,
      vat: 0,
      dont_send_email: 0,
      send_copy: 0,
      auto_balance: 1,
      price_total: 125,
      comment: "תודה שבחרת ב-Cloud & Core Studio.\nלשאלות ושירות: 055-939-8438",
      email_text:
        "שלום,\n\nמצורפת הקבלה שלך מ-Cloud & Core Studio.\n\nתודה שבחרת בנו.\nלשאלות ושירות: 055-939-8438",
    });
    expect(body.item).toEqual([
      {
        catalog_number: "CC-STUDIO",
        details: "חבילת 10 שיעורים",
        price: 125,
        amount: 1,
      },
    ]);
    expect(body.payment).toEqual([
      {
        payment_type: 3,
        payment_sum: 125,
        cc_type: 0,
        cc_type_name: "HYP",
        cc_number: "9876",
        cc_deal_type: 1,
        cc_num_of_payments: 1,
        cc_payment_num: 1,
      },
    ]);
  });

  test("rejects a failed response without treating it as an issued receipt", async () => {
    const client = createEzcountReceiptClient({
      apiKey: "ezcount-api-key",
      developerEmail: "cloudandcorestudio@gmail.com",
      fetchImpl: async () =>
        Response.json({ success: false, err: "Transaction id already exists" }),
    });

    await expect(
      client.issueReceipt({
        paymentId: "payment-1",
        amountAgorot: 12500,
        customerName: "נועה ישראלי",
        customerEmail: "noa@example.com",
        itemDescription: "חבילה",
        issuedOn: "2026-07-26",
        cardLast4: "1234",
      }),
    ).rejects.toThrow("ezcount_receipt_failed:Transaction id already exists");
  });

  test("treats an unreadable successful HTTP response as ambiguous", async () => {
    const client = createEzcountReceiptClient({
      apiKey: "ezcount-api-key",
      developerEmail: "cloudandcorestudio@gmail.com",
      fetchImpl: async () => new Response("", { status: 200 }),
    });

    await expect(
      client.issueReceipt({
        paymentId: "payment-1",
        amountAgorot: 12500,
        customerName: "נועה ישראלי",
        customerEmail: "noa@example.com",
        itemDescription: "חבילה",
        issuedOn: "2026-07-26",
        cardLast4: "1234",
      }),
    ).rejects.toThrow("ezcount_receipt_ambiguous_response");
  });
});

describe("confirmed HYP payment EZcount receipt issuance", () => {
  test("persists exactly one receipt when confirmation is delivered twice", async () => {
    const record = {
      paymentId: "payment-1",
      receiptId: "receipt-1",
      provider: "hyp",
      amount: 125,
      paidAt: "2026-07-26T21:30:00.000Z",
      customerName: "נועה ישראלי",
      customerEmail: "noa@example.com",
      itemDescription: "חבילת 10 שיעורים",
      cardLast4: "9876",
      externalProvider: null,
      externalStatus: null,
      externalDocumentId: null,
      externalDocumentNumber: null,
      externalDocumentUrl: null,
    };
    const issued = [];
    const deps = {
      loadPaymentReceipt: async () => ({ ...record }),
      claimReceipt: async () => {
        if (record.externalStatus === "pending" || record.externalStatus === "issued") return false;
        record.externalProvider = "ezcount";
        record.externalStatus = "pending";
        return true;
      },
      completeReceipt: async (_receiptId, document) => {
        record.externalProvider = "ezcount";
        record.externalStatus = "issued";
        record.externalDocumentId = document.documentId;
        record.externalDocumentNumber = document.documentNumber;
        record.externalDocumentUrl = document.documentUrl;
      },
      failReceipt: async () => {
        record.externalProvider = "ezcount";
        record.externalStatus = "failed";
      },
      issueReceipt: async (input) => {
        issued.push(input);
        return {
          documentId: "receipt-doc-1",
          documentNumber: "3001",
          documentUrl: "https://ezcount.example/receipt-1",
        };
      },
    };

    const first = await issueEzcountReceiptForPayment("payment-1", deps);
    const second = await issueEzcountReceiptForPayment("payment-1", deps);

    expect(first.status).toBe("issued");
    expect(second.status).toBe("already_issued");
    expect(issued).toEqual([
      {
        paymentId: "payment-1",
        amountAgorot: 12500,
        customerName: "נועה ישראלי",
        customerEmail: "noa@example.com",
        itemDescription: "חבילת 10 שיעורים",
        issuedOn: "2026-07-27",
        cardLast4: "9876",
      },
    ]);
  });

  test("marks a definite EZcount rejection retryable without changing payment approval", async () => {
    let failure = null;
    const deps = {
      loadPaymentReceipt: async () => ({
        paymentId: "payment-1",
        receiptId: "receipt-1",
        provider: "hyp",
        amount: 125,
        paidAt: "2026-07-26T09:30:00.000Z",
        customerName: "נועה ישראלי",
        customerEmail: "noa@example.com",
        itemDescription: "חבילה",
        cardLast4: null,
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
        failure = { message, ambiguous };
      },
      issueReceipt: async () => {
        throw new Error("ezcount_receipt_failed:invalid_customer");
      },
    };

    await expect(issueEzcountReceiptForPayment("payment-1", deps)).rejects.toThrow(
      "ezcount_receipt_failed:invalid_customer",
    );
    expect(failure).toEqual({
      message: "ezcount_receipt_failed:invalid_customer",
      ambiguous: false,
    });
  });
});

describe("confirmed kids HYP payment EZcount receipt issuance", () => {
  test("issues exactly one receipt to the guardian", async () => {
    const record = {
      paymentId: "kids-payment-1",
      receiptId: "kids-payment-1",
      provider: "hyp",
      amount: 280,
      paidAt: "2026-07-26T09:30:00.000Z",
      customerName: "נועה ישראלי",
      customerEmail: "noa@example.com",
      itemDescription: "חודשי לילדים - 4 שיעורים",
      cardLast4: "4321",
      externalProvider: null,
      externalStatus: null,
      externalDocumentId: null,
      externalDocumentNumber: null,
      externalDocumentUrl: null,
    };
    const issued = [];
    const deps = {
      loadPayment: async () => ({ ...record }),
      claimPayment: async () => {
        if (record.externalStatus !== null) return false;
        record.externalProvider = "ezcount";
        record.externalStatus = "pending";
        return true;
      },
      completePayment: async (_paymentId, document) => {
        record.externalStatus = "issued";
        record.externalDocumentId = document.documentId;
        record.externalDocumentNumber = document.documentNumber;
        record.externalDocumentUrl = document.documentUrl;
      },
      failPayment: async () => {
        record.externalStatus = "failed";
      },
      issueReceipt: async (input) => {
        issued.push(input);
        return {
          documentId: "kids-doc-1",
          documentNumber: "3002",
          documentUrl: "https://ezcount.example/kids-receipt-1",
        };
      },
    };

    expect((await issueEzcountReceiptForKidsPayment(record.paymentId, deps)).status).toBe("issued");
    expect((await issueEzcountReceiptForKidsPayment(record.paymentId, deps)).status).toBe(
      "already_issued",
    );
    expect(issued).toEqual([
      {
        paymentId: "kids-payment-1",
        amountAgorot: 28000,
        customerName: "נועה ישראלי",
        customerEmail: "noa@example.com",
        itemDescription: "חודשי לילדים - 4 שיעורים",
        issuedOn: "2026-07-26",
        cardLast4: "4321",
      },
    ]);
  });
});
