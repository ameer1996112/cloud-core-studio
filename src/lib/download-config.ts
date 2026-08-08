export const DEFAULT_APP_STORE_URL = "https://apps.apple.com/il/app/cloud-core/id6786035836";

const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_PARAM_NAMES = ["fbclid", "gclid", "igshid"];

export type DownloadClient = "ios" | "android" | "desktop" | "meta-in-app-browser";

export type DownloadConfig = {
  appStoreUrl: string;
  googlePlayUrl: string;
};

export function getDownloadConfig(): DownloadConfig {
  return {
    appStoreUrl: readEnv("APP_STORE_URL") || readEnv("VITE_APP_STORE_URL") || DEFAULT_APP_STORE_URL,
    googlePlayUrl: readEnv("GOOGLE_PLAY_URL") || readEnv("VITE_GOOGLE_PLAY_URL") || "",
  };
}

export function detectDownloadClient(userAgent: string): DownloadClient {
  const ua = userAgent.toLowerCase();
  if (/\binstagram\b|\bfban\b|\bfbav\b|\bfb_iab\b|\bmessenger\b/.test(ua)) {
    return "meta-in-app-browser";
  }
  if (/\b(iphone|ipad|ipod)\b/.test(ua)) return "ios";
  if (ua.includes("android")) return "android";
  return "desktop";
}

export function appendTrackingParams(storeUrl: string, search: string): string {
  if (!storeUrl) return storeUrl;

  let url: URL;
  try {
    url = new URL(storeUrl);
  } catch {
    return storeUrl;
  }

  const params = new URLSearchParams(search);
  for (const [key, value] of params.entries()) {
    if (!isTrackingParam(key) || url.searchParams.has(key)) continue;
    url.searchParams.append(key, value);
  }

  return url.toString();
}

export function buildNativeAppStoreUrl(storeUrl: string): string {
  let url: URL;
  try {
    url = new URL(storeUrl);
  } catch {
    return storeUrl;
  }

  if (url.protocol !== "https:" || url.hostname !== "apps.apple.com") return storeUrl;
  return "itms-appss://" + url.host + url.pathname + url.search + url.hash;
}

function isTrackingParam(key: string) {
  const normalized = key.toLowerCase();
  return (
    TRACKING_PARAM_NAMES.includes(normalized) ||
    TRACKING_PARAM_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  );
}

function readEnv(key: string) {
  const viteValue = import.meta.env[key];
  if (typeof viteValue === "string" && viteValue.trim()) return viteValue.trim();

  if (typeof process !== "undefined") {
    const processValue = process.env[key];
    if (typeof processValue === "string" && processValue.trim()) return processValue.trim();
  }

  return "";
}
