import { mkdirSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import type { Plugin } from "vite";

type BundleModule = {
  renderedLength: number;
  renderedExports: readonly string[];
};

type BundleEntry = { type: "chunk"; modules: Record<string, BundleModule> } | { type: string };

export type ClientModuleMetadata = {
  schemaVersion: 1;
  chunks: Record<string, Array<{ id: string; renderedBytes: number; renderedExports: string[] }>>;
};

function splitSuffix(value: string): { pathname: string; suffix: string } {
  const suffixIndex = value.search(/[?#]/);
  return suffixIndex === -1
    ? { pathname: value, suffix: "" }
    : { pathname: value.slice(0, suffixIndex), suffix: value.slice(suffixIndex) };
}

function slashPath(value: string): string {
  return value.replaceAll("\\", "/");
}

function normalizedRoot(value: string): string {
  const normalized = slashPath(value);
  if (normalized === "/" || /^[A-Za-z]:\/$/.test(normalized)) return normalized;
  return normalized.replace(/\/+$/, "");
}

export function normalizeViteModuleId(projectRoot: string, id: string): string {
  const withoutVirtualPrefix = id.replace(/^\0+/, "");
  const { pathname: rawPathname, suffix } = splitSuffix(withoutVirtualPrefix);
  const root = normalizedRoot(projectRoot);
  let pathname = slashPath(rawPathname);
  const uncRoot = /^\/\/([^/]+)\/([^/]+)(?:\/|$)/.exec(root);
  if (uncRoot && pathname.startsWith("/") && !pathname.startsWith("//")) {
    const viteUncAuthority = `/${uncRoot[1]}/${uncRoot[2]}`;
    const comparablePathname = pathname.toLowerCase();
    const comparableAuthority = viteUncAuthority.toLowerCase();
    if (
      comparablePathname === comparableAuthority ||
      comparablePathname.startsWith(`${comparableAuthority}/`)
    ) {
      pathname = `/${pathname}`;
    }
  }
  const windowsRoot = /^[A-Za-z]:\//.test(root) || Boolean(uncRoot);
  const comparableRoot = windowsRoot ? root.toLowerCase() : root;
  const comparablePathname = windowsRoot ? pathname.toLowerCase() : pathname;
  const rootPrefix = root.endsWith("/") ? root : `${root}/`;
  const comparablePrefix = windowsRoot ? rootPrefix.toLowerCase() : rootPrefix;
  const relativePath =
    comparablePathname === comparableRoot
      ? ""
      : comparablePathname.startsWith(comparablePrefix)
        ? pathname.slice(rootPrefix.length)
        : pathname;
  return `${relativePath}${suffix}`;
}

export function buildClientModuleMetadata(
  projectRoot: string,
  bundle: Record<string, BundleEntry>,
): ClientModuleMetadata {
  const chunks = Object.fromEntries(
    Object.entries(bundle)
      .filter(
        (entry): entry is [string, Extract<BundleEntry, { type: "chunk" }>] =>
          entry[1].type === "chunk",
      )
      .map(([file, chunk]) => [
        file,
        Object.entries(chunk.modules)
          .map(([id, module]) => ({
            id: normalizeViteModuleId(projectRoot, id),
            renderedBytes: module.renderedLength,
            renderedExports: [...module.renderedExports].sort(),
          }))
          .sort((left, right) => left.id.localeCompare(right.id)),
      ])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  return { schemaVersion: 1, chunks };
}

export function clientModuleMetadata(projectRoot: string): Plugin {
  return {
    name: "cloud-core-client-module-metadata",
    apply: "build",
    writeBundle(options, bundle) {
      if (!options.dir || basename(options.dir) !== "client") return;
      const outputDirectory = resolve(options.dir, "../audit");
      mkdirSync(outputDirectory, { recursive: true });
      writeFileSync(
        resolve(outputDirectory, "client-modules.json"),
        `${JSON.stringify(buildClientModuleMetadata(projectRoot, bundle), null, 2)}\n`,
      );
    },
  };
}
