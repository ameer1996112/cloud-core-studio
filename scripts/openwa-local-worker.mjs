#!/usr/bin/env node

import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_KEYCHAIN_SERVICE = "cloud-core-openwa-automation-token";
const DEFAULT_LIMIT = 5;

export function parseArgs(argv) {
  const options = {
    dryRun: false,
    testPhoneOnly: false,
    lifecycleSweep: false,
    limit: DEFAULT_LIMIT,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--test-phone-only") {
      options.testPhoneOnly = true;
      continue;
    }
    if (arg === "--lifecycle-sweep") {
      options.lifecycleSweep = true;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const raw = Number(arg.slice("--limit=".length));
      if (!Number.isFinite(raw)) {
        throw new Error("invalid_limit_flag");
      }
      options.limit = Math.max(1, Math.min(10, Math.trunc(raw)));
      continue;
    }
    throw new Error(`unknown_flag:${arg}`);
  }

  return options;
}

function requireEnvFrom(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`missing_env:${name}`);
  return value;
}

function getErrorMessage(error, fallback = "unknown_error") {
  return error instanceof Error && error.message ? error.message : fallback;
}

function sanitizeErrorCode(value, fallback = "unknown_error") {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

export function normalizePhone(value) {
  return value.replace(/[^\d+]/g, "");
}

export function buildOpenwaChatId(value) {
  const normalized = normalizePhone(String(value ?? ""));
  if (!normalized) return "";

  let digits = normalized.startsWith("+") ? normalized.slice(1) : normalized;
  if (digits.startsWith("0")) {
    digits = `972${digits.slice(1)}`;
  }

  return digits ? `${digits}@c.us` : "";
}

async function readAutomationToken() {
  const direct = process.env.OPENWA_AUTOMATION_TOKEN?.trim();
  if (direct) return direct;

  const service = process.env.OPENWA_AUTOMATION_TOKEN_SERVICE?.trim() || DEFAULT_KEYCHAIN_SERVICE;
  try {
    const { stdout } = await execFileAsync("security", [
      "find-generic-password",
      "-s",
      service,
      "-w",
    ]);
    const token = stdout.trim();
    if (!token) throw new Error("empty_keychain_secret");
    return token;
  } catch (error) {
    const message = error instanceof Error ? error.message : "keychain_read_failed";
    throw new Error(`missing_openwa_automation_token:${message}`);
  }
}

async function postJson(url, token, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let json = null;
  if (text.trim()) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    const reason =
      (json && typeof json === "object" && "reason" in json && typeof json.reason === "string"
        ? json.reason
        : null) ?? `http_${response.status}`;
    throw new Error(`request_failed:${reason}`);
  }

  return json;
}

function isRetryableOpenwaStatus(status) {
  return (
    status === 408 ||
    status === 409 ||
    status === 423 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}

function pickProviderMessageId(payload) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload;
  const directId = typeof record.id === "string" ? record.id : null;
  if (directId) return directId;
  if (typeof record.messageId === "string") return record.messageId;
  if (record.data && typeof record.data === "object" && typeof record.data.id === "string") {
    return record.data.id;
  }
  if (record.data && typeof record.data === "object" && typeof record.data.messageId === "string") {
    return record.data.messageId;
  }
  if (
    record.response &&
    typeof record.response === "object" &&
    typeof record.response.id === "string"
  ) {
    return record.response.id;
  }
  if (
    record.response &&
    typeof record.response === "object" &&
    typeof record.response.messageId === "string"
  ) {
    return record.response.messageId;
  }
  return null;
}

function sleep(ms) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeOpenwaMessageStatus(value) {
  const status = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!status) return null;
  return status;
}

function isConfirmedOpenwaDeliveryStatus(status) {
  return status === "delivered" || status === "read" || status === "played";
}

