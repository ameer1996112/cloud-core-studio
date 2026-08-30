import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, relative, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { brotliCompress, constants as zlibConstants, gzip } from "node:zlib";

import { addSecurityHeaders } from "./security-headers.mjs";

const root = resolve(process.cwd());
const clientDir = join(root, "dist/client");
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function toWebHeaders(headers) {
  const out = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const item of value) out.append(key, item);
    else out.set(key, String(value));
  }
  return out;
}

function toNodeHeaders(headers) {
  const out = {};
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() !== "set-cookie") out[key] = value;
  }
  const setCookies = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  if (setCookies.length > 0) out["set-cookie"] = setCookies;
  else if (headers.get("set-cookie")) out["set-cookie"] = headers.get("set-cookie");
  return out;
}

function requestUrl(req, port) {
  const proto = req.headers["x-forwarded-proto"] ?? "http";
  const host = req.headers.host ?? `localhost:${port}`;
  return `${Array.isArray(proto) ? proto[0] : proto}://${host}${req.url ?? "/"}`;
}

function parseAcceptedEncodings(value) {
  const qualities = new Map();
  for (const token of String(value ?? "").split(",")) {
    const [rawName, ...parameters] = token.trim().toLowerCase().split(";");
    if (!rawName) continue;
    const parameter = parameters.find((item) => item.trim().startsWith("q="));
    const parsed = parameter ? Number(parameter.trim().slice(2)) : 1;
    const quality = Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0;
    if (!qualities.has(rawName)) qualities.set(rawName, quality);
  }
  return qualities;
}

function qualityForEncoding(qualities, encoding) {
  if (qualities.has(encoding)) return qualities.get(encoding);
  if (encoding === "identity") return qualities.get("*") === 0 ? 0 : 1;
  return qualities.get("*") ?? 0;
}

function compressible(contentType) {
  const mime = contentType.split(";", 1)[0].trim().toLowerCase();
  return (
    mime.startsWith("text/") ||
    [
      "application/javascript",
      "application/json",
      "application/manifest+json",
      "application/xml",
      "image/svg+xml",
    ].includes(mime)
  );
}

const defaultCompressors = {
  br: (contents) =>
    new Promise((resolvePromise, reject) =>
      brotliCompress(
        contents,
        { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 6 } },
        (error, result) => (error ? reject(error) : resolvePromise(result)),
      ),
    ),
  gzip: (contents) =>
    new Promise((resolvePromise, reject) =>
      gzip(contents, { level: 9 }, (error, result) =>
        error ? reject(error) : resolvePromise(result),
      ),
    ),
};

async function listStaticFiles(directory) {
  const files = [];
  const visit = async (current) => {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  };
  await visit(directory);
  return files;
}

export function isPrivateStaticPath(pathname) {
  return pathname
    .split("/")
    .filter(Boolean)
    .some((segment) => segment.startsWith("."));
}

export async function buildStaticAssetCache(
  directory = clientDir,
  { compressors = defaultCompressors, concurrency = 4 } = {},
) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("static compression concurrency must be a positive integer");
  }
  const files = await listStaticFiles(directory);
  const cache = new Map();
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < files.length) {
      const absolute = files[nextIndex++];
      const pathname = `/${relative(directory, absolute).split(sep).join("/")}`;
      if (isPrivateStaticPath(pathname)) continue;
      const identity = await readFile(absolute);
      const contentType = mimeTypes.get(extname(absolute)) ?? "application/octet-stream";
      const variants = { identity };
      if (compressible(contentType)) {
        for (const encoding of ["br", "gzip"]) {
          try {
            variants[encoding] = Buffer.from(await compressors[encoding](identity));
          } catch {
            // Identity remains available when a platform compressor is unavailable.
          }
        }
      }
      cache.set(pathname, {
        contentType,
        cacheControl: pathname.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "public, max-age=3600",
        variants,
      });
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, () => worker()));
  return cache;
}

