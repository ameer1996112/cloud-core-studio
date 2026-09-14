const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https:",
  "form-action 'self' https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

export const SECURITY_HEADERS = Object.freeze({
  "content-security-policy": CONTENT_SECURITY_POLICY,
  "cross-origin-opener-policy": "same-origin-allow-popups",
  "permissions-policy": "camera=(), geolocation=(), microphone=(), payment=(self)",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=31536000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
});

export function addSecurityHeaders(headers = {}) {
  const result = { ...headers, ...SECURITY_HEADERS };
  // Health pages require the stricter policy supplied by the application.
  if (
    Object.entries(headers).some(
      ([name, value]) => name.toLowerCase() === "referrer-policy" && value === "no-referrer",
    )
  ) {
    for (const name of Object.keys(result)) {
      if (name.toLowerCase() === "referrer-policy") delete result[name];
    }
    result["referrer-policy"] = "no-referrer";
  }
  return result;
}
