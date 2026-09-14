import { clinicalServerClient } from "./health-clinical.server";
import type { ClinicalResponse } from "./health-clinical-contract";
import {
  declarationContext,
  decryptHealthBytes,
  encryptHealthBytes,
} from "./health-encryption.server";

async function rpc(actor: string, action: string, payload: Record<string, unknown>) {
  const { data, error } = await clinicalServerClient.rpc(
    "health_clinical_server_api" as never,
    { p_actor: actor, p_action: action, p_payload: payload } as never,
  );
  if (error) throw new Error(error.message);
  const response = data as unknown as ClinicalResponse;
  if (!response || response.error) throw new Error(response?.error ?? "HEALTH_UNAVAILABLE");
  return response;
}
export async function encryptedClinicalRequest(
  actor: string,
  action: string,
  payload: Record<string, unknown>,
) {
  if (action === "copy") {
    const response = await rpc(actor, "copy", payload);
    const d = response.declaration as NonNullable<ClinicalResponse["declaration"]> & {
      requestId: string;
    };
    if (!d || typeof d.requestId !== "string") throw new Error("HEALTH_UNAVAILABLE");
    const context = declarationContext(
      d.signerId,
      d.participantId,
      d.templateVersion,
      d.locale,
      d.requestId,
    );
    const encrypted = (d.answers as unknown as { _encrypted?: unknown })?._encrypted;
    const bytes = await decryptHealthBytes(encrypted, context);
    try {
      const content = JSON.parse(bytes.toString("utf8"));
      // Authorization may change while KMS processes the request.
      await rpc(actor, "copy", payload);
      const { requestId: _requestId, ...declaration } = d;
      return {
        ...response,
        declaration: {
          ...declaration,
          answers: content.answers,
          confirmations: content.confirmations,
        },
      } as ClinicalResponse;
    } finally {
      bytes.fill(0);
    }
  }
  if (action !== "submit") return rpc(actor, action, payload);
  const { answers, confirmations, templateVersion, locale } = payload;
  const participantId =
    typeof payload.participantId === "string"
      ? payload.participantId.toLowerCase()
      : payload.participantId;
  const idempotencyKey =
    typeof payload.idempotencyKey === "string"
      ? payload.idempotencyKey.toLowerCase()
      : payload.idempotencyKey;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    typeof participantId !== "string" ||
    !uuid.test(participantId) ||
    typeof idempotencyKey !== "string" ||
    !uuid.test(idempotencyKey) ||
    typeof templateVersion !== "string" ||
    !["en", "he", "ar"].includes(String(locale)) ||
    !answers ||
    typeof answers !== "object" ||
    Array.isArray(answers) ||
    !confirmations ||
    typeof confirmations !== "object" ||
    Array.isArray(confirmations)
  )
    throw new Error("HEALTH_INVALID_REQUEST");
  const boot = await rpc(actor, "bootstrap", {});
  if (boot.form?.version !== templateVersion) throw new Error("HEALTH_TEMPLATE_UNAVAILABLE");
  const questions = boot.form.wording.en.questions;
  const a = answers as Record<string, unknown>,
    c = confirmations as Record<string, unknown>;
  if (
    Object.keys(a).length !== questions.length ||
    questions.some((q) => a[q.id] !== "yes" && a[q.id] !== "no" && !(q.na && a[q.id] === "na")) ||
    Object.keys(c).length !== 5 ||
    ["truthful", "advice", "changes", "privacy", "signer"].some((k) => c[k] !== true)
  )
    throw new Error("HEALTH_INVALID_REQUEST");
  if (!boot.participants?.some((p) => p.id === participantId)) throw new Error("HEALTH_FORBIDDEN");
  const context = declarationContext(
    actor,
    participantId,
    templateVersion,
    String(locale),
    idempotencyKey,
  );
  const bytes = Buffer.from(JSON.stringify({ answers, confirmations }));
  let envelope;
  try {
    envelope = await encryptHealthBytes(bytes, context);
  } finally {
    bytes.fill(0);
  }
  const result = await rpc(actor, "submit", {
    participantId,
    templateVersion,
    locale,
    idempotencyKey,
    answers: { _encrypted: envelope },
    confirmations: {},
    answer: Object.values(a).includes("yes") ? "document" : "clear",
  });
  // Fresh random encryption is intentional. Concurrent/lost-response retries return the
  // existing row, then compare decrypted content, never a brute-forceable answer hash.
  const copy = await encryptedClinicalRequest(actor, "copy", { id: result.id });
  const saved = copy.declaration;
  if (
    !saved ||
    saved.participantId !== participantId ||
    saved.signerId !== actor ||
    saved.templateVersion !== templateVersion ||
    saved.locale !== locale ||
    questions.some((q) => saved.answers[q.id] !== a[q.id]) ||
    Object.keys(c).some((k) => saved.confirmations[k] !== c[k])
  )
    throw new Error("HEALTH_IDEMPOTENCY_CONFLICT");
  return result;
}
