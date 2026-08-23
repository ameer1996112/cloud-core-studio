import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const source = readFileSync(resolve(root, "src/routes/__root.tsx"), "utf8");

describe("app marketing shell language", () => {
  test("reads the request URL before the saved cookie only for /app", () => {
    expect(source).toContain('url.pathname === "/app"');
    expect(source).toContain('url.searchParams.get("lang")');
    expect(source).toContain("readSupportedLang");
  });

  test("does not modify authentication or navigation behavior", () => {
    expect(source).not.toContain("requireAuthenticatedRoute");
    expect(source).not.toContain('redirect({ to: "/auth"');
  });
});
