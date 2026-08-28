import "@tanstack/react-start/server-only";

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
  subtitle?: string;
  body: string;
  url?: string;
  sound?: boolean | string;
  badge?: number;
  notificationId?: string;
  campaignId?: string;
  category?: string;
  threadId?: string;
  interruptionLevel?: "passive" | "active" | "time-sensitive";
  relevanceScore?: number;
  mutableContent?: boolean;
  imageUrl?: string;
  actions?: string[];
  collapseId?: string;
  expiresAt?: Date;
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

export function configuredApnsEnvironment() {
  return process.env.APNS_ENV === "sandbox" ? "sandbox" : "production";
}

export function buildApnsAlertBody(payload: ApnsAlertPayload) {
  const sound =
    payload.sound === false
      ? undefined
      : typeof payload.sound === "string"
        ? payload.sound
        : "default";
  const relevanceScore =
    payload.relevanceScore == null ? undefined : Math.min(1, Math.max(0, payload.relevanceScore));

  return {
    aps: {
      alert: {
        title: payload.title,
        ...(payload.subtitle ? { subtitle: payload.subtitle } : {}),
        body: payload.body,
      },
      ...(sound == null ? {} : { sound }),
      ...(payload.badge == null ? {} : { badge: Math.max(0, Math.trunc(payload.badge)) }),
      ...(payload.category ? { category: payload.category } : {}),
      ...(payload.threadId ? { "thread-id": payload.threadId } : {}),
      ...(payload.interruptionLevel ? { "interruption-level": payload.interruptionLevel } : {}),
      ...(relevanceScore == null ? {} : { "relevance-score": relevanceScore }),
      ...(payload.mutableContent ? { "mutable-content": 1 } : {}),
    },
    ...(payload.url ? { url: payload.url } : {}),
    ...(payload.notificationId ? { notificationId: payload.notificationId } : {}),
    ...(payload.campaignId ? { campaignId: payload.campaignId } : {}),
    ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
    ...(payload.actions?.length ? { actions: payload.actions } : {}),
  };
}

export function buildApnsRequestHeaders(input: {
  bundleId: string;
  authorization: string;
  deviceToken: string;
  payload: ApnsAlertPayload;
}) {
  const expiration = input.payload.expiresAt
    ? Math.max(0, Math.floor(input.payload.expiresAt.getTime() / 1000)).toString()
    : undefined;
  const collapseId = input.payload.collapseId?.trim().slice(0, 64);

  return {
    ":method": "POST",
    ":path": `/3/device/${input.deviceToken}`,
    authorization: input.authorization,
    "apns-topic": input.bundleId,
    "apns-push-type": "alert",
    "apns-priority": input.payload.interruptionLevel === "passive" ? "5" : "10",
    "content-type": "application/json",
    ...(collapseId ? { "apns-collapse-id": collapseId } : {}),
    ...(expiration ? { "apns-expiration": expiration } : {}),
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
    let settled = false;
    const finish = (
      result:
        | { ok: true; apnsId: string | null }
        | { ok: false; error: string; apnsId: string | null },
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      client.close();
      resolve(result);
    };
    const timeout = setTimeout(() => {
      client.destroy();
      finish({ ok: false, error: "APNs request timed out", apnsId: null });
    }, 15_000);
    client.on("error", (error) => {
      finish({ ok: false, error: error.message, apnsId: null });
    });

    const request = client.request(
      buildApnsRequestHeaders({
        bundleId: config.bundleId,
        authorization: `bearer ${buildJwt(config)}`,
        deviceToken,
        payload,
      }),
    );

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
      if (status >= 200 && status < 300) {
        finish({ ok: true, apnsId });
        return;
      }
      finish({
        ok: false,
        error: responseBody
          ? `APNs returned HTTP ${status}: ${responseBody}`
          : `APNs returned HTTP ${status}`,
        apnsId,
      });
    });
    request.on("error", (error) => {
      finish({ ok: false, error: error.message, apnsId });
    });
    request.end(body);
  });
}
