import { describe, expect, test } from "bun:test";
import { buildMessagingLogRecord } from "../../src/lib/messagingLogging.server.ts";

describe("messaging structured logging", () => {
  test("keeps correlation fields and removes PII and secrets recursively", () => {
    const record = buildMessagingLogRecord("delivery_attempt", {
      correlationId: "corr-1",
      messageId: "message-1",
      deliveryId: "delivery-1",
      attemptId: "attempt-1",
      provider: "whatsapp",
      outcome: "failed",
      durationMs: 42,
      retryClassification: "transient",
      name: "Noa",
      phone: "+972501234567",
      body: "private message",
      token: "secret",
      nested: { email: "person@example.com", signature: "sha256=secret" },
    });
    expect(record).toMatchObject({
      event: "delivery_attempt",
      correlationId: "corr-1",
      messageId: "message-1",
      deliveryId: "delivery-1",
      attemptId: "attempt-1",
      provider: "whatsapp",
      durationMs: 42,
    });
    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain("Noa");
    expect(serialized).not.toContain("972501234567");
    expect(serialized).not.toContain("person@example.com");
    expect(serialized).not.toContain("private message");
    expect(serialized).not.toContain("secret");
  });
});