function normalizeOpenwaSessionStatus(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function isReadyOpenwaSessionStatus(value) {
  const status = normalizeOpenwaSessionStatus(value);
  return status === "ready" || status === "connected";
}

function pickUsableOpenwaChatId(value, fallbackChatId) {
  if (typeof value !== "string" || !value.trim()) return fallbackChatId;
  const chatId = value.trim();
  return chatId.endsWith("@lid") ? fallbackChatId : chatId;
}

function pickSessionIdFromRecord(record) {
  if (!record || typeof record !== "object") return null;
  if (typeof record.id === "string" && record.id.trim()) return record.id.trim();
  if (typeof record.sessionId === "string" && record.sessionId.trim()) {
    return record.sessionId.trim();
  }
  return null;
}

function pickSessionNameFromRecord(record) {
  if (!record || typeof record !== "object") return null;
  if (typeof record.name === "string" && record.name.trim()) return record.name.trim();
  if (typeof record.sessionName === "string" && record.sessionName.trim()) {
    return record.sessionName.trim();
  }
  return null;
}

function pickSessionsList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.sessions)) return payload.sessions;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function readOpenwaJson(response) {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function resolveOpenwaSessionId(config, fetchImpl = fetch) {
  const sessionName = config.openwaSessionName?.trim();
  if (!sessionName) {
    return config.openwaSessionId
      ? { ok: true, sessionId: config.openwaSessionId }
      : { ok: false, retryable: true, error: "openwa_session_not_configured" };
  }

  const url = new URL("/api/sessions", config.openwaBaseUrl);
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      "x-api-key": config.openwaApiKey,
    },
  });

  if (!response.ok) {
    return {
      ok: false,
      retryable: true,
      error: `openwa_sessions_http_${response.status}`,
    };
  }

  const sessions = pickSessionsList(await readOpenwaJson(response));
  const namedSessions = sessions.filter(
    (session) => pickSessionNameFromRecord(session) === sessionName,
  );
  const readySession = namedSessions.find((session) => isReadyOpenwaSessionStatus(session?.status));
  const sessionId = pickSessionIdFromRecord(readySession);
  if (sessionId) {
    return { ok: true, sessionId };
  }

  return {
    ok: false,
    retryable: true,
    error: "openwa_session_not_ready",
  };
}

async function fetchOpenwaMessageStatus(config, chatId, messageId, fetchImpl) {
  if (!messageId) return null;
  const url = new URL(`/api/sessions/${config.openwaSessionId}/messages`, config.openwaBaseUrl);
  url.searchParams.set("chatId", chatId);
  url.searchParams.set("limit", "25");

  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      "x-api-key": config.openwaApiKey,
    },
  });

  if (!response.ok) return null;
  const text = await response.text();
  if (!text.trim()) return null;

  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }

  const messages = Array.isArray(json?.messages) ? json.messages : Array.isArray(json) ? json : [];
  const match = messages.find(
    (message) => message?.waMessageId === messageId || message?.id === messageId,
  );
  return normalizeOpenwaMessageStatus(match?.status);
}

async function resolveOpenwaChatId(config, phone, fetchImpl) {
  const fallbackChatId = buildOpenwaChatId(phone);
  const number = fallbackChatId.split("@")[0];
  if (!number) {
    return { ok: false, retryable: false, error: "invalid_whatsapp_phone" };
  }

  const url = new URL(
    `/api/sessions/${config.openwaSessionId}/contacts/check/${number}`,
    config.openwaBaseUrl,
  );

  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      "x-api-key": config.openwaApiKey,
    },
  });

  if (!response.ok) {
    return { ok: true, chatId: fallbackChatId };
  }

  const text = await response.text();
  let json = null;
  if (text.trim()) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (json?.exists === false) {
    return { ok: false, retryable: false, error: "whatsapp_number_not_found" };
  }

  return {
    ok: true,
    chatId: pickUsableOpenwaChatId(json?.whatsappId, fallbackChatId),
  };
}

