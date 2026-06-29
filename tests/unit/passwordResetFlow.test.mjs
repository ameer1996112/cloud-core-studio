import { strict as assert } from "node:assert";
import {
  getCanonicalResetUrl,
  getPasswordResetRedirectUrl,
  getResetPasswordValidationError,
  validatePasswordResetRecovery,
} from "../../src/lib/password-reset-flow.ts";

function makeAuth(overrides = {}) {
  const calls = [];
  return {
    calls,
    async getSession() {
      calls.push(["getSession"]);
      return { data: { session: { access_token: "normal-session" } }, error: null };
    },
    async exchangeCodeForSession(code) {
      calls.push(["exchangeCodeForSession", code]);
      return overrides.exchangeCodeForSession
        ? overrides.exchangeCodeForSession(code)
        : { data: { session: { access_token: "recovery-session" } }, error: null };
    },
    async verifyOtp(payload) {
      calls.push(["verifyOtp", payload]);
      return overrides.verifyOtp
        ? overrides.verifyOtp(payload)
        : { data: { session: { access_token: "recovery-session" } }, error: null };
    },
    async setSession(payload) {
      calls.push(["setSession", payload]);
      return overrides.setSession
        ? overrides.setSession(payload)
        : { data: { session: { access_token: "recovery-session" } }, error: null };
    },
  };
}

{
  const auth = makeAuth();
  const result = await validatePasswordResetRecovery({
    auth,
    href: "https://cloudandcorestudio.com/reset-password",
  });

  assert.equal(result.status, "invalid");
  assert.equal(
    auth.calls.some(([name]) => name === "getSession"),
    false,
  );
}

{
  const auth = makeAuth();
  const result = await validatePasswordResetRecovery({
    auth,
    href: "https://cloudandcorestudio.com/reset-password?type=recovery",
  });

  assert.equal(result.status, "invalid");
  assert.deepEqual(auth.calls, []);
}

{
  const auth = makeAuth({
    async exchangeCodeForSession() {
      return { data: { session: null }, error: new Error("invalid token") };
    },
  });
  const result = await validatePasswordResetRecovery({
    auth,
    href: "https://cloudandcorestudio.com/reset-password?code=bad-code",
  });

  assert.equal(result.status, "invalid");
  assert.deepEqual(auth.calls, [["exchangeCodeForSession", "bad-code"]]);
}

{
  const auth = makeAuth();
  const result = await validatePasswordResetRecovery({
    auth,
    href: "https://cloudandcorestudio.com/reset-password?code=valid-code",
  });

  assert.equal(result.status, "ready");
  assert.deepEqual(auth.calls, [["exchangeCodeForSession", "valid-code"]]);
}

{
  const auth = makeAuth();
  const result = await validatePasswordResetRecovery({
    auth,
    href: "https://cloudandcorestudio.com/reset-password?token_hash=abc123&type=recovery",
  });

  assert.equal(result.status, "ready");
  assert.deepEqual(auth.calls, [["verifyOtp", { type: "recovery", token_hash: "abc123" }]]);
}

{
  const auth = makeAuth();
  const result = await validatePasswordResetRecovery({
    auth,
    href: "https://cloudandcorestudio.com/reset-password#access_token=access&refresh_token=refresh&type=recovery",
  });

  assert.equal(result.status, "ready");
  assert.deepEqual(auth.calls, [
    ["setSession", { access_token: "access", refresh_token: "refresh" }],
  ]);
}

assert.equal(getResetPasswordValidationError("short", "short"), "reset.tooShort");
assert.equal(getResetPasswordValidationError("StrongPass1!", "Different1!"), "reset.mismatch");
assert.equal(getResetPasswordValidationError("StrongPass1!", "StrongPass1!"), null);
assert.equal(
  getPasswordResetRedirectUrl("https://cloudandcorestudio.com"),
  "https://cloudandcorestudio.com/reset-password",
);
assert.equal(
  getCanonicalResetUrl(
    "https://cloudandcorestudio.com/auth/reset?code=abc&type=recovery#access_token=token&refresh_token=refresh",
  ),
  "https://cloudandcorestudio.com/reset-password?code=abc&type=recovery#access_token=token&refresh_token=refresh",
);

console.log("password reset flow guards OK");
