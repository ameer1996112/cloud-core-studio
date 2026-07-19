const baseUrl = process.env.CLOUD_CORE_BASE_URL?.trim().replace(/\/+$/, "");
const token = process.env.NOTIFICATION_AUTOMATION_TOKEN?.trim();
const limit = Math.max(
  1,
  Math.min(100, Math.trunc(Number(process.env.NOTIFICATION_SWEEP_LIMIT ?? 50) || 50)),
);

if (!baseUrl) throw new Error("missing_env:CLOUD_CORE_BASE_URL");
if (!token) throw new Error("missing_env:NOTIFICATION_AUTOMATION_TOKEN");

const response = await fetch(`${baseUrl}/api/internal/notifications/lifecycle-sweep`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({ limitPerEvent: limit }),
  signal: AbortSignal.timeout(4 * 60_000),
});

const body = await response.text();
if (!response.ok) {
  throw new Error(`notification_sweep_failed:${response.status}:${body.slice(0, 500)}`);
}

console.log(body);
