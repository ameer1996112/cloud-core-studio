import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import sharp from "sharp";

type Locale = "en" | "ar";
type Rect = { x: number; y: number; width: number; height: number };
type DeviceName = "iphone-6.5" | "ipad-13";
type Copy = Record<
  Locale,
  {
    direction: "ltr" | "rtl";
    font: string;
    screens: Record<string, { headline: string[]; subtitle: string }>;
  }
>;

const ROOT = resolve(import.meta.dir, "../..");
const TOOL_DIR = resolve(ROOT, "tools/app-store-screenshots");
const CAPTURE_DIR = resolve(ROOT, "app-store-assets/captures");
const OUTPUT_DIR = resolve(ROOT, "app-store-assets/output");
const copy = JSON.parse(readFileSync(resolve(TOOL_DIR, "copy.json"), "utf8")) as Copy;
const layout = JSON.parse(readFileSync(resolve(TOOL_DIR, "layout.json"), "utf8"));

const screens = ["01-home", "02-schedule", "03-bookings", "04-packages", "05-profile"];
const fontFiles = {
  en: {
    regular: resolve(
      ROOT,
      "node_modules/@fontsource/assistant/files/assistant-latin-500-normal.woff2",
    ),
    bold: resolve(
      ROOT,
      "node_modules/@fontsource/assistant/files/assistant-latin-700-normal.woff2",
    ),
  },
  ar: {
    regular: resolve(
      ROOT,
      "node_modules/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-500-normal.woff2",
    ),
    bold: resolve(
      ROOT,
      "node_modules/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-700-normal.woff2",
    ),
  },
};

const referenceRasterCache = new Map<
  DeviceName,
  Promise<Array<{ data: Buffer; width: number; height: number }>>
>();

function xml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fontData(path: string) {
  return readFileSync(path).toString("base64");
}

