import { describe, expect, test } from "bun:test";
import {
  buildOpenwaChatId,
  buildConfigFromEnv,
  normalizePhone,
  parseArgs,
} from "../../scripts/openwa-local-worker.mjs";

const baseEnv = {
  CLOUD_CORE_BASE_URL: "https://cloud-core.example.com/",
  OPENWA_LOCAL_BASE_URL: "http://localhost:2785",
  OPENWA_API_KEY: "openwa-key",
  OPENWA_SESSION_ID: "session-123",
  OPENWA_WORKER_ID: "studio-mac",
  OPENWA_TEST_PHONE: "+972 50-123-4567",
};

describe("openwa local worker config", () => {
  test("parseArgs supports dry run, lifecycle sweep, test phone, and capped limit", () => {
    expect(
      parseArgs(["--dry-run", "--lifecycle-sweep", "--test-phone-only", "--limit=99"]),
    ).toEqual({
      dryRun: true,
      testPhoneOnly: true,
      lifecycleSweep: true,
      limit: 10,
    });
  });

  test("parseArgs rejects unknown flags", () => {
    expect(() => parseArgs(["--bad-flag"])).toThrow("unknown_flag:--bad-flag");
  });

  test("buildConfigFromEnv keeps OpenWA session config on the worker side", () => {
    const options = parseArgs(["--test-phone-only", "--limit=2"]);
    expect(buildConfigFromEnv(baseEnv, options, "secret-token")).toEqual({
      cloudCoreBaseUrl: "https://cloud-core.example.com",
      openwaBaseUrl: "http://localhost:2785",
      openwaApiKey: "openwa-key",
      openwaSessionId: "session-123",
      openwaSessionName: null,
      workerId: "studio-mac",
      token: "secret-token",
      testPhone: "+972 50-123-4567",
      openwaSendVerifyDelayMs: 8000,
      openwaRequireDeliveryConfirmation: false,
      openwaUnconfirmedRetryable: false,
      openwaClaimNotBefore: null,
      options,
    });
  });

  test("buildConfigFromEnv requires test phone when test-phone-only is enabled", () => {
    const options = parseArgs(["--test-phone-only"]);
    const env = { ...baseEnv, OPENWA_TEST_PHONE: "" };
    expect(() => buildConfigFromEnv(env, options, "secret-token")).toThrow(
      "missing_env:OPENWA_TEST_PHONE",
    );
  });

  test("buildConfigFromEnv accepts the local OpenWA session name without a session id", () => {
    const options = parseArgs([]);
    const env = { ...baseEnv, OPENWA_SESSION_ID: "", OPENWA_SESSION_NAME: "notifications-bot" };
    expect(buildConfigFromEnv(env, options, "secret-token")).toMatchObject({
      openwaSessionId: null,
      openwaSessionName: "notifications-bot",
    });
  });

  test("buildConfigFromEnv requires a local OpenWA session id or session name", () => {
    const options = parseArgs([]);
    const env = { ...baseEnv, OPENWA_SESSION_ID: "", OPENWA_SESSION_NAME: "" };
    expect(() => buildConfigFromEnv(env, options, "secret-token")).toThrow(
      "missing_env:OPENWA_SESSION_ID_OR_OPENWA_SESSION_NAME",
    );
  });

  test("normalizePhone removes punctuation but preserves leading plus", () => {
    expect(normalizePhone("+972 50-123-4567")).toBe("+972501234567");
  });

  test("buildOpenwaChatId converts local Israeli phone numbers to OpenWA chat ids", () => {
    expect(buildOpenwaChatId("0546464437")).toBe("972546464437@c.us");
    expect(buildOpenwaChatId("+972 54-646-4437")).toBe("972546464437@c.us");
  });
});