export async function sendViaOpenwa(config, job, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sessionResult = await resolveOpenwaSessionId(config, fetchImpl);
  if (!sessionResult.ok) return sessionResult;

  const sessionConfig = {
    ...config,
    openwaSessionId: sessionResult.sessionId,
  };
  const url = new URL(
    `/api/sessions/${sessionConfig.openwaSessionId}/messages/send-text`,
    sessionConfig.openwaBaseUrl,
  );
  const chatIdResult = await resolveOpenwaChatId(sessionConfig, job.to, fetchImpl);
  if (!chatIdResult.ok) return chatIdResult;
  const chatId = chatIdResult.chatId;

  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.openwaApiKey,
    },
    body: JSON.stringify({
      chatId,
      text: job.text,
    }),
  });

  const text = await response.text();
  let json = null;
  if (text.trim()) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    const rawError =
      (json && typeof json === "object" && "error" in json && typeof json.error === "string"
        ? json.error
        : null) ??
      (json && typeof json === "object" && "message" in json && typeof json.message === "string"
        ? json.message
        : null) ??
      `openwa_http_${response.status}`;

    const normalizedError = String(rawError).toLowerCase();
    const retryable =
      isRetryableOpenwaStatus(response.status) ||
      normalizedError.includes("disconnected") ||
      normalizedError.includes("session") ||
      normalizedError.includes("timeout") ||
      normalizedError.includes("network");

    return {
      ok: false,
      retryable,
      error: normalizedError.replace(/\s+/g, "_"),
    };
  }

  const providerMessageId = pickProviderMessageId(json);
  const verifyDelayMs = Number(config.openwaSendVerifyDelayMs ?? 0);
  if (providerMessageId && Number.isFinite(verifyDelayMs) && verifyDelayMs > 0) {
    await sleep(verifyDelayMs);
    const status = await fetchOpenwaMessageStatus(
      sessionConfig,
      chatId,
      providerMessageId,
      fetchImpl,
    );
    if (status === "failed") {
      return {
        ok: false,
        retryable: true,
        error: "openwa_delivery_failed",
        providerMessageId,
      };
    }
    if (config.openwaRequireDeliveryConfirmation && !isConfirmedOpenwaDeliveryStatus(status)) {
      return {
        ok: false,
        retryable: Boolean(config.openwaUnconfirmedRetryable),
        error: "openwa_delivery_unconfirmed",
        providerMessageId,
      };
    }
  }

  return {
    ok: true,
    providerMessageId,
  };
}

export function buildConfigFromEnv(env, options, token) {
  const testPhone = env.OPENWA_TEST_PHONE?.trim() || "";
  if (options.testPhoneOnly && !testPhone) {
    throw new Error("missing_env:OPENWA_TEST_PHONE");
  }
  const openwaSessionId = env.OPENWA_SESSION_ID?.trim() || "";
  const openwaSessionName = env.OPENWA_SESSION_NAME?.trim() || "";
  if (!openwaSessionId && !openwaSessionName) {
    throw new Error("missing_env:OPENWA_SESSION_ID_OR_OPENWA_SESSION_NAME");
  }

  return {
    cloudCoreBaseUrl: requireEnvFrom(env, "CLOUD_CORE_BASE_URL").replace(/\/+$/, ""),
    openwaBaseUrl: requireEnvFrom(env, "OPENWA_LOCAL_BASE_URL"),
    openwaApiKey: requireEnvFrom(env, "OPENWA_API_KEY"),
    openwaSessionId: openwaSessionId || null,
    openwaSessionName: openwaSessionName || null,
    workerId: env.OPENWA_WORKER_ID?.trim() || "openwa-local-worker",
    token,
    testPhone: testPhone || null,
    openwaSendVerifyDelayMs: Math.max(
      0,
      Math.min(30_000, Number(env.OPENWA_SEND_VERIFY_DELAY_MS ?? 8_000) || 0),
    ),
    openwaRequireDeliveryConfirmation: env.OPENWA_REQUIRE_DELIVERY_CONFIRMATION === "1",
    openwaUnconfirmedRetryable: env.OPENWA_UNCONFIRMED_RETRYABLE === "1",
    openwaClaimNotBefore: env.OPENWA_CLAIM_NOT_BEFORE?.trim() || null,
    options,
  };
}

function buildConfig(options, token) {
  return buildConfigFromEnv(process.env, options, token);
}

async function reportResult(config, body) {
  return postJson(
    `${config.cloudCoreBaseUrl}/api/internal/notifications/openwa-report`,
    config.token,
    {
      ...body,
      workerId: config.workerId,
    },
  );
}

async function runLifecycleSweep(config) {
  return postJson(
    `${config.cloudCoreBaseUrl}/api/internal/notifications/lifecycle-sweep`,
    config.token,
    {
      limitPerEvent: config.options.limit,
      dryRun: config.options.dryRun,
    },
  );
}

async function safeReportResult(config, body, context, job, deps) {
  try {
    await deps.reportResult(config, body);
    return true;
  } catch (error) {
    const message = getErrorMessage(error, "report_failed");
    deps.logError(
      `[openwa-local-worker] HIGH_RISK report_failed job=${job.id} trigger=${job.triggerType} context=${context} error=${message}`,
    );
    return false;
  }
}

