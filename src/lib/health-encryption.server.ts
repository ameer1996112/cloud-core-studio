import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { GoogleAuth } from "google-auth-library";

const MAX_BYTES = 8 * 1024 * 1024;
export interface HealthKeyWrapper {
  key: string;
  wrap(bytes: Buffer, context: Buffer): Promise<Buffer>;
  unwrap(bytes: Buffer, context: Buffer): Promise<Buffer>;
}
export type HealthEnvelope = {
  version: 1;
  key: string;
  wrappedKey: string;
  nonce: string;
  tag: string;
  ciphertext: string;
};
function decode(value: unknown, max: number): Buffer {
  if (typeof value !== "string" || value.length > Math.ceil(max / 3) * 4)
    throw new Error("HEALTH_ENCRYPTION_INVALID");
  const bytes = Buffer.from(value, "base64");
  if (bytes.length > max || bytes.toString("base64") !== value)
    throw new Error("HEALTH_ENCRYPTION_INVALID");
  return bytes;
}
export async function encryptHealthBytes(
  plaintext: Buffer,
  context: string,
  kms: HealthKeyWrapper = healthKeyWrapper(),
): Promise<HealthEnvelope> {
  if (plaintext.length > MAX_BYTES) throw new Error("HEALTH_ENCRYPTION_INVALID");
  const key = randomBytes(32),
    nonce = randomBytes(12),
    aad = Buffer.from(context);
  try {
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const wrappedKey = await kms.wrap(key, aad);
    return {
      version: 1,
      key: kms.key,
      wrappedKey: wrappedKey.toString("base64"),
      nonce: nonce.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
  } finally {
    key.fill(0);
  }
}
export async function decryptHealthBytes(
  input: unknown,
  context: string,
  kms: HealthKeyWrapper = healthKeyWrapper(),
): Promise<Buffer> {
  const e = input as HealthEnvelope | null;
  if (!e || e.version !== 1 || e.key !== kms.key) throw new Error("HEALTH_ENCRYPTION_INVALID");
  const nonce = decode(e.nonce, 12),
    tag = decode(e.tag, 16);
  if (nonce.length !== 12 || tag.length !== 16) throw new Error("HEALTH_ENCRYPTION_INVALID");
  const ciphertext = decode(e.ciphertext, MAX_BYTES),
    aad = Buffer.from(context);
  const key = await kms.unwrap(decode(e.wrappedKey, 16384), aad);
  try {
    if (key.length !== 32) throw new Error("HEALTH_ENCRYPTION_INVALID");
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } finally {
    key.fill(0);
  }
}
// Checks transport integrity of the small key-wrapping request/response.
export function healthCrc32c(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0x82f63b78 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
export function healthKeyWrapper(): HealthKeyWrapper {
  const key = process.env.HEALTH_KMS_KEY ?? "";
  if (
    !/^projects\/[a-z0-9-]+\/locations\/[a-z0-9-]+\/keyRings\/[a-zA-Z0-9_-]+\/cryptoKeys\/[a-zA-Z0-9_-]+$/.test(
      key,
    )
  )
    throw new Error("HEALTH_ENCRYPTION_UNAVAILABLE");
  async function request(operation: "encrypt" | "decrypt", bytes: Buffer, aad: Buffer) {
    try {
      const client = await auth.getClient();
      const field = operation === "encrypt" ? "plaintext" : "ciphertext";
      const response = await client.request<Record<string, unknown>>({
        url: `https://cloudkms.googleapis.com/v1/${key}:${operation}`,
        method: "POST",
        timeout: 10000,
        retry: false,
        data: {
          [field]: bytes.toString("base64"),
          [`${field}Crc32c`]: String(healthCrc32c(bytes)),
          additionalAuthenticatedData: aad.toString("base64"),
          additionalAuthenticatedDataCrc32c: String(healthCrc32c(aad)),
        },
      });
      const resultField = operation === "encrypt" ? "ciphertext" : "plaintext";
      const result = decode(response.data[resultField], 16384);
      if (
        Number(response.data[`${resultField}Crc32c`]) !== healthCrc32c(result) ||
        (operation === "encrypt" &&
          (!response.data.verifiedPlaintextCrc32c ||
            !response.data.verifiedAdditionalAuthenticatedDataCrc32c))
      )
        throw new Error("integrity");
      return result;
    } catch {
      throw new Error("HEALTH_ENCRYPTION_UNAVAILABLE");
    }
  }
  return {
    key,
    wrap: (bytes, aad) => request("encrypt", bytes, aad),
    unwrap: (bytes, aad) => request("decrypt", bytes, aad),
  };
}
export function declarationContext(
  signer: string,
  participant: string,
  version: string,
  locale: string,
  request: string,
) {
  return JSON.stringify([
    "cloud-core-health-declaration-v1",
    signer.toLowerCase(),
    participant.toLowerCase(),
    version,
    locale,
    request.toLowerCase(),
  ]);
}
export function documentContext(
  declaration: string,
  document: string,
  signer: string,
  path: string,
) {
  return JSON.stringify([
    "cloud-core-health-document-v1",
    declaration.toLowerCase(),
    document.toLowerCase(),
    signer.toLowerCase(),
    path,
  ]);
}
