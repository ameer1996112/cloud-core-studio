import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { healthErrorCode } from "./health-contract";
import type { ClinicalResponse } from "./health-clinical-contract";
import { HEALTH_DOCUMENT_BUCKET, HEALTH_DOCUMENT_MAX_BYTES } from "./health-real-form";
import { healthDocumentMime } from "./health-document";

function privateResponse() {
  setResponseHeader("Cache-Control", "private, no-store, max-age=0");
  setResponseHeader("Referrer-Policy", "no-referrer");
  setResponseHeader("X-Content-Type-Options", "nosniff");
}
const failure = (): ClinicalResponse => ({ error: "HEALTH_UNAVAILABLE" });

export const healthClinicalRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    if (!input || typeof input !== "object") return null;
    const { action, payload = {} } = input as { action?: unknown; payload?: unknown };
    if (
      typeof action !== "string" ||
      ![
        "bootstrap",
        "status",
        "submit",
        "copy",
        "change",
        "queue",
        "review",
        "retention_queue",
        "retention_hold",
        "retention_date",
      ].includes(action)
    )
      return null;
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      JSON.stringify(payload).length > 8192
    )
      return null;
    if (
      Object.keys(payload).some(
        (k) =>
          ![
            "id",
            "participantId",
            "templateVersion",
            "locale",
            "answers",
            "confirmations",
            "idempotencyKey",
            "decision",
            "confirmed",
            "signedOn",
            "reason",
            "cursor",
          ].includes(k),
      )
    )
      return null;
    return { action, payload };
  })
  .handler(async ({ data, context }): Promise<ClinicalResponse> => {
    privateResponse();
    const { healthRuntimeEnabled } = await import("./health-runtime.server");
    if (!data || !healthRuntimeEnabled()) return failure();
    try {
      const { data: auth, error: authError } = await context.supabase.auth.getUser();
      if (authError || auth.user?.id !== context.userId) return failure();
      const { encryptedClinicalRequest } = await import("./health-clinical-encrypted.server");
      return await encryptedClinicalRequest(
        context.userId,
        data.action,
        data.payload as Record<string, unknown>,
      );
    } catch (error) {
      return {
        error:
          healthErrorCode(error instanceof Error ? error.message : null) ?? "HEALTH_UNAVAILABLE",
      };
    }
  });

export const uploadHealthDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    if (!(input instanceof FormData)) return null;
    const id = input.get("id"),
      file = input.get("file");
    if (
      typeof id !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(id) ||
      !(file instanceof File) ||
      file.size < 1 ||
      file.size > HEALTH_DOCUMENT_MAX_BYTES
    )
      return null;
    return { id, file };
  })
  .handler(async ({ data, context }): Promise<ClinicalResponse> => {
    privateResponse();
    const { healthRuntimeEnabled } = await import("./health-runtime.server");
    if (!data || !healthRuntimeEnabled()) return failure();
    try {
      const { data: auth, error: authError } = await context.supabase.auth.getUser();
      if (authError || auth.user?.id !== context.userId) return failure();
      const bytes = new Uint8Array(await data.file.arrayBuffer());
      const mime = healthDocumentMime(bytes);
      if (!mime || data.file.type !== mime) return { error: "HEALTH_INVALID_DOCUMENT" };
      const { createHash } = await import("node:crypto");

      const { data: reservation, error } = await (
        await import("./health-clinical.server")
      ).clinicalServerClient.rpc(
        "health_clinical_server_api" as never,
        {
          p_actor: context.userId,
          p_action: "reserve_document",
          p_payload: { id: data.id },
        } as never,
      );
      const reserved = reservation as unknown as {
        documentId?: string;
        storagePath?: string;
        error?: string;
      };
      if (error || reserved?.error || !reserved?.documentId || !reserved?.storagePath)
        return failure();
      // Privileged storage is used only after the user-scoped RPC supplies a server-generated path.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const bucket = supabaseAdmin.storage.from(HEALTH_DOCUMENT_BUCKET);
      const { encryptHealthBytes, decryptHealthBytes, documentContext } =
        await import("./health-encryption.server");
      const encryptionContext = documentContext(
        data.id,
        reserved.documentId,
        context.userId,
        reserved.storagePath,
      );
      let stored = Buffer.from(
        JSON.stringify(await encryptHealthBytes(Buffer.from(bytes), encryptionContext)),
      );
      const { error: uploadError } = await bucket.upload(reserved.storagePath, stored, {
        contentType: "application/octet-stream",
        upsert: false,
        cacheControl: "0",
      });
      if (uploadError) {
        // Recover a lost successful upload response without overwriting an immutable document.
        const { data: existing, error: readError } = await bucket.download(reserved.storagePath);
        if (readError || !existing || existing.size > 8 * 1024 * 1024) return failure();
        const existingStored = Buffer.from(await existing.arrayBuffer());
        const original = await decryptHealthBytes(
          JSON.parse(existingStored.toString("utf8")),
          encryptionContext,
        );
        try {
          if (!original.equals(Buffer.from(bytes))) return failure();
          stored = existingStored;
        } finally {
          original.fill(0);
        }
      }
      const hash = createHash("sha256").update(stored).digest("hex");

      const { data: result, error: finishError } = await supabaseAdmin.rpc(
        "health_finish_document" as never,
        {
          p_id: reserved.documentId,
          p_actor: context.userId,
          p_hash: hash,
          p_size: stored.length,
          p_mime: mime,
        } as never,
      );
      return finishError ? failure() : (result as unknown as ClinicalResponse);
    } catch {
      return failure();
    }
  });

