import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { addSecurityHeaders, SECURITY_HEADERS } from "../../scripts/security-headers.mjs";

const dockerfile = readFileSync(resolve(import.meta.dir, "../../Dockerfile"), "utf8");

describe("production security headers", () => {
  test("adds the browser hardening policy without discarding application headers", () => {
    const headers = addSecurityHeaders({
      "content-type": "text/html; charset=utf-8",
      "set-cookie": ["session=abc; HttpOnly; Secure"],
    });

    expect(headers["content-type"]).toBe("text/html; charset=utf-8");
    expect(headers["set-cookie"]).toEqual(["session=abc; HttpOnly; Secure"]);
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
    expect(headers["strict-transport-security"]).toBe(
      "max-age=31536000; includeSubDomains; preload",
    );
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
  });

  test("does not allow callers to weaken the shared policy", () => {
    const headers = addSecurityHeaders({
      "content-security-policy": "default-src *",
      "x-content-type-options": "off",
    });

    expect(headers["content-security-policy"]).toBe(SECURITY_HEADERS["content-security-policy"]);
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });

  test("copies the shared header module into the production image", () => {
    expect(dockerfile).toContain(
      "COPY --from=build /app/scripts/security-headers.mjs ./scripts/security-headers.mjs",
    );
  });
});
