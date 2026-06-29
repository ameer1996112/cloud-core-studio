import fs from "node:fs";

const root = new URL("..", import.meta.url);
const envPath = new URL(".env", root);
const apiKeyPath = new URL(".openwa/OpenWA/data/.api-key", root);
const outPath = "/tmp/cloud-core-openwa-qr.png";

const env = fs.readFileSync(envPath, "utf8");
const apiKey = fs.readFileSync(apiKeyPath, "utf8").trim();
const baseUrl = env.match(/^OPENWA_BASE_URL="?([^"\n]+)"?/m)?.[1] ?? "http://localhost:2785";
const sessionId = env.match(/^OPENWA_SESSION_ID="?([^"\n]+)"?/m)?.[1];

if (!sessionId) {
  throw new Error("OPENWA_SESSION_ID is missing. Run bun run openwa:start first.");
}

const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/sessions/${sessionId}/qr`, {
  headers: { "X-API-Key": apiKey },
});
const text = await response.text();

if (!response.ok) {
  throw new Error(`OpenWA QR request failed (${response.status}): ${text}`);
}

const body = JSON.parse(text);
const qr = String(body.qrCode ?? body.qr ?? body.data ?? body.image ?? "");
const base64 = qr.replace(/^data:image\/png;base64,/, "");

if (!base64) {
  throw new Error("OpenWA did not return a QR image. The session may already be connected.");
}

fs.writeFileSync(outPath, Buffer.from(base64, "base64"));
console.log(outPath);
