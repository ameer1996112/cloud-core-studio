export const SUPABASE_ACCESS_TOKEN_COOKIE = "cc_sb_access_token";
export const SUPABASE_REFRESH_TOKEN_COOKIE = "cc_sb_refresh_token";
const REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS = 60 * 24 * 60 * 60;

type SupabaseSessionLike = {
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: number | null;
  expires_in?: number | null;
} | null;

function cookieSecureFlag() {
  return typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
}

export function getAccessTokenCookieMaxAgeSeconds(session: SupabaseSessionLike) {
  if (!session?.access_token) return 0;

  const expiresIn =
    typeof session.expires_in === "number" && Number.isFinite(session.expires_in)
      ? session.expires_in
      : null;
  const expiresAt =
    typeof session.expires_at === "number" && Number.isFinite(session.expires_at)
      ? session.expires_at
      : null;

  const maxAgeFromExpiresAt = expiresAt ? expiresAt - Math.floor(Date.now() / 1000) : null;
  const candidates = [
    ...(expiresIn !== null ? [expiresIn] : []),
    ...(maxAgeFromExpiresAt !== null ? [maxAgeFromExpiresAt] : []),
  ];
  const maxAge = candidates.length > 0 ? Math.min(...candidates) : 3600;

  return Math.max(0, Math.floor(Number.isFinite(maxAge) ? maxAge : 0));
}

export function writeSupabaseAccessTokenCookie(token: string, maxAgeSeconds = 3600) {
  if (typeof document === "undefined") return;
  document.cookie = [
    `${SUPABASE_ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
    "SameSite=Lax",
    cookieSecureFlag().replace(/^; /, ""),
  ]
    .filter(Boolean)
    .join("; ");
}

function writeSupabaseRefreshTokenCookie(token: string) {
  if (typeof document === "undefined") return;
  document.cookie = [
    `${SUPABASE_REFRESH_TOKEN_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    cookieSecureFlag().replace(/^; /, ""),
  ]
    .filter(Boolean)
    .join("; ");
}

export function readSupabaseRefreshTokenCookie() {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SUPABASE_REFRESH_TOKEN_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(SUPABASE_REFRESH_TOKEN_COOKIE.length + 1)) : null;
}

export function syncSupabaseAccessTokenCookie(session: SupabaseSessionLike) {
  const token = session?.access_token;
  if (!token) {
    clearSupabaseAccessTokenCookie();
    return;
  }

  writeSupabaseAccessTokenCookie(token, getAccessTokenCookieMaxAgeSeconds(session));
  if (session?.refresh_token) writeSupabaseRefreshTokenCookie(session.refresh_token);
}

export function clearSupabaseAccessTokenCookie() {
  if (typeof document === "undefined") return;
  for (const name of [SUPABASE_ACCESS_TOKEN_COOKIE, SUPABASE_REFRESH_TOKEN_COOKIE]) {
    document.cookie = [
      `${name}=`,
      "Path=/",
      "Max-Age=0",
      "SameSite=Lax",
      cookieSecureFlag().replace(/^; /, ""),
    ]
      .filter(Boolean)
      .join("; ");
  }
}
