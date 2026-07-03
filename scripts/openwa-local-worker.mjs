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

export function normalizePhone(value) {
  return value.replace(/[^\d+]/g, "");
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
  if (record.data && typeof record.data === "object" && typeof record.data.id === "string") {
    return record.data.id;
  }
  if (
    record.response &&
    typeof record.response === "object" &&
    typeof record.response.id === "string"
  ) {
    return record.response.id;
  }
  return null;
}

async function sendViaOpenwa(config, job) {
  const url = new URL(
    `/api/sessions/${config.openwaSessionId}/messages/send-text`,
    config.openwaBaseUrl,
  );
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.openwaApiKey,
    },
    body: JSON.stringify({
      phone: job.to,
      message: job.text,
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

  return {
    ok: true,
    providerMessageId: pickProviderMessageId(json),
  };
}

export function buildConfigFromEnv(env, options, token) {
  const testPhone = env.OPENWA_TEST_PHONE?.trim() || "";
  if (options.testPhoneOnly && !testPhone) {
    throw new Error("missing_env:OPENWA_TEST_PHONE");
  }

  return {
    cloudCoreBaseUrl: requireEnvFrom(env, "CLOUD_CORE_BASE_URL").replace(/\/+$/, ""),
    openwaBaseUrl: requireEnvFrom(env, "OPENWA_LOCAL_BASE_URL"),
    openwaApiKey: requireEnvFrom(env, "OPENWA_API_KEY"),
    openwaSessionId: requireEnvFrom(env, "OPENWA_SESSION_ID"),
    workerId: env.OPENWA_WORKER_ID?.trim() || "openwa-local-worker",
    token,
    testPhone: testPhone || null,
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const token = await readAutomationToken();
  const config = buildConfig(options, token);

  const claimPayload = {
    limit: options.limit,
    workerId: config.workerId,
    dryRun: options.dryRun,
    testPhone: options.testPhoneOnly ? config.testPhone : undefined,
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

  for (const job of jobs) {
    if (!job || typeof job !== "object") continue;

    const safeTo = typeof job.to === "string" ? job.to : "";
    const safeId = typeof job.id === "string" ? job.id : "";
    const safeTrigger = typeof job.triggerType === "string" ? job.triggerType : "unknown";

    if (!safeId || !safeTo) {
      console.error(`[openwa-local-worker] skipped malformed job trigger=${safeTrigger}`);
      continue;
    }

    if (options.dryRun) {
      console.log(
        `[openwa-local-worker] dry-run job=${safeId} trigger=${safeTrigger} to=${safeTo}`,
      );
      continue;
    }

    if (
      options.testPhoneOnly &&
      normalizePhone(safeTo) !== normalizePhone(config.testPhone ?? "")
    ) {
      console.error(
        `[openwa-local-worker] safety block job=${safeId} trigger=${safeTrigger} to=${safeTo}`,
      );
      await reportResult(config, {
        jobId: safeId,
        status: "failed",
        retryable: false,
        error: "openwa_test_phone_only_blocked",
      });
      continue;
    }

    const sendResult = await sendViaOpenwa(config, job);
    if (!sendResult.ok) {
      console.error(
        `[openwa-local-worker] send failed job=${safeId} trigger=${safeTrigger} retryable=${sendResult.retryable} error=${sendResult.error}`,
      );
      await reportResult(config, {
        jobId: safeId,
        status: "failed",
        retryable: sendResult.retryable,
        error: sendResult.error,
      });
      continue;
    }

    try {
      await reportResult(config, {
        jobId: safeId,
        status: "sent",
        providerMessageId: sendResult.providerMessageId,
      });
      console.log(
        `[openwa-local-worker] sent job=${safeId} trigger=${safeTrigger} providerMessageId=${sendResult.providerMessageId ?? "none"}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "report_failed";
      console.error(
        `[openwa-local-worker] HIGH_RISK sent_but_report_failed job=${safeId} trigger=${safeTrigger} error=${message}`,
      );
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "worker_failed";
    console.error(`[openwa-local-worker] fatal error=${message}`);
    process.exitCode = 1;
  });
}
