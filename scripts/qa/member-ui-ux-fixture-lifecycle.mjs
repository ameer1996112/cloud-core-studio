import { readFile, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SNAPSHOT_VERSION = 1;
const STUDIO_SETTINGS_KEYS = [
  "payments_enabled",
  "payments_provider",
  "payments_mode",
  "email_enabled",
  "whatsapp_enabled",
];

function invalidSnapshot() {
  throw new Error("fixture_studio_settings_snapshot_invalid");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function resolveFixtureEnvPath(cwd, configuredPath = ".env.qa.local") {
  return resolve(cwd, configuredPath);
}

export function snapshotPathForEnvPath(envPath) {
  return `${envPath}.member-ui-ux-studio-settings.snapshot.local`;
}

export function validateStudioSettingsSnapshot(value) {
  if (!isRecord(value) || value.version !== SNAPSHOT_VERSION || !isRecord(value.studioSettings)) {
    return invalidSnapshot();
  }
  if (
    Object.keys(value).sort().join("\0") !== ["studioSettings", "version"].join("\0") ||
    Object.keys(value.studioSettings).sort().join("\0") !==
      [...STUDIO_SETTINGS_KEYS].sort().join("\0")
  ) {
    return invalidSnapshot();
  }
  const settings = value.studioSettings;
  if (
    typeof settings.payments_enabled !== "boolean" ||
    typeof settings.payments_provider !== "string" ||
    typeof settings.payments_mode !== "string" ||
    typeof settings.email_enabled !== "boolean" ||
    typeof settings.whatsapp_enabled !== "boolean"
  ) {
    return invalidSnapshot();
  }
  return {
    version: SNAPSHOT_VERSION,
    studioSettings: Object.fromEntries(STUDIO_SETTINGS_KEYS.map((key) => [key, settings[key]])),
  };
}

export async function loadStudioSettingsSnapshot(snapshotPath) {
  let contents;
  try {
    contents = await readFile(snapshotPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  try {
    return validateStudioSettingsSnapshot(JSON.parse(contents));
  } catch (error) {
    if (error instanceof SyntaxError) return invalidSnapshot();
    throw error;
  }
}

export async function captureStudioSettingsSnapshot(snapshotPath, readCurrentSettings) {
  const existing = await loadStudioSettingsSnapshot(snapshotPath);
  if (existing) return existing;

  const snapshot = validateStudioSettingsSnapshot({
    version: SNAPSHOT_VERSION,
    studioSettings: await readCurrentSettings(),
  });
  try {
    await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    return snapshot;
  } catch (error) {
    if (error?.code === "EEXIST") {
      const racedSnapshot = await loadStudioSettingsSnapshot(snapshotPath);
      if (racedSnapshot) return racedSnapshot;
    }
    throw error;
  }
}

export function requireSnapshotForReset(snapshot, hasFixtureRecords) {
  if (!snapshot && hasFixtureRecords) {
    throw new Error("fixture_studio_settings_snapshot_missing");
  }
  return snapshot;
}

export async function restoreStudioSettingsSnapshot(snapshotPath, restoreSettings) {
  const snapshot = requireSnapshotForReset(await loadStudioSettingsSnapshot(snapshotPath), true);
  await restoreSettings(snapshot.studioSettings);
  await unlink(snapshotPath);
  return snapshot;
}
