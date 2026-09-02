const baseUrl = process.env.CLOUD_CORE_BASE_URL?.trim().replace(/\/+$/, "");
const token = process.env.NOTIFICATION_AUTOMATION_TOKEN?.trim();
const canary = process.env.NOTIFICATION_SWEEP_CANARY?.trim().toLowerCase() === "true";
const limit = Math.max(
  1,
  Math.min(100, Math.trunc(Number(process.env.NOTIFICATION_SWEEP_LIMIT ?? 50) || 50)),
);

if (!baseUrl) throw new Error("missing_env:CLOUD_CORE_BASE_URL");
if (!token) throw new Error("missing_env:NOTIFICATION_AUTOMATION_TOKEN");

async function invoke(path, payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(4 * 60_000),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`notification_sweep_failed:${path}:${response.status}`);
  }
  return JSON.parse(body);
}

const results = canary
  ? {
      canonicalReadiness: await invoke("/api/internal/messages/sweep", { limit, canary: true }),
    }
  : {
      conciergeOrchestration: await invoke("/api/internal/concierge/run", { limit }),
      conciergeDispatch: await invoke("/api/internal/concierge/dispatch", { limit }),
      canonicalDelivery: await invoke("/api/internal/messages/sweep", { limit }),
    };

if (
  !canary &&
  process.env.LEGACY_MEMBER_NOTIFICATION_DELIVERY_ENABLED?.trim().toLowerCase() === "true"
) {
  results.legacyLifecycle = await invoke("/api/internal/notifications/lifecycle-sweep", {
    limitPerEvent: limit,
  });
}

console.log(JSON.stringify(results));