export const readHealthDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const id = (input as { id?: unknown } | null)?.id;
    return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
  })
  .handler(async ({ data, context }): Promise<ClinicalResponse> => {
    privateResponse();
    const { healthRuntimeEnabled } = await import("./health-runtime.server");
    if (!data || !healthRuntimeEnabled()) return failure();
    try {
      const { data: auth, error: authError } = await context.supabase.auth.getUser();
      if (authError || auth.user?.id !== context.userId) return failure();
      const { data: access, error } = await (
        await import("./health-clinical.server")
      ).clinicalServerClient.rpc(
        "health_clinical_server_api" as never,
        { p_actor: context.userId, p_action: "document_access", p_payload: { id: data } } as never,
      );
      const allowed = access as unknown as {
        storagePath?: string;
        mimeType?: string;
        sha256?: string;
        documentId?: string;
        uploadedBy?: string;
      };
      if (
        error ||
        !allowed?.storagePath ||
        !allowed.mimeType ||
        !allowed.sha256 ||
        !allowed.documentId ||
        !allowed.uploadedBy
      )
        return failure();
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: file, error: fileError } = await supabaseAdmin.storage
        .from(HEALTH_DOCUMENT_BUCKET)
        .download(allowed.storagePath);
      if (fileError || !file || file.size > 8 * 1024 * 1024) return failure();
      const stored = Buffer.from(await file.arrayBuffer());
      const { createHash } = await import("node:crypto");
      if (createHash("sha256").update(stored).digest("hex") !== allowed.sha256) return failure();
      const { decryptHealthBytes, documentContext } = await import("./health-encryption.server");
      const bytes = await decryptHealthBytes(
        JSON.parse(stored.toString("utf8")),
        documentContext(data, allowed.documentId, allowed.uploadedBy, allowed.storagePath),
      );
      if (
        bytes.length > HEALTH_DOCUMENT_MAX_BYTES ||
        healthDocumentMime(bytes) !== allowed.mimeType
      ) {
        bytes.fill(0);
        return failure();
      }
      // Recheck authorization after I/O, then audit the read. Never issue a reusable signed URL.
      const { data: recheck, error: recheckError } = await (
        await import("./health-clinical.server")
      ).clinicalServerClient.rpc(
        "health_clinical_server_api" as never,
        { p_actor: context.userId, p_action: "document_read", p_payload: { id: data } } as never,
      );
      try {
        if (recheckError || (recheck as unknown as { error?: string })?.error) return failure();
        return { base64: bytes.toString("base64"), mimeType: allowed.mimeType };
      } finally {
        bytes.fill(0);
      }
    } catch {
      return failure();
    }
  });

export const downloadHealthReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const id = (input as { id?: unknown } | null)?.id;
    return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
  })
  .handler(async ({ data, context }): Promise<ClinicalResponse> => {
    privateResponse();
    const { healthRuntimeEnabled } = await import("./health-runtime.server");
    if (!data || !healthRuntimeEnabled()) return failure();
    try {
      const authenticated = async () => {
        const { data: auth, error } = await context.supabase.auth.getUser();
        return !error && auth.user?.id === context.userId;
      };
      if (!(await authenticated())) return failure();
      const { encryptedClinicalRequest } = await import("./health-clinical-encrypted.server");
      const copy = async () => {
        const response = await encryptedClinicalRequest(context.userId, "copy", { id: data });
        if (response.declaration?.id !== data) throw new Error("unavailable");
        return response.declaration;
      };
      const receipt = await copy();
      const { renderHealthReceipt } = await import("./health-receipt.server");
      const pdf = await renderHealthReceipt(receipt);
      // Rendering takes time: recheck session, runtime and the current guardian relationship.
      if (!healthRuntimeEnabled() || !(await authenticated())) return failure();
      await copy();
      return { base64: pdf.toString("base64"), mimeType: "application/pdf" };
    } catch {
      return failure();
    }
  });
