import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const readSource = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("payment lifecycle producers", () => {
  test("sends one member completion email and leaves receipt delivery to its legal source", () => {
    for (const sourcePath of [
      "../../src/lib/paymentNotifications.server.ts",
      "../../src/lib/receipts.functions.ts",
    ]) {
      const source = readSource(sourcePath);
      const lifecycleBlock = source.match(
        /eventKey: "payment_confirmed"[\s\S]+?insertNotificationDraftRows[^;]+;/,
      )?.[0];

      expect(lifecycleBlock).toContain('channels: ["email"]');
      expect(lifecycleBlock).not.toContain('eventKey: "receipt_issued"');
      expect(lifecycleBlock).not.toContain('"whatsapp"');
    }
  });

  test("kicks asynchronous delivery after the browser-return payment transaction commits", () => {
    const source = readSource("../../src/routes/api/public/payments/hyp.return.ts");
    expect(source).toContain("import { kickUnifiedMessagingAfterCommit }");
    expect(source).toMatch(
      /await handleHypConfirmedPayment\(result\);\s+await kickUnifiedMessagingAfterCommit\(\);/,
    );
  });
});
