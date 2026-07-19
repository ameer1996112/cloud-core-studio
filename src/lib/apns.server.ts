import { createSign } from "node:crypto";
import http2 from "node:http2";

type ApnsConfig = {
  keyId: string;
  teamId: string;
  bundleId: string;
  privateKey: string;
  environment: "sandbox" | "production";
};

export type ApnsAlertPayload = {
  title: string;
  body: string;
  url?: string;
  sound?: boolean;
  badge?: number;
  notificationId?: string;
};

type CachedJwt = {
  key: string;
  token: string;
  expiresAt: number;
};

let cachedJwt: CachedJwt | null = null;

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function readAsn1Length(signature: Buffer, offset: number) {
  const first = signature[offset];
  if (first == null) throw new Error("Invalid APNs signature");
  if (first < 0x80) return { length: first, nextOffset: offset + 1 };

  const bytes = first & 0x7f;
  if (bytes <= 0 || bytes > 2) throw new Error("Invalid APNs signature length");
  let length = 0;
  for (let index = 0; index < bytes; index += 1) {
    const value = signature[offset + 1 + index];
    if (value == null) throw new Error("Invalid APNs signature length");
    length = (length << 8) | value;
  }
  return { length, nextOffset: offset + 1 + bytes };
}

function normalizeInteger(value: Buffer) {
  let normalized = value;
  while (normalized.length > 32 && normalized[0] === 0) {
    normalized = normalized.subarray(1);
  }
  if (normalized.length > 32) throw new Error("Invalid APNs signature integer");
  if (normalized.length === 32) return normalized;
  return Buffer.concat([Buffer.alloc(32 - normalized.length), normalized]);
}

function derToJose(signature: Buffer) {
  if (signature[0] !== 0x30) throw new Error("Invalid APNs signature sequence");
  let offset = readAsn1Length(signature, 1).nextOffset;

  if (signature[offset] !== 0x02) throw new Error("Invalid APNs signature r marker");
  const rLength = readAsn1Length(signature, offset + 1);
  offset = rLength.nextOffset;
  const r = signature.subarray(offset, offset + rLength.length);
  offset += rLength.length;

  if (signature[offset] !== 0x02) throw new Error("Invalid APNs signature s marker");
  const sLength = readAsn1Length(signature, offset + 1);
  offset = sLength.nextOffset;
  const s = signature.subarray(offset, offset + sLength.length);

  return Buffer.concat([normalizeInteger(r), normalizeInteger(s)]);
}

function apnsConfig(): ApnsConfig | null {
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const bundleId = process.env.APNS_BUNDLE_ID?.trim() || "com.cloudandcore.studio";
  const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const environment = process.env.APNS_ENV === "sandbox" ? "sandbox" : "production";

  if (!keyId || !teamId || !privateKey) return null;
  return { keyId, teamId, bundleId, privateKey, environment };
}

function buildJwt(config: ApnsConfig) {
  const cacheKey = `${config.keyId}:${config.teamId}:${config.environment}`;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (cachedJwt?.key === cacheKey && cachedJwt.expiresAt > nowSeconds + 60) {
    return cachedJwt.token;
  }

  const header = base64Url(JSON.stringify({ alg: "ES256", kid: config.keyId }));
  const payload = base64Url(JSON.stringify({ iss: config.teamId, iat: nowSeconds }));
  const signingInput = `${header}.${payload}`;
  const signer = createSign("SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = base64Url(derToJose(signer.sign(config.privateKey)));
  const token = `${signingInput}.${signature}`;

  cachedJwt = {
    key: cacheKey,
    token,
    expiresAt: nowSeconds + 45 * 60,
  };

  return token;
}

export function isApnsConfigured() {
  return Boolean(apnsConfig());
}

export function buildApnsAlertBody(payload: ApnsAlertPayload) {
  return {
    aps: {
      alert: {
        title: payload.title,
        body: payload.body,
      },
      ...(payload.sound === false ? {} : { sound: "default" }),
      ...(payload.badge == null ? {} : { badge: Math.max(0, Math.trunc(payload.badge)) }),
    },
    ...(payload.url ? { url: payload.url } : {}),
    ...(payload.notificationId ? { notificationId: payload.notificationId } : {}),
  };
}

export async function sendApnsAlert(deviceToken: string, payload: ApnsAlertPayload) {
  const config = apnsConfig();
  if (!config) return { ok: false as const, skipped: "missing_apns_config" };

  const host =
    config.environment === "sandbox"
      ? "https://api.sandbox.push.apple.com"
      : "https://api.push.apple.com";
  const body = JSON.stringify(buildApnsAlertBody(payload));

  return await new Promise<
    { ok: true; apnsId: string | null } | { ok: false; error: string; apnsId: string | null }
  >((resolve) => {
    const client = http2.connect(host);
    client.on("error", (error) => {
      resolve({ ok: false, error: error.message, apnsId: null });
    });

    const request = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${buildJwt(config)}`,
      "apns-topic": config.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });

    let status = 0;
    let apnsId: string | null = null;
    let responseBody = "";
    request.setEncoding("utf8");
    request.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
      apnsId = typeof headers["apns-id"] === "string" ? headers["apns-id"] : null;
    });
    request.on("data", (chunk) => {
      responseBody += chunk;
    });
    request.on("end", () => {
      client.close();
      if (status >= 200 && status < 300) {
        resolve({ ok: true, apnsId });
        return;
      }
      resolve({ ok: false, error: responseBody || `APNs returned HTTP ${status}`, apnsId });
    });
    request.on("error", (error) => {
      client.close();
      resolve({ ok: false, error: error.message, apnsId });
    });
    request.end(body);
  });
}
