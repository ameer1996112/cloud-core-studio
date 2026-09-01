/**
 * Local-only server for authenticated member UI QA.
 * It deliberately refuses any remote Supabase or usable payment-provider configuration.
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { extname, join, normalize, resolve } from "node:path";
import { Readable } from "node:stream";
import { addSecurityHeaders } from "../security-headers.mjs";

const host = "127.0.0.1";
const loopbackSupabaseHosts = new Set(["127.0.0.1", "localhost", "::1"]);

function isLoopbackSupabaseUrl(value) {
  try {
    const url = new URL(value);
    return loopbackSupabaseHosts.has(url.hostname.toLowerCase().replace(/^\[|\]$/g, ""));
  } catch {
    return false;
  }
}

/**
 * Maps a local Supabase CLI public key to only the aliases the member app reads.
 * This is intentionally QA-runner-only: production runtime configuration is unchanged.
 */
export function resolveLocalQaSupabaseEnvironment(sourceEnvironment = process.env) {
  const url = sourceEnvironment.SUPABASE_URL || sourceEnvironment.API_URL;
  if (!url) throw new Error("member_ui_ux_qa_server_requires_local_supabase_url");
  if (!isLoopbackSupabaseUrl(url)) {
    throw new Error("member_ui_ux_qa_server_refuses_non_local_supabase");
  }

  for (const candidate of [
    sourceEnvironment.VITE_SUPABASE_URL,
    sourceEnvironment.NEXT_PUBLIC_SUPABASE_URL,
  ]) {
    if (candidate && !isLoopbackSupabaseUrl(candidate)) {
      throw new Error("member_ui_ux_qa_server_refuses_non_local_supabase");
    }
  }

  const serviceRoleKey =
    sourceEnvironment.SUPABASE_SERVICE_ROLE_KEY || sourceEnvironment.SERVICE_ROLE_KEY;
  const publicKey =
    sourceEnvironment.SUPABASE_PUBLISHABLE_KEY ||
    sourceEnvironment.PUBLISHABLE_KEY ||
    sourceEnvironment.SUPABASE_ANON_KEY ||
    sourceEnvironment.ANON_KEY ||
    sourceEnvironment.VITE_SUPABASE_PUBLISHABLE_KEY ||
    sourceEnvironment.VITE_SUPABASE_ANON_KEY ||
    sourceEnvironment.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!publicKey || publicKey === serviceRoleKey) {
    throw new Error("member_ui_ux_qa_server_requires_local_public_key");
  }

  const normalizedUrl = new URL(url).toString().replace(/\/$/, "");
  return {
    ...sourceEnvironment,
    SUPABASE_URL: normalizedUrl,
    SUPABASE_PUBLISHABLE_KEY: publicKey,
    SUPABASE_ANON_KEY: publicKey,
    VITE_SUPABASE_URL: normalizedUrl,
    VITE_SUPABASE_PUBLISHABLE_KEY: publicKey,
    VITE_SUPABASE_ANON_KEY: publicKey,
  };
}

export function validatePaymentQaEnvironment(environment) {
  if (
    environment.HYP_MODE !== "test" ||
    environment.HYP_TEST_API_USER ||
    environment.HYP_TEST_API_PASSWORD ||
    environment.HYP_TEST_TERMINAL_NUMBER
  ) {
    throw new Error("member_ui_ux_qa_server_requires_unconfigured_hyp_test_mode");
  }
}

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function qaHeaders(headers = {}, supabaseUrl) {
  const localOrigin = new URL(supabaseUrl).origin;
  return {
    ...addSecurityHeaders(headers),
    "content-security-policy": [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      `connect-src 'self' https: wss: ${localOrigin}`,
      "frame-src 'self' https:",
      "form-action 'self' https:",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
    ].join("; "),
  };
}

function toWebHeaders(headers) {
  const result = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((item) => result.append(key, item));
    else result.set(key, String(value));
  }
  return result;
}

function toNodeHeaders(headers) {
  const result = {};
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() !== "set-cookie") result[key] = value;
  }
  const cookies = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  if (cookies.length > 0) result["set-cookie"] = cookies;
  else if (headers.get("set-cookie")) result["set-cookie"] = headers.get("set-cookie");
  return result;
}

async function serveStatic(pathname, method, res, clientDir, supabaseUrl) {
  const filePath = normalize(join(clientDir, decodeURIComponent(pathname)));
  if (!filePath.startsWith(clientDir)) return false;
  try {
    const file = await stat(filePath);
    if (!file.isFile()) return false;
    res.writeHead(
      200,
      qaHeaders(
        {
          "content-length": file.size,
          "content-type": mimeTypes.get(extname(filePath)) ?? "application/octet-stream",
        },
        supabaseUrl,
      ),
    );
    if (method === "HEAD") res.end();
    else createReadStream(filePath).pipe(res);
    return true;
  } catch {
    return false;
  }
}

export async function startLocalQaServer({ environment = process.env, listenPort } = {}) {
  const qaEnvironment = resolveLocalQaSupabaseEnvironment(environment);
  validatePaymentQaEnvironment(qaEnvironment);
  const port = Number(listenPort || qaEnvironment.PORT || 4176);
  const root = resolve(process.cwd());
  const clientDir = join(root, "dist/client");
  // TanStack server functions resolve environment variables from process.env at import time.
  // These aliases are guarded local public-key values only; no service role is mapped here.
  Object.assign(process.env, {
    SUPABASE_URL: qaEnvironment.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: qaEnvironment.SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_ANON_KEY: qaEnvironment.SUPABASE_ANON_KEY,
    VITE_SUPABASE_URL: qaEnvironment.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: qaEnvironment.VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_ANON_KEY: qaEnvironment.VITE_SUPABASE_ANON_KEY,
  });
  const serverEntry = await import(join(root, "dist/server/server.js"));
  const handler = serverEntry.default;

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${host}:${port}`);
      if (
        await serveStatic(
          url.pathname,
          req.method || "GET",
          res,
          clientDir,
          qaEnvironment.SUPABASE_URL,
        )
      )
        return;
      const body = req.method === "GET" || req.method === "HEAD" ? undefined : Readable.toWeb(req);
      const response = await handler.fetch(
        new Request(url, {
          method: req.method,
          headers: toWebHeaders(req.headers),
          body,
          duplex: body ? "half" : undefined,
        }),
        qaEnvironment,
        {},
      );
      res.writeHead(
        response.status,
        qaHeaders(toNodeHeaders(response.headers), qaEnvironment.SUPABASE_URL),
      );
      if (response.body && req.method !== "HEAD") Readable.fromWeb(response.body).pipe(res);
      else res.end();
    } catch {
      res.writeHead(
        500,
        qaHeaders({ "content-type": "text/plain; charset=utf-8" }, qaEnvironment.SUPABASE_URL),
      );
      res.end("Internal Server Error");
    }
  }).listen(port, host, () => console.log(`member-ui-ux-qa-local-server:${host}:${port}`));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await startLocalQaServer();
}
