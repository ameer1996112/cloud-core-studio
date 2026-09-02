import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  requireLocalFixtureTarget,
  sanitizedPsqlEnvironment,
} from "../../scripts/qa/member-ui-ux-local-target.mjs";
import { snapshotPathForEnvPath } from "../../scripts/qa/member-ui-ux-fixture-lifecycle.mjs";

const RUNTIME_ENV = {
  APP_ENV: "test",
  ALLOW_MEMBER_UI_UX_FIXTURE: "true",
};

const LOCAL_ENV = {
  API_URL: "http://127.0.0.1:54321",
  DB_URL: "postgresql://postgres:local-password@127.0.0.1:54322/postgres",
  SERVICE_ROLE_KEY: "local-service-role-value",
};
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function expectSeedRejectedBeforeState(
  dbUrl,
  expectedError,
  valuesThatMustStayPrivate = [],
  runtimeOverrides = {},
) {
  const directory = mkdtempSync(join(tmpdir(), "member-ui-ux-target-guard-"));
  temporaryDirectories.push(directory);
  const envPath = join(directory, ".env.qa.local");
  const contents = [
    `API_URL=${LOCAL_ENV.API_URL}`,
    `SERVICE_ROLE_KEY=${LOCAL_ENV.SERVICE_ROLE_KEY}`,
    `DB_URL=${dbUrl}`,
    "",
  ].join("\n");
  writeFileSync(envPath, contents, "utf8");

  const result = spawnSync(process.execPath, ["scripts/qa/seed-member-ui-ux-fixture.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      APP_ENV: "test",
      ALLOW_MEMBER_UI_UX_FIXTURE: "true",
      ENV_PATH: envPath,
      ...runtimeOverrides,
    },
    encoding: "utf8",
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;

  expect(result.status).toBe(1);
  expect(output).toContain(expectedError);
  for (const value of valuesThatMustStayPrivate) expect(output).not.toContain(value);
  expect(readFileSync(envPath, "utf8")).toBe(contents);
  expect(existsSync(snapshotPathForEnvPath(envPath))).toBe(false);
}

describe("member UI/UX fixture local target guard", () => {
  test.each([
    ["IPv4", "http://127.0.0.1:54321", "postgresql://postgres:test@127.0.0.1:54322/postgres"],
    ["localhost", "http://localhost:54321", "postgresql://postgres:test@localhost:54322/postgres"],
    ["IPv6", "http://[::1]:54321", "postgresql://postgres:test@[::1]:54322/postgres"],
  ])("accepts loopback %s API and database targets", (_label, apiUrl, databaseUrl) => {
    expect(() =>
      requireLocalFixtureTarget(
        { ...LOCAL_ENV, API_URL: apiUrl, DB_URL: databaseUrl },
        RUNTIME_ENV,
        { requireDatabase: true },
      ),
    ).not.toThrow();
  });

  test("rejects a remote database even when the API target is local", () => {
    const remoteDatabase =
      "postgresql://fixture-user:do-not-print@example.supabase.co:5432/postgres";
    let message = "";
    try {
      requireLocalFixtureTarget({ ...LOCAL_ENV, DB_URL: remoteDatabase }, RUNTIME_ENV, {
        requireDatabase: true,
      });
    } catch (error) {
      message = error.message;
    }

    expect(message).toBe("fixture_refuses_non_local_database_target");
    expect(message).not.toContain("do-not-print");
    expect(message).not.toContain("example.supabase.co");
  });

  test("the seed rejects a remote database before writing any local fixture state", () => {
    const secret = "do-not-print-database-password";
    expectSeedRejectedBeforeState(
      `postgresql://fixture:${secret}@example.supabase.co:5432/postgres`,
      "fixture_refuses_non_local_database_target",
      [secret, "example.supabase.co"],
    );
  });

  test.each([
    ["hostaddr", "hostaddr=203.0.113.10", "203.0.113.10"],
    ["mixed-case host", "HoSt=remote.example.test", "remote.example.test"],
    ["service", "service=do-not-print-service", "do-not-print-service"],
    ["percent-encoded hostaddr", "%68ostaddr=198.51.100.9", "198.51.100.9"],
  ])("rejects the libpq %s authority override", (_label, query, privateValue) => {
    const dbUrl = `${LOCAL_ENV.DB_URL}?${query}`;
    let message = "";
    try {
      requireLocalFixtureTarget({ ...LOCAL_ENV, DB_URL: dbUrl }, RUNTIME_ENV, {
        requireDatabase: true,
      });
    } catch (error) {
      message = error.message;
    }

    expect(message).toBe("fixture_database_url_options_not_allowed");
    expect(message).not.toContain(privateValue);
  });

  test.each([
    ["hostaddr", "hostaddr=203.0.113.11", "203.0.113.11"],
    ["host", "host=remote.example.test", "remote.example.test"],
    ["service", "service=do-not-print-service", "do-not-print-service"],
    ["percent-encoded hostaddr", "%68ostaddr=198.51.100.10", "198.51.100.10"],
  ])(
    "the seed rejects local authority with libpq %s before writing state",
    (_label, query, privateValue) => {
      expectSeedRejectedBeforeState(
        `${LOCAL_ENV.DB_URL}?${query}`,
        "fixture_database_url_options_not_allowed",
        [privateValue],
      );
    },
  );

  test("rejects even otherwise benign database options to keep the allowlist explicit", () => {
    expect(() =>
      requireLocalFixtureTarget(
        { ...LOCAL_ENV, DB_URL: `${LOCAL_ENV.DB_URL}?sslmode=disable` },
        RUNTIME_ENV,
        { requireDatabase: true },
      ),
    ).toThrow("fixture_database_url_options_not_allowed");
  });

  test.each([
    ["PGHOSTADDR", "203.0.113.21"],
    ["PGHOST", "remote.example.test"],
    ["PGSERVICE", "do-not-print-service"],
    ["PGSERVICEFILE", "/tmp/do-not-print-service-file"],
  ])("rejects inherited %s without exposing its value", (name, privateValue) => {
    let message = "";
    try {
      requireLocalFixtureTarget(
        LOCAL_ENV,
        { ...RUNTIME_ENV, [name]: privateValue },
        { requireDatabase: true },
      );
    } catch (error) {
      message = error.message;
    }

    expect(message).toBe("fixture_libpq_environment_override_not_allowed");
    expect(message).not.toContain(privateValue);
  });

  test("the seed rejects inherited PGHOSTADDR before writing any fixture state", () => {
    const remoteHostAddress = "203.0.113.22";
    expectSeedRejectedBeforeState(
      LOCAL_ENV.DB_URL,
      "fixture_libpq_environment_override_not_allowed",
      [remoteHostAddress],
      { PGHOSTADDR: remoteHostAddress },
    );
  });

  test("the psql child environment removes every PG-prefixed variable", () => {
    expect(
      sanitizedPsqlEnvironment({
        PATH: "/usr/local/bin:/usr/bin",
        HOME: "/tmp/member-ui-home",
        APP_ENV: "test",
        PGHOSTADDR: "203.0.113.23",
        PGHOST: "remote.example.test",
        PGSERVICE: "remote-service",
        PGSERVICEFILE: "/tmp/remote-service.conf",
        PGSSLROOTCERT: "/tmp/remote-root.pem",
        PGFUTUREOVERRIDE: "future-value",
      }),
    ).toEqual({
      PATH: "/usr/local/bin:/usr/bin",
      HOME: "/tmp/member-ui-home",
      APP_ENV: "test",
    });
  });

  test("rejects missing and malformed database targets without leaking their values", () => {
    expect(() =>
      requireLocalFixtureTarget({ ...LOCAL_ENV, DB_URL: "" }, RUNTIME_ENV, {
        requireDatabase: true,
      }),
    ).toThrow("fixture_local_database_url_missing");

    const malformedDatabase = "not-a-database-url-with-secret";
    let message = "";
    try {
      requireLocalFixtureTarget({ ...LOCAL_ENV, DB_URL: malformedDatabase }, RUNTIME_ENV, {
        requireDatabase: true,
      });
    } catch (error) {
      message = error.message;
    }
    expect(message).toBe("fixture_local_database_url_invalid");
    expect(message).not.toContain(malformedDatabase);
  });

  test("keeps reset safe without requiring its unused database URL", () => {
    expect(() =>
      requireLocalFixtureTarget({ ...LOCAL_ENV, DB_URL: undefined }, RUNTIME_ENV),
    ).not.toThrow();
  });

  test("rejects malformed API targets without leaking the supplied URL", () => {
    const malformedApi = "not-an-api-url-with-secret";
    let message = "";
    try {
      requireLocalFixtureTarget({ ...LOCAL_ENV, API_URL: malformedApi }, RUNTIME_ENV);
    } catch (error) {
      message = error.message;
    }
    expect(message).toBe("fixture_local_api_url_invalid");
    expect(message).not.toContain(malformedApi);
  });
});
