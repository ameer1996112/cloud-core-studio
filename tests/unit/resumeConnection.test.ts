import { afterEach, expect, test, mock } from "bun:test";
import { withDeadline } from "../../src/lib/async-deadline";
import { authFetch } from "../../src/integrations/supabase/auth-fetch";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("a suspended operation releases the UI wait and permits a later retry", async () => {
  await expect(withDeadline(new Promise(() => {}), 10)).rejects.toThrow("Connection timed out");
  expect(await withDeadline(Promise.resolve("reconnected"), 10)).toBe("reconnected");
});

test("a late failed operation remains handled after its UI deadline", async () => {
  let reject!: (error: Error) => void;
  const operation = new Promise((_, fail) => {
    reject = fail;
  });
  await expect(withDeadline(operation, 5)).rejects.toThrow("Connection timed out");
  reject(new Error("connection closed later"));
  await new Promise((resolve) => setTimeout(resolve, 5));
});

test("booking and payment transport is passed through unchanged", async () => {
  const response = new Response("ok");
  const fetch = mock(async () => response);
  globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
  const init = { method: "POST", body: "synthetic-only" };
  expect(await authFetch("https://fixture.invalid/rest/v1/bookings", init)).toBe(response);
  expect(fetch).toHaveBeenCalledWith("https://fixture.invalid/rest/v1/bookings", init);
});

test("auth transport preserves caller cancellation", async () => {
  const controller = new AbortController();
  let received!: AbortSignal;
  globalThis.fetch = mock(async (_input: unknown, init?: RequestInit) => {
    received = init!.signal!;
    return new Promise<Response>((_resolve, reject) => {
      received.addEventListener("abort", () => reject(new Error("aborted")));
    });
  }) as unknown as typeof globalThis.fetch;
  const request = authFetch("https://fixture.invalid/auth/v1/token", { signal: controller.signal });
  controller.abort();
  await expect(request).rejects.toThrow("aborted");
  expect(received.aborted).toBe(true);
});
