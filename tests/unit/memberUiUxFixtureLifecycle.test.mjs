import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  captureStudioSettingsSnapshot,
  requireSnapshotForReset,
  resolveFixtureEnvPath,
  restoreStudioSettingsSnapshot,
  snapshotPathForEnvPath,
  validateStudioSettingsSnapshot,
} from "../../scripts/qa/member-ui-ux-fixture-lifecycle.mjs";

const temporaryDirectories = [];
const ORIGINAL_SETTINGS = {
  payments_enabled: false,
  payments_provider: "manual",
  payments_mode: "live",
  email_enabled: true,
  whatsapp_enabled: true,
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

async function temporarySnapshotPath() {
  const directory = await mkdtemp(join(tmpdir(), "member-ui-ux-fixture-"));
  temporaryDirectories.push(directory);
  return join(directory, "fixture.snapshot.local");
}

describe("member UI/UX fixture studio settings lifecycle", () => {
  test("validates an exact versioned snapshot and rejects partial or widened data", () => {
    const snapshot = { version: 1, studioSettings: ORIGINAL_SETTINGS };
    expect(validateStudioSettingsSnapshot(snapshot)).toEqual(snapshot);
    expect(() =>
      validateStudioSettingsSnapshot({
        version: 1,
        studioSettings: { ...ORIGINAL_SETTINGS, payments_mode: 1 },
      }),
    ).toThrow("fixture_studio_settings_snapshot_invalid");
    expect(() =>
      validateStudioSettingsSnapshot({
        version: 1,
        studioSettings: { ...ORIGINAL_SETTINGS, unrelated: false },
      }),
    ).toThrow("fixture_studio_settings_snapshot_invalid");
  });

  test("captures original settings once and never overwrites them on repeated seeds", async () => {
    const snapshotPath = await temporarySnapshotPath();
    let reads = 0;
    const first = await captureStudioSettingsSnapshot(snapshotPath, async () => {
      reads += 1;
      return ORIGINAL_SETTINGS;
    });
    const second = await captureStudioSettingsSnapshot(snapshotPath, async () => {
      reads += 1;
      return { ...ORIGINAL_SETTINGS, payments_provider: "hyp", payments_mode: "test" };
    });

    expect(first).toEqual(second);
    expect(reads).toBe(1);
    expect(JSON.parse(readFileSync(snapshotPath, "utf8"))).toEqual(first);
    expect(statSync(snapshotPath).mode & 0o777).toBe(0o600);
  });

  test("removes the snapshot only after a successful exact restore", async () => {
    const snapshotPath = await temporarySnapshotPath();
    const snapshot = await captureStudioSettingsSnapshot(
      snapshotPath,
      async () => ORIGINAL_SETTINGS,
    );
    const events = [];

    await restoreStudioSettingsSnapshot(snapshotPath, async (settings) => {
      events.push("restore");
      expect(existsSync(snapshotPath)).toBe(true);
      expect(settings).toEqual(ORIGINAL_SETTINGS);
    });

    events.push("returned");
    expect(events).toEqual(["restore", "returned"]);
    expect(snapshot.studioSettings).toEqual(ORIGINAL_SETTINGS);
    expect(existsSync(snapshotPath)).toBe(false);
  });

  test("retains the snapshot when restoration fails", async () => {
    const snapshotPath = await temporarySnapshotPath();
    await captureStudioSettingsSnapshot(snapshotPath, async () => ORIGINAL_SETTINGS);

    await expect(
      restoreStudioSettingsSnapshot(snapshotPath, async () => {
        throw new Error("restore_failed");
      }),
    ).rejects.toThrow("restore_failed");
    expect(existsSync(snapshotPath)).toBe(true);
  });

  test("fails safely without a snapshot only while fixture records still exist", () => {
    expect(requireSnapshotForReset(null, false)).toBeNull();
    expect(() => requireSnapshotForReset(null, true)).toThrow(
      "fixture_studio_settings_snapshot_missing",
    );
  });

  test("derives the ignored snapshot beside the configured ENV_PATH", () => {
    const envPath = resolveFixtureEnvPath("/tmp/worktree", "../qa/custom.env.local");
    expect(envPath).toBe("/tmp/qa/custom.env.local");
    expect(snapshotPathForEnvPath(envPath)).toBe(
      "/tmp/qa/custom.env.local.member-ui-ux-studio-settings.snapshot.local",
    );
  });
});
