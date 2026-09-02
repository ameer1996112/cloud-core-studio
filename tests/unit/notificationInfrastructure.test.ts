import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

test("infrastructure preview disables both minimum-instance levels without removing rollback tags", () => {
  const result = spawnSync("bash", ["scripts/gcp/configure-notification-infrastructure.sh"], {
    encoding: "utf8",
    env: { PATH: process.env.PATH },
  });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("DRY RUN");
  expect(result.stdout).toContain("--min=0");
  expect(result.stdout).toContain("--min-instances=0");
  expect(result.stdout).toContain("--max=3");
  expect(result.stdout).not.toContain("--remove-tags");
});
