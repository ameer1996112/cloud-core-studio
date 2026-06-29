export const SUPABASE_ACCESS_TOKEN_COOKIE = "cc_sb_access_token";

function cookieSecureFlag() {
  return typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
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

export function clearSupabaseAccessTokenCookie() {
  if (typeof document === "undefined") return;
  document.cookie = [
    `${SUPABASE_ACCESS_TOKEN_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "SameSite=Lax",
    cookieSecureFlag().replace(/^; /, ""),
  ]
    .filter(Boolean)
    .join("; ");
}
