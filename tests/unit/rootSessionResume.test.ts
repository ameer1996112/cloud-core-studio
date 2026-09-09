import { expect, mock, test } from "bun:test";
let checks = 0;
let release: (() => void) | undefined;
let authListener: (event: string, session: unknown) => void;
mock.module("../../src/integrations/supabase/auth-session", () => ({
  getFreshSupabaseSession: () => {
    checks++;
    return new Promise((resolve) => {
      release = () => resolve({ user: { id: "fixture" } });
    });
  },
}));
mock.module("../../src/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (listener: typeof authListener) => {
        authListener = listener;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  },
}));
mock.module("../../src/integrations/supabase/session-cookie", () => ({
  clearSupabaseAccessTokenCookie() {},
  syncSupabaseAccessTokenCookie() {},
}));
const { startRootSessionLifecycle } = await import("../../src/lib/root-session-lifecycle.client");
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("resume bursts refresh once, keep routes mounted, and still report role updates/sign-out", async () => {
  const oldWindow = globalThis.window,
    oldDocument = globalThis.document;
  const window = new EventTarget();
  const document = Object.assign(new EventTarget(), { visibilityState: "visible" });
  Object.assign(globalThis, { window, document });
  const resumed = mock(() => {}),
    changed = mock(() => {}),
    signedOut = mock(() => {});
  const stop = startRootSessionLifecycle({
    onSessionAvailable() {},
    onSessionResumed: resumed,
    onSessionChanged: changed,
    onSignedOut: signedOut,
    onError() {},
  });
  try {
    release!();
    await tick();
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("online"));
    expect(checks).toBe(2); // initial read plus one resume, not three concurrent refreshes
    release!();
    await tick();
    expect(resumed).toHaveBeenCalledTimes(1);
    expect(changed).not.toHaveBeenCalled();
    authListener!("TOKEN_REFRESHED", { user: { id: "fixture" } });
    expect(changed).not.toHaveBeenCalled();
    authListener!("USER_UPDATED", { user: { id: "fixture" } });
    expect(changed).toHaveBeenCalledTimes(1);
    authListener!("SIGNED_OUT", null);
    expect(signedOut).toHaveBeenCalledTimes(1);
    stop();
    window.dispatchEvent(new Event("focus"));
    expect(checks).toBe(2);
  } finally {
    stop();
    Object.assign(globalThis, { window: oldWindow, document: oldDocument });
  }
});