function selectRepresentation(asset, acceptEncoding) {
  const qualities = parseAcceptedEncodings(acceptEncoding);
  return [
    { name: "br", preference: 3 },
    { name: "gzip", preference: 2 },
    { name: "identity", preference: 1 },
  ]
    .filter(({ name }) => asset[name])
    .map((candidate) => ({ ...candidate, quality: qualityForEncoding(qualities, candidate.name) }))
    .filter(({ quality }) => quality > 0)
    .sort((left, right) => right.quality - left.quality || right.preference - left.preference)[0]
    ?.name;
}

function parseRange(value, length) {
  if (!value) return undefined;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return null;
  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, length - suffixLength);
    end = length - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : length - 1;
  }
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < start ||
    start >= length
  )
    return null;
  return { start, end: Math.min(end, length - 1) };
}

export function prepareStaticResponse({
  asset,
  contentType,
  cacheControl,
  acceptEncoding,
  range,
  method,
}) {
  const varies = Boolean(asset.br || asset.gzip);
  const encoding = selectRepresentation(asset, acceptEncoding);
  const baseHeaders = {
    "content-type": contentType,
    "cache-control": cacheControl,
    "accept-ranges": "bytes",
    ...(varies ? { vary: "Accept-Encoding" } : {}),
  };
  if (!encoding) return { status: 406, headers: { ...baseHeaders, "content-length": 0 } };

  const encoded = asset[encoding];
  const selectedRange = parseRange(range, encoded.byteLength);
  if (selectedRange === null) {
    return {
      status: 416,
      headers: {
        ...baseHeaders,
        "content-range": `bytes */${encoded.byteLength}`,
        "content-length": 0,
        ...(encoding !== "identity" ? { "content-encoding": encoding } : {}),
      },
    };
  }
  const body = selectedRange
    ? encoded.subarray(selectedRange.start, selectedRange.end + 1)
    : encoded;
  return {
    status: selectedRange ? 206 : 200,
    headers: {
      ...baseHeaders,
      "content-length": body.byteLength,
      ...(encoding !== "identity" ? { "content-encoding": encoding } : {}),
      ...(selectedRange
        ? {
            "content-range": `bytes ${selectedRange.start}-${selectedRange.end}/${encoded.byteLength}`,
          }
        : {}),
    },
    body: method === "HEAD" ? undefined : body,
  };
}

export async function serveStatic(pathname, req, res, cache) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  if (isPrivateStaticPath(decoded)) {
    res.writeHead(404, addSecurityHeaders({ "content-type": "text/plain; charset=utf-8" }));
    res.end("Not Found");
    return true;
  }
  const cached = cache.get(decoded);
  if (!cached) return false;
  const response = prepareStaticResponse({
    asset: cached.variants,
    contentType: cached.contentType,
    cacheControl: cached.cacheControl,
    acceptEncoding: req.headers["accept-encoding"],
    range: req.headers.range,
    method: req.method,
  });
  res.writeHead(response.status, addSecurityHeaders(response.headers));
  res.end(response.body);
  return true;
}

export async function startProductionServer() {
  const [serverEntry, staticCache] = await Promise.all([
    import(join(root, "dist/server/server.js")),
    buildStaticAssetCache(clientDir),
  ]);
  const handler = serverEntry.default;
  const port = Number(process.env.PORT || 8080);
  const host = process.env.HOST || "0.0.0.0";

  return createServer(async (req, res) => {
    try {
      const url = new URL(requestUrl(req, port));
      if (await serveStatic(url.pathname, req, res, staticCache)) return;
      const body = req.method === "GET" || req.method === "HEAD" ? undefined : Readable.toWeb(req);
      const requestInit = { method: req.method, headers: toWebHeaders(req.headers), body };
      if (body) requestInit.duplex = "half";
      const response = await handler.fetch(new Request(url, requestInit), process.env, {});
      res.writeHead(response.status, addSecurityHeaders(toNodeHeaders(response.headers)));
      if (response.body && req.method !== "HEAD") Readable.fromWeb(response.body).pipe(res);
      else res.end();
    } catch (error) {
      console.error(error);
      res.writeHead(500, addSecurityHeaders({ "content-type": "text/plain; charset=utf-8" }));
      res.end("Internal Server Error");
    }
  }).listen(port, host, () => console.log(`Cloud & Core listening on ${host}:${port}`));
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) await startProductionServer();
