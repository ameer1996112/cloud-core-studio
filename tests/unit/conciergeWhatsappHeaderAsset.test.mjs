import { describe, expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { CONCIERGE_WHATSAPP_HEADER_ASSET } from "../../src/lib/conciergeTemplateCatalog.ts";

const assetPath = path.join(process.cwd(), "public", CONCIERGE_WHATSAPP_HEADER_ASSET.path);

describe("Concierge WhatsApp header asset", () => {
  test("is the exact Meta-supported PNG contract", () => {
    const bytes = readFileSync(assetPath);
    expect(bytes.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(bytes.readUInt32BE(16)).toBe(1200);
    expect(bytes.readUInt32BE(20)).toBe(628);
    expect(statSync(assetPath).size).toBeLessThanOrEqual(CONCIERGE_WHATSAPP_HEADER_ASSET.maxBytes);
    expect(CONCIERGE_WHATSAPP_HEADER_ASSET).toMatchObject({
      mimeType: "image/png",
      width: 1200,
      height: 628,
      maxBytes: 5_000_000,
      path: "brand/concierge-whatsapp-header.png",
      url: "https://cloudandcorestudio.com/brand/concierge-whatsapp-header.png",
    });
  });
});
