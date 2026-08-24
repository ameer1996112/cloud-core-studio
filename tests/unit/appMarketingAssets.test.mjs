import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dir, "../..");

describe("app marketing assets", () => {
  const pngSize = (file) => {
    const bytes = readFileSync(file);
    expect(bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))).toBe(true);
    return {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  };
  const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
  const manifestFile = resolve(root, "tests/fixtures/app-marketing/asset-manifest.json");
  const manualReviewFile = resolve(root, "tests/fixtures/app-marketing/manual-review.json");
  const captureRequirementsFile = resolve(root, "tests/fixtures/app-marketing/requirements.txt");

  test("ships five distinct readable localized phone captures per language", () => {
    for (const lang of ["he", "ar", "en"]) {
      const hashes = new Set();
      for (const name of ["schedule", "booking", "bookings", "membership", "account"]) {
        const file = resolve(root, `public/images/app-marketing/${lang}/${name}.png`);
        expect(existsSync(file)).toBe(true);
        if (!existsSync(file)) continue;
        expect(pngSize(file)).toEqual({ width: 390, height: 844 });
        expect(statSync(file).size).toBeGreaterThan(20_000);
        hashes.add(sha256(file));
      }
      expect(hashes.size).toBe(5);
    }
  });

  test("ships localized 1200 by 630 social cards", () => {
    const hashes = new Set();
    for (const lang of ["he", "ar", "en"]) {
      const file = resolve(root, `public/images/app-marketing/social/${lang}.png`);
      expect(existsSync(file)).toBe(true);
      if (!existsSync(file)) continue;
      expect(pngSize(file)).toEqual({ width: 1200, height: 630 });
      expect(statSync(file).size).toBeGreaterThan(35_000);
      hashes.add(sha256(file));
    }
    expect(hashes.size).toBe(3);
  });

  test("records on-disk capture provenance and positive states in the generated manifest", () => {
    expect(existsSync(manifestFile)).toBe(true);
    if (!existsSync(manifestFile)) return;
    const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));

    expect(manifest.session.startsAt).toBe("2031-09-10T17:30:00.000Z");
    expect(manifest.session.timeZone).toBe("Asia/Jerusalem");
    expect(manifest.manualReview.status).toBe("required");
    for (const lang of ["he", "ar", "en"]) {
      const localeAssets = manifest.assets[lang];
      expect(localeAssets).toBeDefined();
      for (const name of ["schedule", "booking", "bookings", "membership", "account", "social"]) {
        const asset = localeAssets[name];
        const file = resolve(root, asset.file);
        expect(asset).toBeDefined();
        expect(existsSync(file)).toBe(true);
        if (!asset || !existsSync(file)) continue;
        expect(asset.sha256).toBe(sha256(file));
        expect(asset.dimensions).toEqual(pngSize(file));
      }
      expect(localeAssets.social.provenance).toMatchObject({
        officialLogo: "/brand/cloud-core-logo-full.svg",
        studioImage: "/images/auth/cloud-core-auth-hero.webp",
      });
      expect(localeAssets.social.observed.resourceUrls).toContain(
        "/images/auth/cloud-core-auth-hero.webp",
      );
      expect(localeAssets.social.observed.resourceUrls).toContain(
        "/brand/cloud-core-logo-full.svg",
      );
      expect(localeAssets.schedule.observed.state).toMatchObject({
        availableClassCount: 3,
        bookingAction: true,
        openSpots: [5, 3, 6],
      });
      expect(localeAssets.booking.observed.state).toMatchObject({
        bookingAction: true,
        openSpots: 5,
      });
      expect(localeAssets.bookings.observed.state).toMatchObject({ confirmed: true });
      expect(localeAssets.membership.observed.state).toMatchObject({ active: true, credits: 8 });
      expect(localeAssets.account.observed.state).toMatchObject({ completeFictionalProfile: true });
    }
  });

  test("keeps human review separate and binds its approval to the current asset hashes", () => {
    expect(existsSync(manualReviewFile)).toBe(true);
    expect(existsSync(manifestFile)).toBe(true);
    if (!existsSync(manualReviewFile) || !existsSync(manifestFile)) return;

    const review = JSON.parse(readFileSync(manualReviewFile, "utf8"));
    const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
    expect(review.status).toBe("approved");
    expect(review.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const lang of ["he", "ar", "en"]) {
      for (const name of ["schedule", "booking", "bookings", "membership", "account", "social"]) {
        const asset = manifest.assets[lang][name];
        expect(review.assets[lang][name].sha256).toBe(asset.sha256);
        expect(review.assets[lang][name].state).toEqual(asset.observed.state ?? null);
      }
    }
  });

  test("declares the exact non-production capture toolchain", () => {
    expect(existsSync(captureRequirementsFile)).toBe(true);
    if (!existsSync(captureRequirementsFile)) return;
    expect(readFileSync(captureRequirementsFile, "utf8")).toContain("playwright==1.58.0");
  });

  test("executes the loopback-only HTTP and WebSocket boundary probe with two-pass byte stability", () => {
    const script = resolve(root, "scripts/capture-app-marketing-assets.py");
    const result = spawnSync("python3", [script, "--verify-network"], {
      cwd: root,
      env: { ...process.env, NODE_ENV: "test" },
      encoding: "utf8",
      timeout: 60_000,
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout.trim().split("\n").at(-1));
    expect(payload.networkProbe).toEqual({ http: "rejected", webSocket: "closed" });
    expect(Object.keys(payload.hashes)).toHaveLength(18);
    expect(new Set(Object.values(payload.hashes)).size).toBeGreaterThan(12);
  }, 70_000);

  test("executes an invalid fixture-state probe and confirms capture validation blocks it", () => {
    const script = resolve(root, "scripts/capture-app-marketing-assets.py");
    const result = spawnSync("python3", [script, "--verify-state-regression"], {
      cwd: root,
      env: { ...process.env, NODE_ENV: "test" },
      encoding: "utf8",
      timeout: 30_000,
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout.trim().split("\n").at(-1));
    expect(payload.stateRegression).toBe("blocked");
    expect(payload.networkProbe).toEqual({ http: "rejected", webSocket: "closed" });
  }, 40_000);

  test("refuses a production capture before it can start the fixture or browser", () => {
    const script = resolve(root, "scripts/capture-app-marketing-assets.py");
    const result = spawnSync("python3", [script], {
      cwd: root,
      env: { ...process.env, NODE_ENV: "production" },
      encoding: "utf8",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Refusing to capture assets with NODE_ENV=production.");
    expect(result.stdout).not.toContain("vite");
    expect(result.stdout).not.toContain("Local:");
  });

  test("contains no real names or generic-woman dependency in fixture provenance", () => {
    const files = [
      resolve(root, "tests/fixtures/app-marketing/main.tsx"),
      resolve(root, "tests/fixtures/app-marketing/fixture.css"),
      resolve(root, "scripts/capture-app-marketing-assets.py"),
    ];
    for (const file of files) expect(existsSync(file)).toBe(true);
    if (!files.every(existsSync)) return;

    const source = files.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(source).not.toMatch(
      /Noor Amer|Yareen Shobash|נור עאמר|יארין שובאש|نور عامر|يارين شوباش/i,
    );
    expect(source).not.toMatch(/generic.*woman|stock.*woman|images\/.*women\.(?:png|webp|jpg)/i);
    expect(existsSync(manifestFile)).toBe(true);

    const genericWomanFiles = [
      resolve(root, "public/instagram/highlights/women.png"),
      resolve(root, "public/instagram/cloud-core-highlight-covers/women.png"),
    ].filter(existsSync);
    const genericWomanHashes = new Set(genericWomanFiles.map(sha256));
    for (const lang of ["he", "ar", "en"]) {
      for (const name of ["schedule", "booking", "bookings", "membership", "account", "social"]) {
        const file = resolve(
          root,
          `public/images/app-marketing/${name === "social" ? "social" : lang}/${name === "social" ? lang : name}.png`,
        );
        expect(genericWomanHashes.has(sha256(file))).toBe(false);
      }
    }
  });

  test("keeps capture-only code outside the production route and data layers", () => {
    const fixtureDirectory = resolve(root, "tests/fixtures/app-marketing");
    const fixture = resolve(fixtureDirectory, "main.tsx");
    const captureScript = resolve(root, "scripts/capture-app-marketing-assets.py");
    const fixtureViteConfig = resolve(fixtureDirectory, "vite.config.ts");

    for (const file of [fixture, captureScript, fixtureViteConfig]) {
      expect(existsSync(file)).toBe(true);
    }
    if (![fixture, captureScript, fixtureViteConfig].every(existsSync)) return;

    const fixtureSource = readFileSync(fixture, "utf8");
    const captureSource = readFileSync(captureScript, "utf8");
    const productionRouteSources = [
      resolve(root, "src/routeTree.gen.ts"),
      resolve(root, "src/router.tsx"),
      resolve(root, "vite.config.ts"),
    ]
      .filter(existsSync)
      .map((file) => readFileSync(file, "utf8"));

    expect(fixture.startsWith(resolve(root, "tests/fixtures"))).toBe(true);
    expect(fixtureSource).toContain("MARKETING_CAPTURE_FIXTURE");
    expect(fixtureSource).toContain("import.meta.env.PROD");
    expect(captureSource).toContain("NODE_ENV=production");
    expect(captureSource).toContain("route");
    expect(captureSource).toContain("abort");
    expect(fixtureSource).not.toMatch(
      /supabase|service[_-]?role|loadEnv|process\.env|dotenv|fetch\(|axios|postgres|database|customer/i,
    );
    expect(captureSource).not.toMatch(
      /supabase|service[_-]?role|loadEnv|process\.env|dotenv|axios|postgres|database|customer/i,
    );
    expect(captureSource).toContain("https://example.invalid/capture-boundary");
    expect(fixtureSource + captureSource).not.toMatch(/generic woman|woman stock|stock photo/i);
    expect(productionRouteSources.join("\n")).not.toContain("tests/fixtures/app-marketing");
  });

  test("documents the production asset contract without changing its explicit dimensions", () => {
    const marketingContract = readFileSync(resolve(root, "src/lib/app-marketing.ts"), "utf8");
    expect(marketingContract).toContain("SCREENSHOT_ALTS");
    expect(marketingContract).toContain("width: 390 as const");
    expect(marketingContract).toContain("height: 844 as const");
    expect(marketingContract).toContain("/images/app-marketing/social/");
  });

  test("ships unmodified vector Apple badges for every language", () => {
    for (const lang of ["he", "ar", "en"]) {
      const file = resolve(root, `public/brand/app-store-badges/${lang}.svg`);
      const svg = readFileSync(file, "utf8");
      expect(svg).toContain("<svg");
      expect(svg.length).toBeGreaterThan(2_000);
    }
  });
});
