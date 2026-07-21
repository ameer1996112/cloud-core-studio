import { describe, expect, test } from "bun:test";
import {
  clientApnsEnvironment,
  getOrCreateMemberPushInstallationId,
  memberPushRegistrationMetadata,
} from "../../src/lib/memberPushDevice.ts";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe("member push device identity", () => {
  test("requires the native build to declare its real APNs environment", () => {
    expect(clientApnsEnvironment("sandbox")).toBe("sandbox");
    expect(clientApnsEnvironment("production")).toBe("production");
    expect(() => clientApnsEnvironment(undefined)).toThrow("invalid_client_apns_environment");
  });

  test("keeps one anonymous installation id across token rotations", () => {
    const storage = memoryStorage();
    const generated = "11111111-1111-4111-8111-111111111111";
    const first = getOrCreateMemberPushInstallationId(storage, () => generated);
    const second = getOrCreateMemberPushInstallationId(storage, () => {
      throw new Error("should not regenerate");
    });

    expect(first).toBe(generated);
    expect(second).toBe(generated);
  });

  test("builds privacy-safe registration metadata", () => {
    expect(
      memberPushRegistrationMetadata({
        installationId: "11111111-1111-4111-8111-111111111111",
        appInfo: { version: "2.4.0", build: "20400" },
        locale: "he-IL",
        environment: "production",
      }),
    ).toEqual({
      installationId: "11111111-1111-4111-8111-111111111111",
      appVersion: "2.4.0",
      buildNumber: "20400",
      locale: "he-IL",
      environment: "production",
      permissionStatus: "granted",
      capabilities: { richMedia: true, actions: true, timeSensitive: true },
    });
  });
});
