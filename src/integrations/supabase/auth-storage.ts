import { Capacitor } from "@capacitor/core";

type StorageBackend = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function createNativePreferencesBackend(): StorageBackend {
  return {
    async getItem(key) {
      const { Preferences } = await import("@capacitor/preferences");
      const { value } = await Preferences.get({ key });
      return value;
    },
    async setItem(key, value) {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.set({ key, value });
    },
    async removeItem(key) {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.remove({ key });
    },
  };
}

export function createPersistentAuthStorage(
  backend: StorageBackend,
  legacyStorage?: BrowserStorage,
): StorageBackend {
  return {
    async getItem(key) {
      const storedValue = await backend.getItem(key);
      if (storedValue !== null) return storedValue;

      const legacyValue = legacyStorage?.getItem(key) ?? null;
      if (legacyValue !== null) {
        await backend.setItem(key, legacyValue);
      }
      return legacyValue;
    },
    async setItem(key, value) {
      await backend.setItem(key, value);
      legacyStorage?.setItem(key, value);
    },
    async removeItem(key) {
      await backend.removeItem(key);
      legacyStorage?.removeItem(key);
    },
  };
}

export function getSupabaseAuthStorage() {
  if (typeof window === "undefined") return undefined;
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("Preferences")) {
    return window.localStorage;
  }

  return createPersistentAuthStorage(createNativePreferencesBackend(), window.localStorage);
}
