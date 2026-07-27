import { describe, expect, test } from "bun:test";

import { createPersistentAuthStorage } from "../../src/integrations/supabase/auth-storage";

function createAsyncStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    async getItem(key: string) {
      return values.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      values.set(key, value);
    },
    async removeItem(key: string) {
      values.delete(key);
    },
  };
}

function createBrowserStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

describe("persistent native auth storage", () => {
  test("migrates an existing WebView session into native storage", async () => {
    const native = createAsyncStorage();
    const legacy = createBrowserStorage({ session: "existing-session" });
    const storage = createPersistentAuthStorage(native, legacy);

    expect(await storage.getItem("session")).toBe("existing-session");
    expect(native.values.get("session")).toBe("existing-session");
  });

  test("prefers the native session and keeps both stores synchronized", async () => {
    const native = createAsyncStorage({ session: "native-session" });
    const legacy = createBrowserStorage({ session: "old-session" });
    const storage = createPersistentAuthStorage(native, legacy);

    expect(await storage.getItem("session")).toBe("native-session");

    await storage.setItem("session", "refreshed-session");
    expect(native.values.get("session")).toBe("refreshed-session");
    expect(legacy.values.get("session")).toBe("refreshed-session");

    await storage.removeItem("session");
    expect(native.values.has("session")).toBe(false);
    expect(legacy.values.has("session")).toBe(false);
  });
});
