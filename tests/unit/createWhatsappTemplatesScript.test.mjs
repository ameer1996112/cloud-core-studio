import { describe, expect, test } from "bun:test";

const root = new URL("../..", import.meta.url).pathname;

async function runScript(args) {
  const process = Bun.spawn(["bun", "scripts/create-whatsapp-templates.mjs", ...args], {
    cwd: root,
    env: { PATH: Bun.env.PATH ?? "" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  return { stdout, stderr, exitCode };
}

describe("WhatsApp template provisioner script", () => {
  test("concierge plan is local-only and reports header handle prerequisites", async () => {
    const result = await runScript(["--plan", "--scope", "concierge"]);

    expect(result.exitCode).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report).toMatchObject({
      mode: "plan",
      remoteLookup: false,
      deploymentSync: { synced: false, reason: "plan_only" },
      headerHandleConfigured: false,
    });
    expect(report.headerHandlePrerequisites).toHaveLength(report.plan.length);
    expect(report.plan.every((template) => template.name.endsWith("_branded_v2"))).toBe(true);
  });

  test("refresh is separate from plan and requires runtime provider configuration", async () => {
    const result = await runScript([
      "--refresh",
      "--waba-id",
      "1009561255148806",
      "--scope",
      "concierge",
      "--header-handle",
      "4::operator-uploaded-handle",
    ]);

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "missing_environment:META_GRAPH_API_VERSION",
    );
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
});
