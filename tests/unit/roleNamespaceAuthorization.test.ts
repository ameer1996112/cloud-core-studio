import { describe, expect, test } from "bun:test";

import { loadAuthorizedRoleNamespace } from "../../src/lib/role-namespace";

describe("role namespace authorization ordering", () => {
  test("a wrong-role redirect wins without starting a rejected namespace import", async () => {
    const wrongRoleRedirect = new Error("redirect:/member");
    const rejectedChunk = new Error("admin locale chunk unavailable");
    let namespaceLoadCalls = 0;

    await expect(
      loadAuthorizedRoleNamespace(
        async () => {
          throw wrongRoleRedirect;
        },
        async () => {
          namespaceLoadCalls += 1;
          throw rejectedChunk;
        },
      ),
    ).rejects.toBe(wrongRoleRedirect);
    expect(namespaceLoadCalls).toBe(0);
  });

  test("an authorized route loads its namespace before returning context", async () => {
    const context = { role: "instructor" as const };
    const events: string[] = [];

    await expect(
      loadAuthorizedRoleNamespace(
        async () => {
          events.push("authorized");
          return context;
        },
        async () => {
          events.push("namespace-ready");
        },
      ),
    ).resolves.toBe(context);
    expect(events).toEqual(["authorized", "namespace-ready"]);
  });
});
