import { expect, test } from "bun:test";
import { getOpenwaRuntimeConfig, isReachableOpenwaBaseUrl } from "../../src/lib/openwa.server.ts";

test("getOpenwaRuntimeConfig rejects missing runtime env", () => {
  expect(() =>
    getOpenwaRuntimeConfig({
      OPENWA_BASE_URL: "",
      OPENWA_API_KEY: "",
      OPENWA_SESSION_ID: "",
    }),
  ).toThrow("missing_openwa_runtime_config");
});

test("isReachableOpenwaBaseUrl rejects local endpoints and accepts remote http urls", () => {
  expect(isReachableOpenwaBaseUrl("http://localhost:2785")).toBe(false);
  expect(isReachableOpenwaBaseUrl("http://127.0.0.1:2785")).toBe(false);
  expect(isReachableOpenwaBaseUrl("http://0.0.0.0:2785")).toBe(false);
  expect(isReachableOpenwaBaseUrl("https://openwa.example.com")).toBe(true);
});
