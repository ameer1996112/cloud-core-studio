import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { healthErrorCode, type HealthResponse } from "./health-contract";

// Parse without throwing validator diagnostics containing submitted data.
export const healthRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    if (!input || typeof input !== "object") return null;
    const { action, payload } = input as { action?: unknown; payload?: unknown };
    if (
      typeof action !== "string" ||
      ![
        "bootstrap",
        "staff_status",
        "status",
        "submit",
        "copy",
        "change",
        "upload",
        "document",
        "queue",
        "review",
      ].includes(action)
    )
      return null;
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      JSON.stringify(payload).length > 4096
    )
      return null;
    const allowed = [
      "id",
      "kind",
      "participantId",
      "templateVersion",
      "locale",
      "answer",
      "consent",
      "idempotencyKey",
      "content",
      "mimeType",
      "decision",
    ];
    if (Object.keys(payload).some((key) => !allowed.includes(key))) return null;
    return { action, payload };
  })
  .handler(async ({ data, context }): Promise<HealthResponse> => {
    setResponseHeader("Cache-Control", "private, no-store, max-age=0");
    setResponseHeader("Pragma", "no-cache");
    const failure = (error: string): HealthResponse => ({ status: "error", error });
    if (!data) return failure("HEALTH_INVALID_REQUEST");
    // A separate local-process opt-in, independent of database flags and client JS.
    // Real collection is deliberately impossible in this implementation release.
    const url = process.env.SUPABASE_URL ?? "";
    let local = false;
    try {
      local = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
    } catch {
      /* closed */
    }
    if (
      process.env.HEALTH_DECLARATION_TEST_ONLY !== "true" ||
      !local ||
      process.env.NODE_ENV === "production"
    )
      return failure("HEALTH_UNAVAILABLE");
    try {
      // Generated database types predate the additive, unapplied migration.
      const { data: result, error } = await context.supabase.rpc(
        "health_declaration_api" as never,
        {
          p_action: data.action,
          p_payload: data.payload,
        } as never,
      );
      if (error) return failure(healthErrorCode(error.message) ?? "HEALTH_UNAVAILABLE");
      return result as unknown as HealthResponse;
    } catch {
      return failure("HEALTH_UNAVAILABLE");
    }
  });
