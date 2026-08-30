import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildStaticAssetCache,
  isPrivateStaticPath,
  prepareStaticResponse,
  serveStatic,
} from "../../scripts/serve-production.mjs";

const css = Buffer.from(".card{color:#123456;background:#ffffff}".repeat(200));

describe("production static compression", () => {
  test("prefers the best supported encoding and preserves the response contract", () => {
    const response = prepareStaticResponse({
      asset: { identity: css, br: Buffer.from("brotli"), gzip: Buffer.from("gzip") },
      contentType: "text/css; charset=utf-8",
      cacheControl: "public, max-age=31536000, immutable",
      acceptEncoding: "gzip;q=0.8, br;q=1",
      method: "GET",
    });

    expect(response.headers).toMatchObject({
      "content-type": "text/css; charset=utf-8",
      "content-encoding": "br",
      vary: "Accept-Encoding",
      "cache-control": "public, max-age=31536000, immutable",
      "content-length": response.body.length,
    });
    expect(response.body).toEqual(Buffer.from("brotli"));
  });

  test("honors quality exclusions and negotiates gzip", () => {
    const response = prepareStaticResponse({
      asset: {
        identity: css,
        gzip: Buffer.from("gzip"),
      },
      contentType: "text/javascript; charset=utf-8",
      cacheControl: "public, max-age=3600",
      acceptEncoding: "br;q=0, gzip;q=0.5, identity;q=0.1",
      method: "GET",
    });

    expect(response.headers["content-encoding"]).toBe("gzip");
    expect(response.body).toEqual(Buffer.from("gzip"));
  });

  test("HEAD reports the encoded GET length without sending a body", () => {
    const get = prepareStaticResponse({
      asset: { identity: css, br: Buffer.from("brotli") },
      contentType: "text/css; charset=utf-8",
      cacheControl: "public, max-age=3600",
      acceptEncoding: "br",
      method: "GET",
    });
    const head = prepareStaticResponse({
      asset: { identity: css, br: Buffer.from("brotli") },
      contentType: "text/css; charset=utf-8",
      cacheControl: "public, max-age=3600",
      acceptEncoding: "br",
      method: "HEAD",
    });

    expect(head.body).toBeUndefined();
    expect(head.headers["content-length"]).toBe(get.body.length);
    expect(head.headers["content-encoding"]).toBe("br");
    expect(head.headers.vary).toBe("Accept-Encoding");
  });

  test("uses identity when it has the highest quality and returns 406 when none is acceptable", () => {
    const response = prepareStaticResponse({
      asset: { identity: css, br: Buffer.from("brotli"), gzip: Buffer.from("gzip") },
      contentType: "application/json; charset=utf-8",
      cacheControl: "public, max-age=3600",
      acceptEncoding: "br;q=0.3, gzip;q=0.5",
      method: "GET",
    });

    expect(response.body).toEqual(css);
    expect(response.headers["content-encoding"]).toBeUndefined();
    expect(response.headers["content-length"]).toBe(css.length);
    expect(response.headers.vary).toBe("Accept-Encoding");

    const unacceptable = prepareStaticResponse({
      asset: { identity: css, br: Buffer.from("brotli"), gzip: Buffer.from("gzip") },
      contentType: "application/json; charset=utf-8",
      cacheControl: "public, max-age=3600",
      acceptEncoding: "br;q=0, gzip;q=0, identity;q=0, *;q=0",
      method: "GET",
    });
    expect(unacceptable.status).toBe(406);
    expect(unacceptable.body).toBeUndefined();
  });

  test("honors wildcard and explicit identity exclusions", () => {
    const wildcard = prepareStaticResponse({
      asset: { identity: css, br: Buffer.from("brotli"), gzip: Buffer.from("gzip") },
      contentType: "text/css; charset=utf-8",
      cacheControl: "public, max-age=3600",
      acceptEncoding: "*;q=0.7, identity;q=0",
      method: "GET",
    });
    expect(wildcard.headers["content-encoding"]).toBe("br");

    const explicitGzipZero = prepareStaticResponse({
      asset: { identity: css, br: Buffer.from("brotli"), gzip: Buffer.from("gzip") },
      contentType: "text/css; charset=utf-8",
      cacheControl: "public, max-age=3600",
      acceptEncoding: "gzip;q=0, *;q=0.5, identity;q=0",
      method: "GET",
    });
    expect(explicitGzipZero.headers["content-encoding"]).toBe("br");
  });

  test("does not compress opaque media or advertise encoding variance", () => {
    const image = Buffer.alloc(128, 9);
    const response = prepareStaticResponse({
      asset: { identity: image },
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
      acceptEncoding: "br, gzip",
      method: "GET",
    });

    expect(response.body).toEqual(image);
    expect(response.headers["content-encoding"]).toBeUndefined();
    expect(response.headers.vary).toBeUndefined();
  });

  test("supports byte ranges against the selected cached representation", () => {
    const response = prepareStaticResponse({
      asset: { identity: Buffer.from("0123456789") },
      contentType: "application/octet-stream",
      cacheControl: "public, max-age=3600",
      acceptEncoding: "identity",
      range: "bytes=2-5",
      method: "GET",
    });

    expect(response.status).toBe(206);
    expect(response.headers["content-range"]).toBe("bytes 2-5/10");
    expect(response.headers["content-length"]).toBe(4);
    expect(response.body).toEqual(Buffer.from("2345"));
  });

  test("precompresses asynchronously with bounded concurrency and never compresses on HEAD", async () => {
    const root = await mkdtemp(join(tmpdir(), "cc-static-cache-"));
    try {
      await mkdir(join(root, "assets"));
      await Promise.all([
        writeFile(join(root, "assets/a.css"), css),
        writeFile(join(root, "assets/b.js"), css),
        writeFile(join(root, "assets/c.svg"), css),
      ]);
      let active = 0;
      let maximumActive = 0;
      let calls = 0;
      const compress = async (contents) => {
        calls += 1;
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return Buffer.from(contents.subarray(0, 8));
      };

      const cachePromise = buildStaticAssetCache(root, {
        concurrency: 2,
        compressors: { br: compress, gzip: compress },
      });
      expect(calls).toBe(0);
      const cache = await cachePromise;
      expect(maximumActive).toBe(2);
      expect(calls).toBe(6);

      const beforeHead = calls;
      const head = prepareStaticResponse({
        asset: cache.get("/assets/a.css").variants,
        contentType: "text/css; charset=utf-8",
        cacheControl: "public, max-age=31536000, immutable",
        acceptEncoding: "br",
        method: "HEAD",
      });
      expect(head.body).toBeUndefined();
      expect(calls).toBe(beforeHead);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("keeps Vite and dot-prefixed build metadata private", () => {
    expect(isPrivateStaticPath("/.vite/manifest.json")).toBe(true);
    expect(isPrivateStaticPath("/assets/.private/chunks.json")).toBe(true);
    expect(isPrivateStaticPath("/assets/app.js")).toBe(false);
  });

  test("returns 404 for private build metadata while leaving API paths to SSR", async () => {
    const writes = [];
    const response = {
      writeHead: (status, headers) => writes.push({ status, headers }),
      end: (body) => writes.push({ body }),
    };
    const request = { method: "GET", headers: {} };

    expect(await serveStatic("/.vite/manifest.json", request, response, new Map())).toBe(true);
    expect(writes[0].status).toBe(404);
    expect(writes[1].body).toBe("Not Found");
    expect(await serveStatic("/api/health", request, response, new Map())).toBe(false);
  });
});
