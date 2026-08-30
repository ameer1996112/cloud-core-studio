import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

export interface FinalArtifactRecord {
  path: string;
  sizeBytes: number;
  sha256: string;
}

export interface FinalPayloadRecord extends FinalArtifactRecord {
  group: "screenshot" | "lighthouse-payload";
}

interface ArtifactPointer {
  path: string;
  sha256: string;
  sizeBytes?: number;
  [key: string]: unknown;
}

interface FinalManifest {
  schemaVersion: number;
  artifacts: Record<string, ArtifactPointer>;
  finalTree?: {
    fileCount?: number;
    nonManifestFileCount?: number;
    nonManifestBytes?: number;
    largeEvidenceException?: {
      screenshotCount?: number;
      screenshotBytes?: number;
      lighthousePayloadCount?: number;
      lighthousePayloadBytes?: number;
      retentionReason?: string;
      gitLfs?: boolean;
      externalStorage?: boolean;
    };
  };
  payloadInventory?: FinalPayloadRecord[];
  [key: string]: unknown;
}

const FINAL_ROOT = "artifacts/ui-audit/final";
const MANIFEST_PATH = `${FINAL_ROOT}/manifest.json`;

const normalize = (path: string) => path.split(sep).join("/");
const sha256 = (contents: Uint8Array) => createHash("sha256").update(contents).digest("hex");

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

