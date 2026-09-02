import { notificationDatabase } from "@/server/notifications/database-scope.server";
import type { DeliveryFailureClass, DeliveryStatus } from "@/lib/messaging.types";

type ProviderStatusInput = {
  provider: "official_whatsapp" | "resend";
  providerMessageId: string;
  incomingStatus:
    | Extract<
        DeliveryStatus,
        "accepted" | "sent" | "delivered" | "read" | "failed" | "dead_letter" | "suppressed"
      >
    | "delivery_delayed";
  providerStatus: string;
  occurredAt: string;
  errorMessage?: string | null;
  failureClass?: DeliveryFailureClass | null;
};

export async function applyProviderDeliveryStatus(input: ProviderStatusInput) {
  const db = notificationDatabase as any;
  const result = await db.rpc("apply_message_delivery_status", {
    p_provider: input.provider,
    p_provider_message_id: input.providerMessageId,
    p_incoming_status: input.incomingStatus,
    p_provider_status: input.providerStatus,
    p_occurred_at: input.occurredAt,
    p_error_message: input.errorMessage ?? null,
    p_failure_class: input.failureClass ?? null,
  });
  if (result.error) throw result.error;
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  return {
    matched: row?.matched === true,
    deliveryId: row?.delivery_id ?? null,
    status: (row?.resulting_status ?? null) as DeliveryStatus | null,
  };
}

export function resendCanonicalStatus(providerStatus: string) {
  if (providerStatus === "delivery_delayed") return "delivery_delayed" as const;
  if (providerStatus === "sent") return "sent" as const;
  if (["delivered", "opened", "clicked"].includes(providerStatus)) return "delivered" as const;
  if (["bounced", "failed"].includes(providerStatus)) return "dead_letter" as const;
  if (["complained", "suppressed"].includes(providerStatus)) return "suppressed" as const;
  return null;
}

function providerOccurredAt(value: unknown) {
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return new Date(Number(value) * 1_000).toISOString();
  }
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) return value;
  return new Date().toISOString();
}

export async function reconcilePendingProviderWebhookEvents(
  provider: string,
  providerMessageId: string,
) {
  if (provider !== "official_whatsapp" && provider !== "resend") return { processed: 0 };
  const db = notificationDatabase as any;
  const pending = await db
    .from("message_webhook_events")
    .select("id,event_type,payload")
    .eq("provider", provider === "official_whatsapp" ? "whatsapp" : "resend")
    .eq("provider_message_id", providerMessageId)
    .is("processed_at", null)
    .order("received_at", { ascending: true })
    .limit(100);
  if (pending.error) throw pending.error;
  let processed = 0;
  for (const event of pending.data ?? []) {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const providerStatus =
      provider === "official_whatsapp"
        ? String(payload.status ?? "")
        : String(event.event_type ?? "").replace(/^email\./, "");
    const incomingStatus =
      provider === "official_whatsapp"
        ? ["sent", "delivered", "read", "failed"].includes(providerStatus)
          ? providerStatus
          : null
        : resendCanonicalStatus(providerStatus);
    if (!incomingStatus) continue;
    const applied = await applyProviderDeliveryStatus({
      provider,
      providerMessageId,
      incomingStatus: incomingStatus as ProviderStatusInput["incomingStatus"],
      providerStatus,
      occurredAt: providerOccurredAt(payload.timestamp ?? payload.created_at),
      errorMessage: typeof payload.error === "string" ? payload.error : null,
      failureClass: ["failed", "dead_letter", "suppressed"].includes(incomingStatus)
        ? "permanent"
        : null,
    });
    if (!applied.matched) break;
    const marked = await db
      .from("message_webhook_events")
      .update({ processed_at: new Date().toISOString(), processing_error: null })
      .eq("id", event.id)
      .is("processed_at", null);
    if (marked.error) throw marked.error;
    processed += 1;
  }
  return { processed };
}

export async function reconcilePendingProviderWebhookLedger(limit = 200, signal?: AbortSignal) {
  const db = notificationDatabase as any;
  signal?.throwIfAborted();
  const pending = await db
    .from("message_webhook_events")
    .select("provider,provider_message_id")
    .is("processed_at", null)
    .not("provider_message_id", "is", null)
    .order("received_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 500)));
  if (pending.error) throw pending.error;
  signal?.throwIfAborted();
  const keys = new Set<string>();
  let processed = 0;
  for (const event of pending.data ?? []) {
    signal?.throwIfAborted();
    const provider = event.provider === "whatsapp" ? "official_whatsapp" : event.provider;
    const key = `${provider}:${event.provider_message_id}`;
    if (keys.has(key)) continue;
    keys.add(key);
    const result = await reconcilePendingProviderWebhookEvents(provider, event.provider_message_id);
    signal?.throwIfAborted();
    processed += result.processed;
  }
  return { processed };
}
