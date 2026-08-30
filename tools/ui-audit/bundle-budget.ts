import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

export type ViteManifestChunk = {
  file: string;
  src?: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
  css?: string[];
  assets?: string[];
};

export type ViteManifest = Record<string, ViteManifestChunk>;

type ByteLimit = { rawBytes: number; gzipBytes: number };

type PerformanceBudget = {
  schemaVersion: 1;
  buildDirectory: string;
  manifestPath: string;
  moduleMetadataPath: string;
  publicEntries: string[];
  publicStyles: string[];
  forbiddenPublicImports: string[];
  roleCssMarkers: Array<{ ownerStyle: string; marker: string }>;
  limits: {
    publicJavaScript: ByteLimit;
    publicCss: ByteLimit;
    rootCss: ByteLimit;
    routeChunk: ByteLimit;
    totalFonts: ByteLimit;
  };
};

type FileMeasurement = {
  file: string;
  rawBytes: number;
  gzipBytes: number;
};

type BundleMetric = ByteLimit & { files: FileMeasurement[] };

export type BundleAnalysis = {
  schemaVersion: 1;
  manifestPath: string;
  moduleMetadataPath: string;
  publicEntries: string[];
  publicImports: string[];
  publicModules: string[];
  publicRouteShells: string[];
  forbiddenPublicImports: string[];
  roleCssMarkers: Array<{ ownerStyle: string; marker: string }>;
  metrics: {
    publicJavaScript: BundleMetric;
    publicCss: BundleMetric;
    rootCss: BundleMetric;
    routeChunk: BundleMetric;
    totalFonts: BundleMetric;
  };
  limits: PerformanceBudget["limits"];
  violations: string[];
};