function textSvg({
  width,
  height,
  lines,
  fontFamily,
  fontPath,
  fontSize,
  fontWeight,
  color,
  lineHeight,
  direction,
}: {
  width: number;
  height: number;
  lines: string[];
  fontFamily: string;
  fontPath: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  lineHeight: number;
  direction: "ltr" | "rtl";
}) {
  const firstBaseline = fontSize;
  const tspans = lines
    .map(
      (line, index) =>
        `<tspan x="${width / 2}" y="${firstBaseline + index * lineHeight}">${xml(line)}</tspan>`,
    )
    .join("");
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <style>
        @font-face {
          font-family: '${fontFamily}';
          src: url(data:font/woff2;base64,${fontData(fontPath)}) format('woff2');
          font-weight: ${fontWeight};
        }
        text {
          font-family: '${fontFamily}';
          font-size: ${fontSize}px;
          font-weight: ${fontWeight};
          fill: ${color};
          text-anchor: middle;
        }
      </style>
      <text x="${width / 2}" y="${firstBaseline}" direction="${direction}" unicode-bidi="plaintext">${tspans}</text>
    </svg>
  `);
}

function referenceRasters(device: DeviceName) {
  let cached = referenceRasterCache.get(device);
  if (!cached) {
    const directory = layout[device].referenceDirectory;
    cached = Promise.all(
      screens.map(async (screen) => {
        const { data, info } = await sharp(resolve(ROOT, directory, `${screen}-he.png`))
          .removeAlpha()
          .toColourspace("srgb")
          .raw()
          .toBuffer({ resolveWithObject: true });
        return { data, width: info.width, height: info.height };
      }),
    );
    referenceRasterCache.set(device, cached);
  }
  return cached;
}

async function approvedBackgroundPatch(device: DeviceName, screen: string, rect: Rect) {
  const rasters = await referenceRasters(device);
  const target = rasters[screens.indexOf(screen)];
  const output = Buffer.alloc(rect.width * rect.height * 3);
  for (let y = 0; y < rect.height; y += 1) {
    const anchorOffset = ((rect.y + y) * target.width + rect.x) * 3;
    const anchorRed = target.data[anchorOffset];
    const anchorGreen = target.data[anchorOffset + 1];
    const anchorBlue = target.data[anchorOffset + 2];
    for (let x = 0; x < rect.width; x += 1) {
      let bestIndex = 0;
      let bestScore = Number.POSITIVE_INFINITY;
      for (let sourceIndex = 0; sourceIndex < rasters.length; sourceIndex += 1) {
        const source = rasters[sourceIndex];
        const index = ((rect.y + y) * source.width + rect.x + x) * 3;
        const red = source.data[index];
        const green = source.data[index + 1];
        const blue = source.data[index + 2];
        const score =
          (red - anchorRed) ** 2 + (green - anchorGreen) ** 2 + (blue - anchorBlue) ** 2;
        if (score < bestScore) {
          bestScore = score;
          bestIndex = sourceIndex;
        }
      }
      const source = rasters[bestIndex];
      const sourceOffset = ((rect.y + y) * source.width + rect.x + x) * 3;
      const outputOffset = (y * rect.width + x) * 3;
      source.data.copy(output, outputOffset, sourceOffset, sourceOffset + 3);
    }
  }
  return sharp(output, { raw: { width: rect.width, height: rect.height, channels: 3 } })
    .png()
    .toBuffer();
}

async function roundedScreenshot(
  path: string,
  rect: Rect & { cornerRadius: number; fit: "contain" | "cover"; position: string },
) {
  const mask = Buffer.from(
    `<svg width="${rect.width}" height="${rect.height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" rx="${rect.cornerRadius}" fill="white"/></svg>`,
  );
  return sharp(path)
    .resize(rect.width, rect.height, {
      fit: rect.fit,
      position: rect.position,
      background: "#fbf8f2",
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

export async function composeOne(device: DeviceName, locale: Locale, screen: string) {
  const deviceLayout = layout[device];
  const reference = resolve(ROOT, deviceLayout.referenceDirectory, `${screen}-he.png`);
  const capture = resolve(CAPTURE_DIR, device, locale, `${screen}-${locale}.png`);
  const canvas = deviceLayout.outputCanvas;
  const metadata = await sharp(reference).metadata();
  if (metadata.width !== canvas.width || metadata.height !== canvas.height) {
    throw new Error(`Reference is not at its exact target size: ${reference}`);
  }
  const base = await sharp(reference).removeAlpha().toColourspace("srgb").png().toBuffer();
  const textMask = deviceLayout.marketingTextMasks[screen] as Rect;
  const textPlacement = deviceLayout.marketingText[screen];
  const appMask = deviceLayout.appScreenshotMasks[screen] as Rect & {
    cornerRadius: number;
    fit: "contain" | "cover";
    position: string;
  };
  const patch = await approvedBackgroundPatch(device, screen, textMask);
  const app = await roundedScreenshot(capture, appMask);
  const hardware = await Promise.all(
    ((deviceLayout.hardwareOverlays?.[screen] ?? []) as Rect[]).map(async (rect) => ({
      input: await sharp(base)
        .extract({ left: rect.x, top: rect.y, width: rect.width, height: rect.height })
        .png()
        .toBuffer(),
      left: rect.x,
      top: rect.y,
    })),
  );
  const localized = copy[locale];
  const screenCopy = localized.screens[screen];
  const twoLines = screenCopy.headline.length > 1;
  const headlineHeight = twoLines
    ? deviceLayout.headline.fontSize + deviceLayout.headline.lineHeight + 20
    : deviceLayout.headline.fontSize + 20;
  const headline = textSvg({
    width: deviceLayout.headline.maxWidth,
    height: headlineHeight,
    lines: screenCopy.headline,
    fontFamily: localized.font,
    fontPath: fontFiles[locale].bold,
    fontSize: deviceLayout.headline.fontSize,
    fontWeight: deviceLayout.headline.weight,
    color: deviceLayout.headline.color,
    lineHeight: deviceLayout.headline.lineHeight,
    direction: localized.direction,
  });
  const subtitle = textSvg({
    width: deviceLayout.subtitle.maxWidth,
    height: deviceLayout.subtitle.fontSize + 18,
    lines: [screenCopy.subtitle],
    fontFamily: localized.font,
    fontPath: fontFiles[locale].regular,
    fontSize: deviceLayout.subtitle.fontSize,
    fontWeight: deviceLayout.subtitle.weight,
    color: deviceLayout.subtitle.color,
    lineHeight: deviceLayout.subtitle.fontSize + 8,
    direction: localized.direction,
  });

  return sharp(base)
    .composite([
      { input: patch, left: textMask.x, top: textMask.y },
      { input: app, left: appMask.x, top: appMask.y },
      ...hardware,
      {
        input: headline,
        left: Math.round(deviceLayout.headline.centerX - deviceLayout.headline.maxWidth / 2),
        top: twoLines ? textPlacement.twoLineTop : textPlacement.singleLineTop,
      },
      {
        input: subtitle,
        left: Math.round(deviceLayout.headline.centerX - deviceLayout.subtitle.maxWidth / 2),
        top: textPlacement.subtitleTop,
      },
    ])
    .removeAlpha()
    .toColourspace("srgb")
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

export async function generateAll() {
  for (const device of ["iphone-6.5", "ipad-13"] as const) {
    for (const locale of ["en", "ar"] as const) {
      for (const screen of screens) {
        const outputDir = resolve(OUTPUT_DIR, device, locale);
        const output = resolve(outputDir, `${screen}-${locale}.png`);
        await mkdir(outputDir, { recursive: true });
        await writeFile(output, await composeOne(device, locale, screen));
        process.stdout.write(`generated ${basename(output)}\n`);
      }
    }
  }
}

if (import.meta.main) await generateAll();
