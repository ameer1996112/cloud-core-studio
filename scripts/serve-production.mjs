import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { Readable } from "node:stream";

import { addSecurityHeaders } from "./security-headers.mjs";

const root = resolve(process.cwd());
const clientDir = join(root, "dist/client");
const serverEntry = await import(join(root, "dist/server/server.js"));
const handler = serverEntry.default;
const port = Number(process.env.PORT || 8080);

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
    if (Array.isArray(value)) {
      for (const item of value) out.append(key, item);
    } else {
      out.set(key, String(value));
    }
  }
  return out;
}

function toNodeHeaders(headers) {
  const out = {};
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() !== "set-cookie") out[key] = value;
  }

  const setCookies = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  if (setCookies.length > 0) {
    out["set-cookie"] = setCookies;
  } else {
    const setCookie = headers.get("set-cookie");
    if (setCookie) out["set-cookie"] = setCookie;
  }

  return out;
}

function requestUrl(req) {
  const proto = req.headers["x-forwarded-proto"] ?? "http";
  const host = req.headers.host ?? `localhost:${port}`;
  return `${Array.isArray(proto) ? proto[0] : proto}://${host}${req.url ?? "/"}`;
}

async function serveStatic(pathname, method, res) {
  const decoded = decodeURIComponent(pathname);
  const filePath = normalize(join(clientDir, decoded));
  if (!filePath.startsWith(clientDir)) return false;

  try {
    const file = await stat(filePath);
    if (!file.isFile()) return false;
    const ext = extname(filePath);
    res.writeHead(
      200,
      addSecurityHeaders({
        "content-length": file.size,
        "content-type": mimeTypes.get(ext) ?? "application/octet-stream",
        "cache-control": decoded.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "public, max-age=3600",
      }),
    );
    if (method === "HEAD") {
      res.end();
      return true;
    }
    createReadStream(filePath).pipe(res);
    return true;
  } catch {
    return false;
  }
}

createServer(async (req, res) => {
  try {
    const url = new URL(requestUrl(req));
    if (await serveStatic(url.pathname, req.method, res)) return;

    const body = req.method === "GET" || req.method === "HEAD" ? undefined : Readable.toWeb(req);
    const requestInit = {
      method: req.method,
      headers: toWebHeaders(req.headers),
      body,
    };
    if (body) requestInit.duplex = "half";

    const request = new Request(url, requestInit);

    const response = await handler.fetch(request, process.env, {});
    res.writeHead(response.status, addSecurityHeaders(toNodeHeaders(response.headers)));
    if (response.body && req.method !== "HEAD") {
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error(error);
    res.writeHead(500, addSecurityHeaders({ "content-type": "text/plain; charset=utf-8" }));
    res.end("Internal Server Error");
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`Cloud & Core listening on ${port}`);
});