export async function processClaimedJobs(config, jobs, deps = {}) {
  const runtimeDeps = {
    sendViaOpenwa,
    reportResult,
    logInfo: console.log,
    logError: console.error,
    ...deps,
  };

  for (const job of jobs) {
    if (!job || typeof job !== "object") continue;

    const safeTo = typeof job.to === "string" ? job.to : "";
    const safeId = typeof job.id === "string" ? job.id : "";
    const safeTrigger = typeof job.triggerType === "string" ? job.triggerType : "unknown";

    if (!safeId || !safeTo) {
      runtimeDeps.logError(`[openwa-local-worker] skipped malformed job trigger=${safeTrigger}`);
      continue;
    }

    if (config.options.dryRun) {
      runtimeDeps.logInfo(
        `[openwa-local-worker] dry-run job=${safeId} trigger=${safeTrigger} to=${safeTo}`,
      );
      continue;
    }

    if (
      config.options.testPhoneOnly &&
      normalizePhone(safeTo) !== normalizePhone(config.testPhone ?? "")
    ) {
      runtimeDeps.logError(
        `[openwa-local-worker] safety block job=${safeId} trigger=${safeTrigger} to=${safeTo}`,
      );
      await safeReportResult(
        config,
        {
          jobId: safeId,
          status: "failed",
          retryable: false,
          error: "openwa_test_phone_only_blocked",
        },
        "safety_block",
        { id: safeId, triggerType: safeTrigger },
        runtimeDeps,
      );
      continue;
    }

    let sendResult;
    try {
      sendResult = await runtimeDeps.sendViaOpenwa(config, job);
    } catch (error) {
      const message = getErrorMessage(error, "send_transport_failed");
      const errorCode = sanitizeErrorCode(message, "send_transport_failed");
      runtimeDeps.logError(
        `[openwa-local-worker] send transport failed job=${safeId} trigger=${safeTrigger} error=${message}`,
      );
      await safeReportResult(
        config,
        {
          jobId: safeId,
          status: "failed",
          retryable: true,
          error: `send_transport_failed:${errorCode}`,
        },
        "send_transport_failure",
        { id: safeId, triggerType: safeTrigger },
        runtimeDeps,
      );
      continue;
    }

    if (!sendResult?.ok) {
      runtimeDeps.logError(
        `[openwa-local-worker] send failed job=${safeId} trigger=${safeTrigger} retryable=${sendResult.retryable} error=${sendResult.error}`,
      );
      await safeReportResult(
        config,
        {
          jobId: safeId,
          status: "failed",
          retryable: sendResult.retryable,
          error: sendResult.error,
          providerMessageId: sendResult.providerMessageId,
        },
        "send_failed",
        { id: safeId, triggerType: safeTrigger },
        runtimeDeps,
      );
      continue;
    }

    const reportedSent = await safeReportResult(
      config,
      {
        jobId: safeId,
        status: "sent",
        providerMessageId: sendResult.providerMessageId,
      },
      "sent",
      { id: safeId, triggerType: safeTrigger },
      runtimeDeps,
    );
    if (reportedSent) {
      runtimeDeps.logInfo(
        `[openwa-local-worker] sent job=${safeId} trigger=${safeTrigger} providerMessageId=${sendResult.providerMessageId ?? "none"}`,
      );
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const token = await readAutomationToken();
  const config = buildConfig(options, token);

  if (options.lifecycleSweep && !options.testPhoneOnly) {
    const sweepResult = await runLifecycleSweep(config);
    console.log(
      `[openwa-local-worker] lifecycle-sweep inserted=${sweepResult?.inserted ?? 0} dryRun=${options.dryRun}`,
    );
  }

  const claimPayload = {
    limit: options.limit,
    workerId: config.workerId,
    dryRun: options.dryRun,
    testPhone: options.testPhoneOnly ? config.testPhone : undefined,
    claimNotBefore: config.openwaClaimNotBefore || undefined,
  };

  const claimResult = await postJson(
    `${config.cloudCoreBaseUrl}/api/internal/notifications/openwa-claim`,
    config.token,
    claimPayload,
  );

  const jobs = Array.isArray(claimResult?.jobs) ? claimResult.jobs : [];
  if (!jobs.length) {
    console.log(`[openwa-local-worker] no jobs worker=${config.workerId} dryRun=${options.dryRun}`);
    return;
  }

  console.log(
    `[openwa-local-worker] claimed=${jobs.length} worker=${config.workerId} dryRun=${options.dryRun}`,
  );

  await processClaimedJobs(config, jobs);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "worker_failed";
    console.error(`[openwa-local-worker] fatal error=${message}`);
    process.exitCode = 1;
  });
}
