import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { composeOne } from "./generate";
import {
  apertureMatchedViewport,
  horizontalSourceCropPercent,
  physicalCaptureSize,
} from "./geometry";

type Rect = { x: number; y: number; width: number; height: number };
type Locale = "en" | "ar";
type DeviceName = "iphone-6.5" | "ipad-13";

const ROOT = resolve(import.meta.dir, "../..");
const TOOL_DIR = resolve(ROOT, "tools/app-store-screenshots");
const ASSET_DIR = resolve(ROOT, "app-store-assets");
const OUTPUT_DIR = resolve(ASSET_DIR, "output");
const VALIDATION_DIR = resolve(OUTPUT_DIR, "validation");
const CAPTURE_DIR = resolve(ASSET_DIR, "captures");
const CAPTURE_REPORT_PATH = resolve(CAPTURE_DIR, "capture-report.json");
const ZIP_PATH = resolve(OUTPUT_DIR, "cloud-core-app-store-localized-assets.zip");
const TEMP_ZIP_PATH = resolve(OUTPUT_DIR, ".cloud-core-app-store-localized-assets.tmp.zip");
const layout = JSON.parse(readFileSync(resolve(TOOL_DIR, "layout.json"), "utf8"));
const copy = JSON.parse(readFileSync(resolve(TOOL_DIR, "copy.json"), "utf8"));
const screens = ["01-home", "02-schedule", "03-bookings", "04-packages", "05-profile"];
const locales: Locale[] = ["en", "ar"];
const devices: DeviceName[] = ["iphone-6.5", "ipad-13"];
const iphoneOnly = process.argv.includes("--iphone-only");
const captureGeometryOnly = process.argv.includes("--capture-geometry-only");
const validatedDevices: DeviceName[] = iphoneOnly ? ["iphone-6.5"] : devices;
const failures: string[] = [];
const dimensionFiles: Record<string, unknown>[] = [];
const diffFiles: Record<string, unknown>[] = [];
const responsiveCaptureChecks: Record<string, unknown>[] = [];
const logoChecks: Record<string, unknown>[] = [];
const minimumLogoSimilarity = 0.68;
const expectedCaptureProvenance = {
  captureSourceRevision: "85b833a58a01311d12481b47bc21a96cb7fcc946",
  account: "app-store-demo@cloud-core.local",
  fixedTime: "2026-08-25T14:30:00+03:00",
  timezone: "Asia/Jerusalem",
  globalFixtureHash: "a0ba3447869dfbe8ee2529e5adfa046a55e3ed48c3766f1592e28b8d5200b5ab",
  browserVersion: "Google Chrome 151.0.7922.174",
};
let captureProvenance: Record<string, unknown> = {};

