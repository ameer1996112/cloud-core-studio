import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(
  new URL("../../scripts/create-whatsapp-templates.mjs", import.meta.url),
);
const isolatedEnvironment = {
  PATH: Bun.env.PATH ?? "",
  META_GRAPH_API_VERSION: "",
  META_ACCESS_TOKEN: "",
  META_WABA_ID: "",
  META_TEMPLATE_IMAGE_HEADER_HANDLE: "",
  SUPABASE_URL: "",
  VITE_SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
};

async function runScript(args, env = {}, stdinText) {
  const child = Bun.spawnSync({
    cmd: ["bun", scriptPath, ...args],
    cwd: import.meta.dir,
    env: { ...isolatedEnvironment, ...env },
    stdin: stdinText === undefined ? "ignore" : Buffer.from(stdinText),
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    stdout: child.stdout?.toString() ?? "",
    stderr: child.stderr?.toString() ?? "",
    exitCode: child.exitCode,
  };
}

describe("WhatsApp template provisioner script", () => {
  test("concierge plan falls back to local-only without credentials and reports prerequisites", async () => {
    const result = await runScript(["--plan", "--scope", "concierge"], {
      META_TEMPLATE_IMAGE_HEADER_HANDLE: "4::sentinel-should-not-appear",
    });

    expect(result.exitCode).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report).toMatchObject({
      mode: "plan",
      remoteLookup: {
        status: "local_only",
        reason: "credentials_unavailable",
        remoteCount: 0,
      },
      deploymentSync: { synced: false, reason: "plan_only" },
      headerHandleConfigured: true,
    });
    expect(report.headerHandlePrerequisites).toHaveLength(report.plan.length);
    expect(
      report.plan.every(
        (template) =>
          template.name.endsWith("_branded_v2") || template.name.endsWith("_premium_v3"),
      ),
    ).toBe(true);
    expect(report.plan.some((template) => template.name.endsWith("_premium_v3"))).toBe(true);
    expect(`${result.stdout}${result.stderr}`).not.toContain("4::sentinel-should-not-appear");
  });

  test("refresh is separate from plan and requires runtime provider configuration", async () => {
    const result = await runScript(
      ["--refresh", "--waba-id", "1009561255148806", "--scope", "concierge"],
      {},
    );

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "missing_environment:META_GRAPH_API_VERSION",
    );
    expect(`${result.stdout}${result.stderr}`).not.toContain("apply_requires_header_handle");
  });

  test("apply fails on the missing uploaded header handle before any provider configuration is read", async () => {
    const result = await runScript([
      "--apply",
      "--waba-id",
      "1009561255148806",
      "--scope",
      "concierge",
    ]);

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("apply_requires_header_handle");
  });

  test("apply redacts a supplied header handle from its public error output", async () => {
    const sentinelHandle = "4::sentinel-should-not-appear";
    const result = await runScript(
      ["--apply", "--waba-id", "1009561255148806", "--scope", "concierge"],
      { META_TEMPLATE_IMAGE_HEADER_HANDLE: sentinelHandle },
    );

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "missing_environment:META_GRAPH_API_VERSION",
    );
    expect(`${result.stdout}${result.stderr}`).not.toContain(sentinelHandle);
  });

  test("apply accepts a private media handle through explicit stdin without exposing it", async () => {
    const sentinelHandle = "4::stdin-sentinel-should-not-appear";
    const result = await runScript(
      ["--apply", "--waba-id", "1009561255148806", "--scope", "concierge", "--header-handle-stdin"],
      {},
      `${sentinelHandle}\n`,
    );

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "missing_environment:META_GRAPH_API_VERSION",
    );
    expect(`${result.stdout}${result.stderr}`).not.toContain("apply_requires_header_handle");
    expect(`${result.stdout}${result.stderr}`).not.toContain(sentinelHandle);
  });

  test("rejects private Meta media handles supplied in process arguments", async () => {
    const sentinelHandle = "4::sentinel-should-not-appear";
    const result = await runScript([
      "--plan",
      "--scope",
      "concierge",
      "--header-handle",
      sentinelHandle,
    ]);

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("private_media_handle_argv_forbidden");
    expect(`${result.stdout}${result.stderr}`).not.toContain(sentinelHandle);
  });

  test("rejects equals-form media handle arguments without echoing their value", async () => {
    const sentinelHandle = "4::equals-sentinel-should-not-appear";
    const result = await runScript([
      "--plan",
      "--scope",
      "concierge",
      `--header-handle=${sentinelHandle}`,
    ]);

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("private_media_handle_argv_forbidden");
    expect(`${result.stdout}${result.stderr}`).not.toContain(sentinelHandle);
  });
});
