import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { conciergeEvaluationKey } from "../../src/lib/conciergeDispatch.server.ts";

const root = resolve(import.meta.dir, "../..");

describe("Concierge production runtime", () => {
  test("registers the authenticated orchestration and dispatch endpoints", async () => {
    const routeTree = await readFile(resolve(root, "src/routeTree.gen.ts"), "utf8");

    expect(routeTree).toContain("/api/internal/concierge/run");
    expect(routeTree).toContain("/api/internal/concierge/dispatch");
  });

  test("creates a new delivery attempt key after a postponed intent becomes eligible", () => {
    const common = {
      mode: "test_only",
      intentId: "intent-1",
      policyVersion: "concierge-2026-07-v1",
      evaluation: { selectedActionId: "intent-1", channels: ["in_app", "push"] },
    };

    expect(
      conciergeEvaluationKey({
        ...common,
        eligibleAt: "2026-07-26T10:00:00.000Z",
      }),
    ).not.toBe(
      conciergeEvaluationKey({
        ...common,
        eligibleAt: "2026-07-26T16:00:00.000Z",
      }),
    );
  });
});
