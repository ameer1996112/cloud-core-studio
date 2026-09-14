import { expect, test } from "bun:test";
import { healthRuntimeEnabled } from "../../src/lib/health-runtime.server";

test("a stale production health flag cannot activate the recovered workflow", () => {
  const old = process.env.HEALTH_DECLARATION_REAL_ENABLED;
  const release = process.env.HEALTH_DECLARATION_RESTORED_RELEASE_ENABLED;
  try {
    process.env.HEALTH_DECLARATION_REAL_ENABLED = "true";
    delete process.env.HEALTH_DECLARATION_RESTORED_RELEASE_ENABLED;
    expect(healthRuntimeEnabled()).toBe(false);
    process.env.HEALTH_DECLARATION_RESTORED_RELEASE_ENABLED = "true";
    expect(healthRuntimeEnabled()).toBe(true);
  } finally {
    if (old === undefined) delete process.env.HEALTH_DECLARATION_REAL_ENABLED;
    else process.env.HEALTH_DECLARATION_REAL_ENABLED = old;
    if (release === undefined) delete process.env.HEALTH_DECLARATION_RESTORED_RELEASE_ENABLED;
    else process.env.HEALTH_DECLARATION_RESTORED_RELEASE_ENABLED = release;
  }
});