function hash(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function hashBuffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function relative(path: string) {
  return path.slice(ROOT.length + 1);
}

function expectedCaptureDimensions(device: DeviceName, screen: string) {
  const config = layout[device].capture;
  if (device === "iphone-6.5") {
    return { width: config.expectedWidth, height: config.expectedHeight };
  }
  const aperture = layout[device].appScreenshotMasks[screen] as Rect;
  return physicalCaptureSize(
    apertureMatchedViewport(config.cssWidth, aperture),
    config.deviceScaleFactor,
  );
}

async function validateCaptureGeometry() {
  for (const locale of locales) {
    for (const screen of screens) {
      const capture = resolve(CAPTURE_DIR, "ipad-13", locale, `${screen}-${locale}.png`);
      if (!existsSync(capture)) {
        failures.push(`missing iPad capture for geometry validation: ${locale}/${screen}`);
        continue;
      }
      const metadata = await sharp(capture).metadata();
      const appMask = layout["ipad-13"].appScreenshotMasks[screen] as Rect;
      const horizontalCropPercent = horizontalSourceCropPercent(
        { width: Number(metadata.width), height: Number(metadata.height) },
        appMask,
      );
      if (horizontalCropPercent > 0.1) {
        failures.push(
          `iPad capture would crop horizontally by ${horizontalCropPercent.toFixed(2)}%: ${locale}/${screen}`,
        );
      }
    }
  }
}

async function validateCaptureReport() {
  if (!existsSync(CAPTURE_REPORT_PATH)) {
    failures.push("missing capture provenance report");
    return;
  }
  const report = JSON.parse(readFileSync(CAPTURE_REPORT_PATH, "utf8"));
  captureProvenance = report;
  for (const [key, expected] of Object.entries(expectedCaptureProvenance)) {
    if (report[key] !== expected) failures.push(`capture provenance mismatch: ${key}`);
  }
  const expectedPaths = devices.flatMap((device) =>
    (["he", "en", "ar"] as const).flatMap((locale) =>
      screens.map((screen) => `${device}/${locale}/${screen}-${locale}.png`),
    ),
  );
  const reported = new Map<string, { path: string; sha256: string; width: number; height: number }>(
    (report.captureFiles ?? []).map(
      (file: { path: string; sha256: string; width: number; height: number }) => [file.path, file],
    ),
  );
  if (JSON.stringify([...reported.keys()].sort()) !== JSON.stringify([...expectedPaths].sort())) {
    failures.push("capture provenance file set is incomplete or incorrect");
  }
  for (const path of expectedPaths) {
    const absolute = resolve(CAPTURE_DIR, path);
    const reportedFile = reported.get(path);
    if (!existsSync(absolute) || reportedFile?.sha256 !== hash(absolute)) {
      failures.push(`capture hash differs from provenance report: ${path}`);
      continue;
    }
    const metadata = await sharp(absolute).metadata();
    const device = path.startsWith("iphone-6.5/") ? "iphone-6.5" : "ipad-13";
    const filename = path.split("/").at(-1) ?? "";
    const screen = filename.replace(/-(?:he|en|ar)\.png$/, "");
    const expected = expectedCaptureDimensions(device, screen);
    if (
      metadata.width !== expected.width ||
      metadata.height !== expected.height ||
      reportedFile.width !== expected.width ||
      reportedFile.height !== expected.height ||
      metadata.hasAlpha
    ) {
      failures.push(`capture metadata differs from provenance contract: ${path}`);
    }
  }
}

function isMasked(x: number, y: number, masks: Rect[]) {
  return masks.some(
    (mask) => x >= mask.x && x < mask.x + mask.width && y >= mask.y && y < mask.y + mask.height,
  );
}

async function pixelDiff(
  device: DeviceName,
  screen: string,
  referencePath: string,
  outputPath: string,
  diffPath: string,
) {
  const deviceLayout = layout[device];
  const canvas = deviceLayout.outputCanvas;
  const referenceMeta = await sharp(referencePath).metadata();
  if (referenceMeta.width !== canvas.width || referenceMeta.height !== canvas.height) {
    failures.push(`reference is not exact target size ${referencePath}`);
  }
  const reference = await sharp(referencePath).removeAlpha().toColourspace("srgb").raw().toBuffer();
  const output = await sharp(outputPath).removeAlpha().toColourspace("srgb").raw().toBuffer();
  if (reference.length !== output.length) {
    failures.push(`reference/output byte lengths differ ${outputPath}`);
    return {
      overallMeanAbsolutePercent: 100,
      outsideMaskMeanAbsolutePercent: 100,
      outsideMaskChangedPixelPercent: 100,
    };
  }
  const diff = Buffer.alloc(output.length);
  const masks = [
    deviceLayout.marketingTextMasks[screen] as Rect,
    deviceLayout.appScreenshotMasks[screen] as Rect,
  ];
  let overallAbsolute = 0;
  let outsideAbsolute = 0;
  let outsideChannels = 0;
  let outsideChangedPixels = 0;
  let outsidePixels = 0;

  for (let pixelIndex = 0; pixelIndex < canvas.width * canvas.height; pixelIndex += 1) {
    const x = pixelIndex % canvas.width;
    const y = Math.floor(pixelIndex / canvas.width);
    const masked = isMasked(x, y, masks);
    let changed = false;
    for (let channel = 0; channel < 3; channel += 1) {
      const index = pixelIndex * 3 + channel;
      const delta = Math.abs(reference[index] - output[index]);
      overallAbsolute += delta;
      diff[index] = Math.min(255, delta * 4);
      if (!masked) {
        outsideAbsolute += delta;
        outsideChannels += 1;
        if (delta > 3) changed = true;
      }
    }
    if (!masked) {
      outsidePixels += 1;
      if (changed) outsideChangedPixels += 1;
    }
  }

  await mkdir(resolve(diffPath, ".."), { recursive: true });
  await sharp(diff, { raw: { width: canvas.width, height: canvas.height, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile(diffPath);

  return {
    overallMeanAbsolutePercent: Number(
      ((overallAbsolute / (reference.length * 255)) * 100).toFixed(6),
    ),
    outsideMaskMeanAbsolutePercent: Number(
      ((outsideAbsolute / (Math.max(1, outsideChannels) * 255)) * 100).toFixed(6),
    ),
    outsideMaskChangedPixelPercent: Number(
      ((outsideChangedPixels / Math.max(1, outsidePixels)) * 100).toFixed(6),
    ),
  };
}

async function laplacianVariance(path: string, rect: Rect) {
  const { data, info } = await sharp(path)
    .extract({ left: rect.x, top: rect.y, width: rect.width, height: rect.height })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let sum = 0;
  let sumSquares = 0;
  let count = 0;
  for (let y = 1; y < info.height - 1; y += 1) {
    for (let x = 1; x < info.width - 1; x += 1) {
      const center = data[y * info.width + x];
      const laplacian =
        4 * center -
        data[y * info.width + x - 1] -
        data[y * info.width + x + 1] -
        data[(y - 1) * info.width + x] -
        data[(y + 1) * info.width + x];
      sum += laplacian;
      sumSquares += laplacian * laplacian;
      count += 1;
    }
  }
  const mean = sum / Math.max(1, count);
  return sumSquares / Math.max(1, count) - mean * mean;
}

async function contactSheet(
  sources: string[],
  output: string,
  thumb: { width: number; height: number },
) {
  const columns = 5;
  const gap = 12;
  const rows = Math.ceil(sources.length / columns);
  const width = columns * thumb.width + (columns + 1) * gap;
  const height = rows * thumb.height + (rows + 1) * gap;
  const composites = [];
  for (let index = 0; index < sources.length; index += 1) {
    const input = await sharp(sources[index])
      .resize(thumb.width, thumb.height, { fit: "contain", background: "#ffffff" })
      .removeAlpha()
      .png()
      .toBuffer();
    composites.push({
      input,
      left: gap + (index % columns) * (thumb.width + gap),
      top: gap + Math.floor(index / columns) * (thumb.height + gap),
    });
  }
  await sharp({ create: { width, height, channels: 3, background: "#ffffff" } })
    .composite(composites)
    .removeAlpha()
    .toColourspace("srgb")
    .png({ compressionLevel: 9 })
    .toFile(output);
}

async function validateFinals(device: DeviceName) {
  const deviceLayout = layout[device];
  const outputCanvas = deviceLayout.outputCanvas;
  const outputs: string[] = [];
  for (const locale of locales) {
    const localeDirectory = resolve(OUTPUT_DIR, device, locale);
    const expectedFilenames = screens.map((screen) => `${screen}-${locale}.png`).sort();
    const actualFilenames = existsSync(localeDirectory)
      ? readdirSync(localeDirectory)
          .filter((filename) => filename.endsWith(".png"))
          .sort()
      : [];
    if (JSON.stringify(actualFilenames) !== JSON.stringify(expectedFilenames)) {
      failures.push(`incorrect filename set ${localeDirectory}`);
    }
    for (const screen of screens) {
      const filename = `${screen}-${locale}.png`;
      const output = resolve(localeDirectory, filename);
      const reference = resolve(ROOT, deviceLayout.referenceDirectory, `${screen}-he.png`);
      if (!existsSync(output)) {
        failures.push(`missing ${output}`);
        continue;
      }
      if (!existsSync(reference)) {
        failures.push(`missing ${reference}`);
        continue;
      }
      outputs.push(output);
      const metadata = await sharp(output).metadata();
      const expectedComposite = await composeOne(device, locale, screen);
      if (hash(output) !== hashBuffer(expectedComposite)) {
        failures.push(
          `output is stale or differs from deterministic real-capture composite ${output}`,
        );
      }
      const appMask = deviceLayout.appScreenshotMasks[screen] as Rect;
      const sharpness = await laplacianVariance(output, appMask);
      const hasAlpha = Boolean(metadata.hasAlpha);
      const validDimensions =
        metadata.width === outputCanvas.width && metadata.height === outputCanvas.height;
      const validColor = metadata.space === "srgb" && metadata.channels === 3;
      if (!validDimensions) failures.push(`invalid dimensions ${output}`);
      if (hasAlpha) failures.push(`alpha channel present ${output}`);
      if (!validColor) failures.push(`non-RGB output ${output}`);
      if (sharpness < 20) failures.push(`app screenshot appears blurred ${output}`);
      const diffPath = resolve(VALIDATION_DIR, "diffs", device, locale, filename);
      const difference = await pixelDiff(device, screen, reference, output, diffPath);
      if (difference.outsideMaskChangedPixelPercent > 1) {
        failures.push(`outside-mask difference exceeds 1% ${output}`);
      }
      dimensionFiles.push({
        path: relative(output),
        device,
        locale,
        filename,
        width: metadata.width,
        height: metadata.height,
        colorSpace: metadata.space,
        channels: metadata.channels,
        hasAlpha,
        opaque: !hasAlpha,
        sharpnessLaplacianVariance: Number(sharpness.toFixed(3)),
        sha256: hash(output),
        deterministicCompositeMatches: hash(output) === hashBuffer(expectedComposite),
      });
      diffFiles.push({ path: relative(output), device, locale, filename, ...difference });
    }
  }
  await contactSheet(
    outputs,
    resolve(
      VALIDATION_DIR,
      device === "iphone-6.5" ? "contact-sheet-iphone.png" : "contact-sheet-ipad.png",
    ),
    device === "iphone-6.5" ? { width: 230, height: 498 } : { width: 225, height: 300 },
  );
}

function validateCopy() {
  const expected = {
    en: {
      "01-home": ["Your studio in your hand", "Classes, bookings, and packages in one place"],
      "02-schedule": ["A clear and flexible class schedule", "Find the class that fits your pace"],
      "03-bookings": ["Your bookings in one place", "Track every class and status"],
      "04-packages": [
        "Packages and credits, effortlessly",
        "Everything remaining and available is shown clearly",
      ],
      "05-profile": [
        "Your profile, organized and clear",
        "Personal details and preferences in one place",
      ],
    },
    ar: {
      "01-home": ["الاستوديو بين إيديك", "حصص، حجوزات وباقات بمكان واحد"],
      "02-schedule": ["جدول حصص واضح ومرن", "اختاري الحصة اللي بتناسب وتيرتك"],
      "03-bookings": ["حجوزاتك بمكان واحد", "تابعي كل حصة وحالتها بسهولة"],
      "04-packages": ["الباقات والرصيد بدون تعب", "كل شي باقي ومتاح ظاهر بوضوح"],
      "05-profile": ["ملفك مرتب وواضح", "بياناتك وتفضيلاتك بمكان واحد"],
    },
  } as const;
  if (copy.en.direction !== "ltr") failures.push("English copy is not marked LTR");
  if (copy.ar.direction !== "rtl") failures.push("Arabic copy is not marked RTL");
  for (const locale of locales) {
    for (const screen of screens) {
      const actual = [
        copy[locale].screens[screen].headline.join(" "),
        copy[locale].screens[screen].subtitle,
      ];
      if (JSON.stringify(actual) !== JSON.stringify(expected[locale][screen])) {
        failures.push(`${locale} copy differs from the exact supplied text for ${screen}`);
      }
    }
  }
  const actualArabic = screens.flatMap((screen) => [
    copy.ar.screens[screen].headline.join(" "),
    copy.ar.screens[screen].subtitle,
  ]);
  if (!actualArabic.every((value: string) => /[\u0600-\u06ff]/.test(value))) {
    failures.push("Arabic copy does not contain Arabic-script text");
  }
}

async function normalizedLogoMask(path: string, region?: Rect) {
  let pipeline = sharp(path).removeAlpha().toColourspace("srgb");
  if (region) {
    pipeline = pipeline.extract({
      left: region.x,
      top: region.y,
      width: region.width,
      height: region.height,
    });
  }
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  const binary = Buffer.alloc(info.width * info.height);
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const source = (y * info.width + x) * info.channels;
      const dark = data[source] < 175 && data[source + 1] < 185 && data[source + 2] < 200;
      if (!dark) continue;
      binary[y * info.width + x] = 255;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error(`No logo-shaped dark pixels found in ${path}`);
  return sharp(binary, { raw: { width: info.width, height: info.height, channels: 1 } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize(512, 256, { fit: "contain", background: "#000000", kernel: "nearest" })
    .blur(4)
    .raw()
    .toBuffer();
}

function maskCosine(first: Buffer, second: Buffer) {
  let dot = 0;
  let firstSquares = 0;
  let secondSquares = 0;
  for (let index = 0; index < first.length; index += 1) {
    dot += first[index] * second[index];
    firstSquares += first[index] ** 2;
    secondSquares += second[index] ** 2;
  }
  return dot / Math.max(1, Math.sqrt(firstSquares * secondSquares));
}

async function validateLogo() {
  const logo = resolve(ASSET_DIR, "branding/cloud-and-core-logo.png");
  const expected = "60ef558f0164a2b97707fd5cc70bde336fa69613d592c1d23b89a12dab0870b1";
  if (!existsSync(logo) || hash(logo) !== expected) {
    failures.push("official logo asset hash mismatch");
    return;
  }
  const officialMask = await normalizedLogoMask(logo);
  for (const device of validatedDevices) {
    for (const screen of screens) {
      const textMask = layout[device].marketingTextMasks[screen] as Rect;
      const textPlacement = layout[device].marketingText[screen];
      const region: Rect = {
        x: 0,
        y: 0,
        width: layout[device].outputCanvas.width,
        height: Math.min(textMask.y, textPlacement.singleLineTop, textPlacement.twoLineTop) - 10,
      };
      const reference = resolve(ROOT, layout[device].referenceDirectory, `${screen}-he.png`);
      const referenceSimilarity = maskCosine(
        officialMask,
        await normalizedLogoMask(reference, region),
      );
      logoChecks.push({
        path: relative(reference),
        kind: "approved-reference",
        officialLogoShapeCosine: Number(referenceSimilarity.toFixed(6)),
      });
      if (referenceSimilarity < minimumLogoSimilarity) {
        failures.push(`approved reference logo does not match official logo ${reference}`);
      }
      for (const locale of locales) {
        const output = resolve(OUTPUT_DIR, device, locale, `${screen}-${locale}.png`);
        if (!existsSync(output)) continue;
        const outputSimilarity = maskCosine(officialMask, await normalizedLogoMask(output, region));
        logoChecks.push({
          path: relative(output),
          kind: "localized-output",
          officialLogoShapeCosine: Number(outputSimilarity.toFixed(6)),
        });
        if (outputSimilarity < minimumLogoSimilarity) {
          failures.push(`localized output logo does not match official logo ${output}`);
        }
      }
    }
  }
}

async function validateResponsiveCaptures() {
  for (const locale of locales) {
    for (const screen of screens) {
      const iphoneCapture = resolve(CAPTURE_DIR, "iphone-6.5", locale, `${screen}-${locale}.png`);
      const ipadCapture = resolve(CAPTURE_DIR, "ipad-13", locale, `${screen}-${locale}.png`);
      if (!existsSync(iphoneCapture) || !existsSync(ipadCapture)) {
        failures.push(`missing real responsive capture for ${locale}/${screen}`);
        continue;
      }
      const phoneMeta = await sharp(iphoneCapture).metadata();
      const tabletMeta = await sharp(ipadCapture).metadata();
      const expectedPhone = expectedCaptureDimensions("iphone-6.5", screen);
      const expectedTablet = expectedCaptureDimensions("ipad-13", screen);
      if (phoneMeta.width !== expectedPhone.width || phoneMeta.height !== expectedPhone.height) {
        failures.push(`unexpected iPhone capture dimensions ${iphoneCapture}`);
      }
      if (
        tabletMeta.width !== expectedTablet.width ||
        tabletMeta.height !== expectedTablet.height
      ) {
        failures.push(`unexpected iPad capture dimensions ${ipadCapture}`);
      }
      if (phoneMeta.hasAlpha || tabletMeta.hasAlpha) {
        failures.push(`localized capture has transparency ${locale}/${screen}`);
      }
      if (hash(iphoneCapture) === hash(ipadCapture)) {
        failures.push(`iPhone capture reused as iPad ${locale}/${screen}`);
      }
      const ipadWidth = expectedTablet.width;
      const ipadHeight = expectedTablet.height;
      const appMask = layout["ipad-13"].appScreenshotMasks[screen] as Rect;
      const sourceCropPercent = horizontalSourceCropPercent(
        { width: Number(tabletMeta.width), height: Number(tabletMeta.height) },
        appMask,
      );
      const stretchedPhone = await sharp(iphoneCapture)
        .resize(ipadWidth, ipadHeight, { fit: "fill" })
        .greyscale()
        .raw()
        .toBuffer();
      const tablet = await sharp(ipadCapture).greyscale().raw().toBuffer();
      let absolute = 0;
      for (let index = 0; index < tablet.length; index += 1) {
        absolute += Math.abs(tablet[index] - stretchedPhone[index]);
      }
      const stretchedDifferencePercent = (absolute / (tablet.length * 255)) * 100;
      if (stretchedDifferencePercent < 2) {
        failures.push(`iPhone capture appears stretched into iPad ${locale}/${screen}`);
      }
      responsiveCaptureChecks.push({
        locale,
        screen,
        iphoneDimensions: [phoneMeta.width, phoneMeta.height],
        ipadDimensions: [tabletMeta.width, tabletMeta.height],
        iphoneHasAlpha: Boolean(phoneMeta.hasAlpha),
        ipadHasAlpha: Boolean(tabletMeta.hasAlpha),
        horizontalSourceCropPercent: Number(sourceCropPercent.toFixed(6)),
        stretchedIphoneVsIpadMeanAbsolutePercent: Number(stretchedDifferencePercent.toFixed(6)),
        reusedOrStretched: stretchedDifferencePercent < 2,
      });
    }
  }
}

async function writeReports() {
  const status = failures.length === 0 ? "pass" : "fail";
  await writeFile(
    resolve(VALIDATION_DIR, "dimension-report.json"),
    `${JSON.stringify(
      {
        status,
        scope: iphoneOnly ? "iphone-production-plus-responsive-captures" : "full-production",
        files: dimensionFiles,
        responsiveCaptureChecks,
        captureProvenance,
        failures,
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    resolve(VALIDATION_DIR, "pixel-diff-report.json"),
    `${JSON.stringify(
      {
        status,
        tolerance: {
          permittedMasks: [
            "marketing headline/subtitle/optional brand label",
            "app screenshot area",
          ],
          maximumOutsideMaskChangedPixelPercent: 1,
        },
        files: diffFiles,
        logoValidation:
          "The official logo asset hash is fixed. Logo silhouettes in every approved master and localized output are normalized and compared directly to that official asset; output logos are also outside all permitted masks.",
        logoChecks,
        failures,
      },
      null,
      2,
    )}\n`,
  );
}

async function buildZip() {
  if (existsSync(TEMP_ZIP_PATH)) await unlink(TEMP_ZIP_PATH);
  const zipProcess = Bun.spawn(
    ["zip", "-qr", TEMP_ZIP_PATH, "iphone-6.5", "ipad-13", "validation"],
    { cwd: OUTPUT_DIR, stdout: "pipe", stderr: "pipe" },
  );
  const [exitCode, stderr] = await Promise.all([
    zipProcess.exited,
    new Response(zipProcess.stderr).text(),
  ]);
  if (exitCode !== 0) throw new Error(`zip failed: ${stderr.trim()}`);
  const listProcess = Bun.spawn(["unzip", "-Z1", TEMP_ZIP_PATH], {
    cwd: OUTPUT_DIR,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [listExitCode, listing, listStderr] = await Promise.all([
    listProcess.exited,
    new Response(listProcess.stdout).text(),
    new Response(listProcess.stderr).text(),
  ]);
  if (listExitCode !== 0) throw new Error(`zip listing failed: ${listStderr.trim()}`);
  const archivedPaths = listing.split("\n");
  for (const device of devices) {
    for (const locale of locales) {
      for (const screen of screens) {
        const expected = `${device}/${locale}/${screen}-${locale}.png`;
        if (!archivedPaths.includes(expected)) throw new Error(`zip is missing ${expected}`);
      }
    }
  }
  for (const expected of [
    "validation/dimension-report.json",
    "validation/pixel-diff-report.json",
    "validation/contact-sheet-iphone.png",
    "validation/contact-sheet-ipad.png",
  ]) {
    if (!archivedPaths.includes(expected)) throw new Error(`zip is missing ${expected}`);
  }
  await rename(TEMP_ZIP_PATH, ZIP_PATH);
}

if (captureGeometryOnly) {
  await validateCaptureGeometry();
  if (failures.length) {
    for (const failure of failures) process.stderr.write(`FAIL ${failure}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write("capture geometry validation passed\n");
  }
} else {
  await mkdir(VALIDATION_DIR, { recursive: true });
  if (existsSync(ZIP_PATH)) await unlink(ZIP_PATH);
  if (existsSync(TEMP_ZIP_PATH)) await unlink(TEMP_ZIP_PATH);
  validateCopy();
  await validateLogo();
  await validateCaptureReport();
  await validateCaptureGeometry();
  await validateResponsiveCaptures();
  for (const device of validatedDevices) await validateFinals(device);
  await writeReports();

  if (!iphoneOnly && failures.length === 0) {
    try {
      await buildZip();
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
      await writeReports();
    }
  }

  if (failures.length) {
    for (const failure of failures) process.stderr.write(`FAIL ${failure}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `validation passed (${dimensionFiles.length} production files${iphoneOnly ? "" : "; ZIP created"})\n`,
    );
  }
}
