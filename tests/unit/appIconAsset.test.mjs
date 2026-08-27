import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const approvedPreviewPath = resolve(
  root,
  "docs/superpowers/assets/premium-app-icon/logo-emblem-preview.png",
);
const iconSetPath = resolve(root, "ios/App/App/Assets.xcassets/AppIcon.appiconset");
const productionIconPath = resolve(iconSetPath, "AppIcon-512@2x.png");
const contentsPath = resolve(iconSetPath, "Contents.json");
const pngSignature = Buffer.from("89504e470d0a1a0a", "hex");
const approvedSha256 = "7e800e9ae6f011326ab981de9efbf19d9579e0a7a446d1152913e0fcb4b54c54";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function expectApprovedPngContract(bytes) {
  expect(bytes.byteLength).toBeGreaterThan(10_000);
  expect(bytes.subarray(0, pngSignature.byteLength)).toEqual(pngSignature);

  let offset = pngSignature.byteLength;
  let ihdr = null;
  let ihdrCount = 0;
  let sawIend = false;

  while (offset < bytes.byteLength) {
    expect(offset + 12).toBeLessThanOrEqual(bytes.byteLength);

    const dataLength = bytes.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + dataLength;
    const chunkEnd = dataEnd + 4;

    expect(chunkEnd).toBeLessThanOrEqual(bytes.byteLength);

    const type = bytes.toString("ascii", typeStart, typeStart + 4);
    if (offset === pngSignature.byteLength) {
      expect(type).toBe("IHDR");
    }
    expect(type).not.toBe("tRNS");

    if (type === "IHDR") {
      ihdrCount += 1;
      expect(dataLength).toBe(13);
      ihdr = Buffer.from(bytes.subarray(dataStart, dataEnd));
    }

    offset = chunkEnd;
    if (type === "IEND") {
      expect(dataLength).toBe(0);
      sawIend = true;
      break;
    }
  }

  expect(sawIend).toBe(true);
  expect(offset).toBe(bytes.byteLength);
  expect(ihdrCount).toBe(1);
  expect(ihdr).not.toBeNull();
  expect(ihdr.byteLength).toBe(13);
  expect(ihdr.readUInt32BE(0)).toBe(1024);
  expect(ihdr.readUInt32BE(4)).toBe(1024);
  expect(ihdr[8]).toBe(8);
  expect(ihdr[9]).toBe(2);
}

describe("approved Cloud & Core iOS app icon", () => {
  test("retains exactly one universal 1024px iOS catalog entry", () => {
    const contents = JSON.parse(readFileSync(contentsPath, "utf8"));

    expect(contents).toEqual({
      images: [
        {
          filename: "AppIcon-512@2x.png",
          idiom: "universal",
          platform: "ios",
          size: "1024x1024",
        },
      ],
      info: {
        author: "xcode",
        version: 1,
      },
    });
  });

  test("uses the independently pinned approved RGB bytes", () => {
    const approvedPreviewBytes = readFileSync(approvedPreviewPath);
    const productionIconBytes = readFileSync(productionIconPath);

    expectApprovedPngContract(approvedPreviewBytes);
    expectApprovedPngContract(productionIconBytes);
    expect(sha256(approvedPreviewBytes)).toBe(approvedSha256);
    expect(sha256(productionIconBytes)).toBe(approvedSha256);
    expect(productionIconBytes.equals(approvedPreviewBytes)).toBe(true);
  });
});
