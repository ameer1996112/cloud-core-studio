import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { HealthOnboarding } from "./health-onboarding";

export const healthOnboardingRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    if (!input || typeof input !== "object") return null;
    const { action, payload = {} } = input as { action?: unknown; payload?: unknown };
    if (
      typeof action !== "string" ||
      ![
        "status",
        "birth_date",
        "acknowledge_notice",
        "invite",
        "claim",
        "guardian_queue",
        "verify",
        "revoke",
      ].includes(action)
    )
      return null;
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      JSON.stringify(payload).length > 512
    )
      return null;
    if (
      Object.keys(payload).some(
        (key) => !["birthDate", "token", "relationship", "id", "confirmed"].includes(key),
      )
    )
      return null;
    return { action, payload };
  })
  .handler(async ({ data, context }): Promise<HealthOnboarding> => {
    setResponseHeader("Cache-Control", "private, no-store, max-age=0");
    setResponseHeader("Referrer-Policy", "no-referrer");
    if (!data) return { error: "HEALTH_INVALID_REQUEST" };
    const { healthRuntimeEnabled } = await import("./health-runtime.server");
    if (!healthRuntimeEnabled()) return { enabled: false, collectionEnabled: false };
    try {
      const { data: result, error } = await context.supabase.rpc(
        "health_onboarding_api" as never,
        { p_action: data.action, p_payload: data.payload } as never,
      );
      return error ? { error: "HEALTH_UNAVAILABLE" } : (result as unknown as HealthOnboarding);
    } catch {
      return { error: "HEALTH_UNAVAILABLE" };
    }
  });
