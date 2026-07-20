const SAFE_FIELDS = new Set([
  "correlationId",
  "messageId",
  "deliveryId",
  "attemptId",
  "conversationId",
  "webhookEventId",
  "provider",
  "channel",
  "outcome",
  "durationMs",
  "retryClassification",
  "httpStatus",
  "errorCode",
  "eventType",
  "status",
  "attemptNumber",
  "workerId",
  "duplicate",
]);

export function buildMessagingLogRecord(
  event: string,
  fields: Record<string, unknown>,
  at = new Date(),
) {
  const safe: Record<string, unknown> = {
    timestamp: at.toISOString(),
    event,
    component: "unified_messaging",
  };
  for (const [key, value] of Object.entries(fields)) {
    if (!SAFE_FIELDS.has(key)) continue;
    if (["string", "number", "boolean"].includes(typeof value) || value == null) safe[key] = value;
  }
  return safe;
}

export function logMessagingEvent(event: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify(buildMessagingLogRecord(event, fields)));
}
