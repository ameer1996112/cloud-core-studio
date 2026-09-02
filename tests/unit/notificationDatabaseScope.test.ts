import { expect, test } from "bun:test";
import { createAbortableDatabaseScope } from "../../src/server/notifications/database-scope.server";

test("binds every notification query and RPC to its request's abort signal", async () => {
  const observed: AbortSignal[] = [];
  const query = () => ({
    abortSignal(signal: AbortSignal) {
      observed.push(signal);
      return this;
    },
  });
  const scope = createAbortableDatabaseScope({
    from: () => ({ select: query, update: query }),
    rpc: query,
  });
  const first = new AbortController();
  const second = new AbortController();
  await Promise.all([
    scope.run(first.signal, async () => {
      scope.database.from().select();
      await Promise.resolve();
      scope.database.rpc();
    }),
    scope.run(second.signal, async () => {
      scope.database.from().update();
    }),
  ]);
  expect(observed).toEqual([first.signal, second.signal, first.signal]);
});

test("does not start another database request once the budget is exhausted", async () => {
  let called = false;
  const scope = createAbortableDatabaseScope({
    rpc() {
      called = true;
      return {};
    },
  });
  const controller = new AbortController();
  controller.abort(new Error("budget_exhausted"));
  await expect(scope.run(controller.signal, async () => scope.database.rpc())).rejects.toThrow(
    "budget_exhausted",
  );
  expect(called).toBe(false);
});