export function collectFinalArtifactRecords(projectRoot: string): FinalArtifactRecord[] {
  const root = resolve(projectRoot);
  return walk(join(root, FINAL_ROOT))
    .map((absolutePath) => {
      const contents = readFileSync(absolutePath);
      return {
        path: normalize(relative(root, absolutePath)),
        sizeBytes: statSync(absolutePath).size,
        sha256: sha256(contents),
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function isScreenshot(path: string): boolean {
  return path.startsWith(`${FINAL_ROOT}/screenshots/`) && path.endsWith(".png");
}

function isLighthousePayload(path: string): boolean {
  return new RegExp(`^${FINAL_ROOT}/lighthouse/(home|auth|schedule)-he(?:-trace)?\\.json$`).test(
    path,
  );
}

function asPayload(record: FinalArtifactRecord): FinalPayloadRecord | undefined {
  if (isScreenshot(record.path)) return { ...record, group: "screenshot" };
  if (isLighthousePayload(record.path)) return { ...record, group: "lighthouse-payload" };
  return undefined;
}

function recordMismatch(expected: FinalArtifactRecord, actual: FinalArtifactRecord): string[] {
  const errors: string[] = [];
  if (expected.sizeBytes !== actual.sizeBytes) {
    errors.push(
      `${expected.path}: size ${actual.sizeBytes} does not match declared ${expected.sizeBytes}`,
    );
  }
  if (expected.sha256 !== actual.sha256) {
    errors.push(`${expected.path}: SHA-256 does not match declared digest`);
  }
  return errors;
}

export function validateFinalArtifactIntegrity(options: {
  projectRoot: string;
  manifest?: FinalManifest;
  actualFiles?: FinalArtifactRecord[];
}): string[] {
  const { projectRoot } = options;
  const manifest =
    options.manifest ??
    (JSON.parse(readFileSync(join(projectRoot, MANIFEST_PATH), "utf8")) as FinalManifest);
  const actualFiles = options.actualFiles ?? collectFinalArtifactRecords(projectRoot);
  const errors: string[] = [];
  const actualByPath = new Map(actualFiles.map((record) => [record.path, record]));
  const payloads = manifest.payloadInventory ?? [];
  const payloadPaths = payloads.map((record) => record.path);

  if (new Set(payloadPaths).size !== payloadPaths.length)
    errors.push("payload inventory contains duplicate paths");
  if (payloads.filter((record) => record.group === "screenshot").length !== 288) {
    errors.push("payload inventory must declare exactly 288 screenshots");
  }
  if (payloads.filter((record) => record.group === "lighthouse-payload").length !== 6) {
    errors.push("payload inventory must declare exactly 6 Lighthouse report/trace payloads");
  }
  for (const record of payloads) {
    const expectedGroup = isScreenshot(record.path)
      ? "screenshot"
      : isLighthousePayload(record.path)
        ? "lighthouse-payload"
        : undefined;
    if (!expectedGroup)
      errors.push(
        `${record.path}: payload path is outside the canonical screenshot/Lighthouse sets`,
      );
    else if (record.group !== expectedGroup)
      errors.push(`${record.path}: payload group does not match canonical path`);
    const actual = actualByPath.get(record.path);
    if (!actual) errors.push(`${record.path}: declared payload is missing`);
    else errors.push(...recordMismatch(record, actual));
  }

  const artifactPointers = Object.values(manifest.artifacts ?? {});
  for (const pointer of artifactPointers) {
    const actual = actualByPath.get(pointer.path);
    if (!actual) {
      errors.push(`${pointer.path}: declared root artifact is missing`);
      continue;
    }
    if (typeof pointer.sizeBytes !== "number")
      errors.push(`${pointer.path}: root artifact size is missing`);
    else errors.push(...recordMismatch(pointer as FinalArtifactRecord, actual));
  }

  const expectedPaths = new Set([
    MANIFEST_PATH,
    ...artifactPointers.map((pointer) => pointer.path),
    ...payloadPaths,
  ]);
  for (const record of actualFiles) {
    if (!expectedPaths.has(record.path)) errors.push(`${record.path}: unexpected final artifact`);
  }
  for (const path of expectedPaths) {
    if (!actualByPath.has(path)) errors.push(`${path}: expected final artifact is missing`);
  }

  const nonManifest = actualFiles.filter((record) => record.path !== MANIFEST_PATH);
  const screenshots = actualFiles.filter((record) => isScreenshot(record.path));
  const lighthousePayloads = actualFiles.filter((record) => isLighthousePayload(record.path));
  const finalTree = manifest.finalTree;
  if (finalTree?.fileCount !== actualFiles.length)
    errors.push(`final tree file count must equal ${actualFiles.length}`);
  if (finalTree?.nonManifestFileCount !== nonManifest.length)
    errors.push(`non-manifest file count must equal ${nonManifest.length}`);
  const nonManifestBytes = nonManifest.reduce((total, record) => total + record.sizeBytes, 0);
  if (finalTree?.nonManifestBytes !== nonManifestBytes)
    errors.push(`non-manifest byte count must equal ${nonManifestBytes}`);
  const exception = finalTree?.largeEvidenceException;
  const screenshotBytes = screenshots.reduce((total, record) => total + record.sizeBytes, 0);
  const lighthouseBytes = lighthousePayloads.reduce((total, record) => total + record.sizeBytes, 0);
  if (exception?.screenshotCount !== screenshots.length)
    errors.push(`large-evidence screenshot count must equal ${screenshots.length}`);
  if (exception?.screenshotBytes !== screenshotBytes)
    errors.push(`large-evidence screenshot bytes must equal ${screenshotBytes}`);
  if (exception?.lighthousePayloadCount !== lighthousePayloads.length)
    errors.push(`large-evidence Lighthouse count must equal ${lighthousePayloads.length}`);
  if (exception?.lighthousePayloadBytes !== lighthouseBytes)
    errors.push(`large-evidence Lighthouse bytes must equal ${lighthouseBytes}`);
  if (!exception?.retentionReason) errors.push("large-evidence retention reason is required");
  if (exception?.gitLfs !== false)
    errors.push("large-evidence exception must disclose that Git LFS is not used");
  if (exception?.externalStorage !== false)
    errors.push("large-evidence exception must disclose that external storage is not used");

  return errors;
}

export function refreshFinalManifest(projectRoot: string): void {
  const manifestPath = join(projectRoot, MANIFEST_PATH);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as FinalManifest;
  const records = collectFinalArtifactRecords(projectRoot);
  const byPath = new Map(records.map((record) => [record.path, record]));
  const payloadInventory = records.flatMap((record) => {
    const payload = asPayload(record);
    return payload ? [payload] : [];
  });
  for (const pointer of Object.values(manifest.artifacts)) {
    const record = byPath.get(pointer.path);
    if (!record) throw new Error(`Cannot refresh missing root artifact: ${pointer.path}`);
    pointer.sha256 = record.sha256;
    pointer.sizeBytes = record.sizeBytes;
  }
  const nonManifest = records.filter((record) => record.path !== MANIFEST_PATH);
  const screenshots = payloadInventory.filter((record) => record.group === "screenshot");
  const lighthouse = payloadInventory.filter((record) => record.group === "lighthouse-payload");
  manifest.schemaVersion = 2;
  manifest.payloadInventory = payloadInventory;
  manifest.finalTree = {
    fileCount: records.length,
    nonManifestFileCount: nonManifest.length,
    nonManifestBytes: nonManifest.reduce((total, record) => total + record.sizeBytes, 0),
    largeEvidenceException: {
      screenshotCount: screenshots.length,
      screenshotBytes: screenshots.reduce((total, record) => total + record.sizeBytes, 0),
      lighthousePayloadCount: lighthouse.length,
      lighthousePayloadBytes: lighthouse.reduce((total, record) => total + record.sizeBytes, 0),
      retentionReason:
        "Task 16 explicitly requires final screenshots; raw Lighthouse traces remain directly usable JSON. These checksummed evidence payloads are retained in-repository for this audit only.",
      gitLfs: false,
      externalStorage: false,
    },
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

if (import.meta.main) {
  const projectRoot = resolve(import.meta.dir, "../..");
  if (process.argv.includes("--write")) refreshFinalManifest(projectRoot);
  const errors = validateFinalArtifactIntegrity({ projectRoot });
  if (errors.length > 0) throw new Error(`Final evidence integrity failed:\n${errors.join("\n")}`);
  console.log(
    "Final evidence integrity: PASS (300 files; 288 PNGs; 6 Lighthouse report/trace payloads)",
  );
}