function normalizePath(path: string): string {
  const suffixIndex = path.search(/[?#]/);
  const pathname = suffixIndex === -1 ? path : path.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? "" : path.slice(suffixIndex);
  return `${pathname.replaceAll("\\", "/").split(sep).join("/").replace(/^\.\//, "")}${suffix}`;
}

function canonicalSource(path: string): string {
  return normalizePath(path).replace(/[?#].*$/, "");
}

function assertPositiveLimit(name: string, limit: unknown): asserts limit is ByteLimit {
  if (
    !limit ||
    typeof limit !== "object" ||
    !("rawBytes" in limit) ||
    !("gzipBytes" in limit) ||
    typeof limit.rawBytes !== "number" ||
    typeof limit.gzipBytes !== "number" ||
    !Number.isInteger(limit.rawBytes) ||
    !Number.isInteger(limit.gzipBytes) ||
    limit.rawBytes <= 0 ||
    limit.gzipBytes <= 0 ||
    limit.gzipBytes >= limit.rawBytes
  ) {
    throw new Error(`${name} must define positive integer rawBytes and smaller gzipBytes limits`);
  }
}

function loadBudget(path: string): PerformanceBudget {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<PerformanceBudget>;
  if (parsed.schemaVersion !== 1) throw new Error("unsupported performance budget schema");
  if (!parsed.buildDirectory || !parsed.manifestPath || !parsed.moduleMetadataPath) {
    throw new Error(
      "performance budget must name buildDirectory, manifestPath, and moduleMetadataPath",
    );
  }
  if (!parsed.publicEntries?.length) throw new Error("performance budget has no public entries");
  if (!parsed.publicStyles?.length) throw new Error("performance budget has no public styles");
  if (!parsed.forbiddenPublicImports?.length) {
    throw new Error("performance budget has no forbidden public imports");
  }
  if (
    !parsed.roleCssMarkers?.length ||
    parsed.roleCssMarkers.some(({ ownerStyle, marker }) => !ownerStyle || !marker)
  ) {
    throw new Error("performance budget has no valid role CSS markers");
  }
  if (!parsed.limits) throw new Error("performance budget has no limits");
  for (const name of [
    "publicJavaScript",
    "publicCss",
    "rootCss",
    "routeChunk",
    "totalFonts",
  ] as const) {
    assertPositiveLimit(name, parsed.limits[name]);
  }
  return parsed as PerformanceBudget;
}

type RenderedModuleMetadata = {
  id: string;
  renderedBytes: number;
  renderedExports: string[];
};

type ModuleMetadata = {
  schemaVersion: 1;
  chunks: Record<string, RenderedModuleMetadata[]>;
};

function loadModuleMetadata(path: string): ModuleMetadata {
  if (!existsSync(path)) throw new Error(`bundle module metadata is missing: ${path}`);
  const metadata = JSON.parse(readFileSync(path, "utf8")) as Partial<ModuleMetadata>;
  if (metadata.schemaVersion !== 1 || !metadata.chunks || typeof metadata.chunks !== "object") {
    throw new Error(`bundle module metadata is invalid: ${path}`);
  }
  for (const [file, modules] of Object.entries(metadata.chunks)) {
    if (
      !Array.isArray(modules) ||
      modules.some(
        (module) =>
          !module ||
          typeof module.id !== "string" ||
          !Number.isInteger(module.renderedBytes) ||
          module.renderedBytes < 0 ||
          !Array.isArray(module.renderedExports) ||
          module.renderedExports.some((name) => typeof name !== "string"),
      )
    ) {
      throw new Error(`bundle module metadata is invalid for ${file}`);
    }
  }
  return metadata as ModuleMetadata;
}

export function loadViteManifest(path: string): ViteManifest {
  if (!existsSync(path)) throw new Error(`Vite manifest is missing: ${path}`);
  const manifest = JSON.parse(readFileSync(path, "utf8")) as ViteManifest;
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error(`Vite manifest is invalid: ${path}`);
  }
  for (const [key, chunk] of Object.entries(manifest)) {
    if (!chunk || typeof chunk.file !== "string" || chunk.file.length === 0) {
      throw new Error(`Vite manifest entry ${key} has no emitted file`);
    }
  }
  return manifest;
}

function resolveManifestEntry(manifest: ViteManifest, source: string): string {
  const normalizedSource = normalizePath(source);
  const canonicalRequestedSource = canonicalSource(source);
  const matches = Object.entries(manifest)
    .filter(
      ([key, chunk]) =>
        normalizePath(key) === normalizedSource ||
        (chunk.src !== undefined && normalizePath(chunk.src) === normalizedSource) ||
        normalizePath(key).endsWith(`/${normalizedSource}`) ||
        (canonicalSource(key) === canonicalRequestedSource &&
          normalizedSource === canonicalRequestedSource) ||
        (chunk.src !== undefined &&
          canonicalSource(chunk.src) === canonicalRequestedSource &&
          normalizedSource === canonicalRequestedSource),
    )
    .map(([key]) => key);
  if (matches.length === 0) throw new Error(`manifest entry is missing for ${source}`);
  if (matches.length > 1) {
    throw new Error(`manifest entry is ambiguous for ${source}: ${matches.sort().join(", ")}`);
  }
  return matches[0];
}

export function importClosure(manifest: ViteManifest, source: string): string[] {
  const root = resolveManifestEntry(manifest, source);
  const visited = new Set<string>();
  const pending = [root];
  while (pending.length > 0) {
    const key = pending.pop()!;
    if (visited.has(key)) continue;
    const chunk = manifest[key];
    if (!chunk) throw new Error(`manifest static import is missing: ${key}`);
    visited.add(key);
    for (const imported of [...(chunk.imports ?? [])].sort().reverse()) {
      if (!manifest[imported]) {
        throw new Error(`manifest static import ${imported} referenced by ${key} is missing`);
      }
      pending.push(imported);
    }
  }
  return [...visited].sort();
}

function measureFile(buildDirectory: string, file: string): FileMeasurement {
  const normalizedFile = normalizePath(file);
  const absolute = resolve(buildDirectory, normalizedFile);
  const relativePath = relative(buildDirectory, absolute);
  if (relativePath.startsWith("..") || relativePath === "") {
    throw new Error(`bundle file escapes build directory: ${file}`);
  }
  if (!existsSync(absolute) || !statSync(absolute).isFile()) {
    throw new Error(`manifest bundle file is missing: ${normalizedFile}`);
  }
  const contents = readFileSync(absolute);
  return {
    file: normalizedFile,
    rawBytes: contents.byteLength,
    gzipBytes: gzipSync(contents, { level: 9 }).byteLength,
  };
}

function aggregateFiles(buildDirectory: string, files: Iterable<string>): BundleMetric {
  const measured = [...new Set([...files].map(normalizePath))]
    .sort()
    .map((file) => measureFile(buildDirectory, file));
  return {
    rawBytes: measured.reduce((sum, item) => sum + item.rawBytes, 0),
    gzipBytes: measured.reduce((sum, item) => sum + item.gzipBytes, 0),
    files: measured,
  };
}

function largestFiles(buildDirectory: string, files: Iterable<string>): BundleMetric {
  const measured = [...new Set([...files].map(normalizePath))]
    .sort()
    .map((file) => measureFile(buildDirectory, file));
  return {
    rawBytes: measured.reduce((maximum, item) => Math.max(maximum, item.rawBytes), 0),
    gzipBytes: measured.reduce((maximum, item) => Math.max(maximum, item.gzipBytes), 0),
    files: measured,
  };
}

function listFiles(directory: string): string[] {
  if (!existsSync(directory)) throw new Error(`build directory is missing: ${directory}`);
  const files: string[] = [];
  const visit = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(normalizePath(relative(directory, absolute)));
    }
  };
  visit(directory);
  return files.sort();
}

function matchesForbidden(source: string, forbidden: string): boolean {
  const normalizedSource = normalizePath(source);
  const normalizedForbidden = normalizePath(forbidden);
  return normalizedForbidden.endsWith("/")
    ? normalizedSource.startsWith(normalizedForbidden)
    : normalizedSource === normalizedForbidden;
}

function limitViolations(
  name: keyof PerformanceBudget["limits"],
  metric: BundleMetric,
  limit: ByteLimit,
): string[] {
  const violations: string[] = [];
  if (metric.rawBytes > limit.rawBytes) {
    violations.push(`${name} raw ${metric.rawBytes} exceeds ${limit.rawBytes} bytes`);
  }
  if (metric.gzipBytes > limit.gzipBytes) {
    violations.push(`${name} gzip ${metric.gzipBytes} exceeds ${limit.gzipBytes} bytes`);
  }
  return violations;
}

export function analyzeBundle(
  options: {
    projectRoot?: string;
    budgetPath?: string;
  } = {},
): BundleAnalysis {
  const projectRoot = resolve(options.projectRoot ?? resolve(import.meta.dir, "../.."));
  const budgetPath = resolve(
    options.budgetPath ?? resolve(projectRoot, "tools/ui-audit/performance-budget.json"),
  );
  const budget = loadBudget(budgetPath);
  const manifestPath = resolve(projectRoot, budget.manifestPath);
  const moduleMetadataPath = resolve(projectRoot, budget.moduleMetadataPath);
  const buildDirectory = resolve(projectRoot, budget.buildDirectory);
  const manifest = loadViteManifest(manifestPath);
  const moduleMetadata = loadModuleMetadata(moduleMetadataPath);

  const publicImports = new Set<string>();
  for (const entry of [...budget.publicEntries].sort()) {
    for (const imported of importClosure(manifest, entry)) publicImports.add(imported);
  }

  const publicJavaScript = new Set<string>();
  const publicCss = new Set<string>();
  const rootCssFiles = new Set<string>();
  for (const key of publicImports) {
    const chunk = manifest[key];
    if (/\.(?:m?js|cjs)$/.test(chunk.file)) publicJavaScript.add(chunk.file);
    for (const css of chunk.css ?? []) publicCss.add(css);
  }
  for (const source of [...budget.publicStyles].sort()) {
    const key = resolveManifestEntry(manifest, source);
    const file = manifest[key].file;
    if (extname(file).toLowerCase() !== ".css") {
      throw new Error(`configured public style ${source} did not emit CSS: ${file}`);
    }
    publicCss.add(file);
    rootCssFiles.add(file);
  }
  if (publicJavaScript.size === 0) throw new Error("public entry closure contains no JavaScript");
  if (publicCss.size === 0) throw new Error("public entry closure contains no CSS");
  const publicModules = new Set<string>();
  const publicRouteShells = new Set<string>();
  const publicModuleFiles = new Map<string, Set<string>>();
  for (const file of [...publicJavaScript].sort()) {
    const modules = moduleMetadata.chunks[file];
    if (!modules) throw new Error(`module metadata is missing for public chunk ${file}`);
    for (const module of modules) {
      if (module.renderedBytes === 0) continue;
      const moduleIdentity = normalizePath(module.id);
      const source = canonicalSource(moduleIdentity);
      publicModules.add(moduleIdentity);
      if (
        moduleIdentity === source &&
        source.startsWith("src/routes/") &&
        module.renderedExports.length === 1 &&
        module.renderedExports[0] === "Route"
      ) {
        publicRouteShells.add(moduleIdentity);
      }
      const files = publicModuleFiles.get(moduleIdentity) ?? new Set<string>();
      files.add(file);
      publicModuleFiles.set(moduleIdentity, files);
    }
  }

  const routeChunkFiles = Object.entries(manifest)
    .filter(([key, chunk]) => {
      const source = canonicalSource(chunk.src ?? key);
      return source.startsWith("src/routes/") && /\.(?:m?js|cjs)$/.test(chunk.file);
    })
    .map(([, chunk]) => chunk.file);
  if (routeChunkFiles.length === 0) throw new Error("Vite manifest contains no route chunks");

  const fontFiles = listFiles(buildDirectory).filter((file) =>
    [".woff", ".woff2", ".ttf", ".otf"].includes(extname(file).toLowerCase()),
  );
  if (fontFiles.length === 0) throw new Error("production build contains no font files");

  const metrics = {
    publicJavaScript: aggregateFiles(buildDirectory, publicJavaScript),
    publicCss: aggregateFiles(buildDirectory, publicCss),
    rootCss: aggregateFiles(buildDirectory, rootCssFiles),
    routeChunk: largestFiles(buildDirectory, routeChunkFiles),
    totalFonts: aggregateFiles(buildDirectory, fontFiles),
  };
  const violations: string[] = [];
  for (const key of [...publicImports].sort()) {
    const sources = [key, manifest[key].src].filter((source): source is string => Boolean(source));
    for (const forbidden of budget.forbiddenPublicImports) {
      if (sources.some((source) => matchesForbidden(source, forbidden))) {
        violations.push(`public import closure contains forbidden module ${forbidden} via ${key}`);
      }
    }
  }
  for (const moduleIdentity of [...publicModules].sort()) {
    if (publicRouteShells.has(moduleIdentity)) continue;
    const source = canonicalSource(moduleIdentity);
    for (const forbidden of budget.forbiddenPublicImports) {
      if (matchesForbidden(source, forbidden)) {
        for (const file of [...(publicModuleFiles.get(moduleIdentity) ?? [])].sort()) {
          violations.push(
            `public import closure contains forbidden module ${forbidden} via ${moduleIdentity} in ${file}`,
          );
        }
      }
    }
  }
  for (const { ownerStyle, marker } of [...budget.roleCssMarkers].sort(
    (left, right) =>
      left.ownerStyle.localeCompare(right.ownerStyle) || left.marker.localeCompare(right.marker),
  )) {
    const ownerKey = resolveManifestEntry(manifest, ownerStyle);
    const ownerFile = manifest[ownerKey].file;
    if (extname(ownerFile).toLowerCase() !== ".css") {
      throw new Error(`configured role style ${ownerStyle} did not emit CSS: ${ownerFile}`);
    }
    const ownerContents = readFileSync(resolve(buildDirectory, ownerFile), "utf8");
    const occurrences = ownerContents.split(marker).length - 1;
    if (occurrences !== 1) {
      violations.push(
        `role CSS marker ${marker} must occur exactly once in ${ownerStyle}; found ${occurrences} in ${ownerFile}`,
      );
    }
  }
  for (const file of [...publicCss].sort()) {
    const contents = readFileSync(resolve(buildDirectory, file), "utf8");
    for (const marker of budget.roleCssMarkers.map(({ marker }) => marker).sort()) {
      if (contents.includes(marker)) {
        violations.push(`public CSS closure contains forbidden role marker ${marker} in ${file}`);
      }
    }
  }
  for (const name of Object.keys(metrics).sort() as Array<keyof typeof metrics>) {
    violations.push(...limitViolations(name, metrics[name], budget.limits[name]));
  }

  return {
    schemaVersion: 1,
    manifestPath: normalizePath(relative(projectRoot, manifestPath)),
    moduleMetadataPath: normalizePath(relative(projectRoot, moduleMetadataPath)),
    publicEntries: [...budget.publicEntries].sort(),
    publicImports: [...publicImports].sort(),
    publicModules: [...publicModules].sort(),
    publicRouteShells: [...publicRouteShells].sort(),
    forbiddenPublicImports: [...budget.forbiddenPublicImports].sort(),
    roleCssMarkers: [...budget.roleCssMarkers].sort(
      (left, right) =>
        left.ownerStyle.localeCompare(right.ownerStyle) || left.marker.localeCompare(right.marker),
    ),
    metrics,
    limits: budget.limits,
    violations: [...new Set(violations)].sort(),
  };
}

function main(): void {
  const projectRoot = resolve(import.meta.dir, "../..");
  const outputPath = resolve(projectRoot, "artifacts/ui-audit/current/bundle-manifest.json");
  const analysis = analyzeBundle({ projectRoot });
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(analysis, null, 2)}\n`);
  if (analysis.violations.length > 0) {
    throw new Error(
      `Bundle budget failed:\n${analysis.violations.join("\n")}\nEvidence: ${normalizePath(relative(projectRoot, outputPath))}`,
    );
  }
  console.log(
    `Bundle budget passed: public JS ${analysis.metrics.publicJavaScript.rawBytes} raw / ${analysis.metrics.publicJavaScript.gzipBytes} gzip; public CSS ${analysis.metrics.publicCss.rawBytes} raw / ${analysis.metrics.publicCss.gzipBytes} gzip; root CSS ${analysis.metrics.rootCss.rawBytes} raw / ${analysis.metrics.rootCss.gzipBytes} gzip; largest route chunk ${analysis.metrics.routeChunk.rawBytes} raw / ${analysis.metrics.routeChunk.gzipBytes} gzip; fonts ${analysis.metrics.totalFonts.rawBytes} raw / ${analysis.metrics.totalFonts.gzipBytes} gzip`,
  );
}

if (import.meta.main) main();
