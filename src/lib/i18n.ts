import { useSyncExternalStore } from "react";

import type { adminCatalog } from "./i18n/catalogs/admin";
import { coreCatalog } from "./i18n/catalogs/core";
import type { instructorCatalog } from "./i18n/catalogs/instructor";
import type { memberCatalog } from "./i18n/catalogs/member";
import { createI18nRuntime } from "./i18n/runtime";
import type { I18nParams, Lang, MessageNamespace, RoleMessageNamespace } from "./i18n/types";

export type { Lang } from "./i18n/types";

export const LANG_KEY = "cc_lang";
export const LANG_COOKIE = "cc_lang";

/** Default app locale. Israeli studio launch defaults to Hebrew. */
export const DEFAULT_LOCALE: Lang = "he";

export const LANG_META: Record<Lang, { label: string; dir: "ltr" | "rtl" }> = {
  en: { label: "English", dir: "ltr" },
  he: { label: "עברית", dir: "rtl" },
  ar: { label: "العربية", dir: "rtl" },
};

export type MessageKey =
  | keyof typeof coreCatalog.he
  | keyof typeof memberCatalog.he
  | keyof typeof instructorCatalog.he
  | keyof typeof adminCatalog.he;
type Params = I18nParams;
const listeners = new Set<() => void>();
let activeLang: Lang = DEFAULT_LOCALE;

export const MESSAGES: Record<Lang, Partial<Record<MessageKey, string>>> = {
  en: { ...coreCatalog.en },
  he: { ...coreCatalog.he },
  ar: { ...coreCatalog.ar },
};

const runtime = createI18nRuntime({
  language: activeLang,
  core: coreCatalog,
  onNamespaceLoaded: (_namespace, catalog) => {
    Object.assign(MESSAGES.en, catalog.en);
    Object.assign(MESSAGES.he, catalog.he);
    Object.assign(MESSAGES.ar, catalog.ar);
  },
});

const namespaceReadiness = new Map<RoleMessageNamespace, Promise<void>>();

export function i18nNamespaceReady(namespace: RoleMessageNamespace): Promise<void> {
  const existing = namespaceReadiness.get(namespace);
  if (existing) return existing;
  const readiness = runtime.ensureNamespaces([namespace]).catch((error: unknown) => {
    namespaceReadiness.delete(namespace);
    throw error;
  });
  namespaceReadiness.set(namespace, readiness);
  return readiness;
}

export async function ensureI18nNamespaces(namespaces: readonly RoleMessageNamespace[]) {
  await Promise.all(namespaces.map(i18nNamespaceReady));
}

export function loadedI18nNamespaces(): MessageNamespace[] {
  return runtime.loadedNamespaces();
}

export function readSupportedLang(value: unknown): Lang | null {
  return value === "he" || value === "ar" || value === "en" ? value : null;
}

export function readLangCookieHeader(cookieHeader: string | null): Lang | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LANG_COOKIE}=`));
  return match ? readSupportedLang(decodeURIComponent(match.slice(LANG_COOKIE.length + 1))) : null;
}

function normalizeLang(lang: Lang | string | null | undefined): Lang {
  return readSupportedLang(lang) ?? DEFAULT_LOCALE;
}

function readStoredLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(LANG_KEY);
  if (stored) return normalizeLang(stored);
  const cookieMatch =
    typeof document !== "undefined" && typeof document.cookie === "string"
      ? document.cookie.match(new RegExp(`(?:^|; )${LANG_COOKIE}=([^;]+)`))
      : null;
  return normalizeLang(cookieMatch ? decodeURIComponent(cookieMatch[1]) : null);
}

/** Resolve writing direction for a locale. */
export function getDirection(lang: Lang | string | null | undefined): "ltr" | "rtl" {
  return LANG_META[normalizeLang(lang)].dir;
}

/** Returns the saved user preference if present, otherwise Hebrew. */
export function getStoredLang(): Lang {
  return readStoredLang();
}

export function getActiveLang(): Lang {
  return activeLang;
}

export function setActiveLang(lang: Lang | string | null | undefined) {
  activeLang = normalizeLang(lang);
  runtime.setLanguage(activeLang);
}

export function getLocale(): string {
  if (activeLang === "he") return "he-IL";
  if (activeLang === "ar") return "ar";
  return "en";
}

export function getBootLangScript() {
  return `(() => {
    try {
      const cookieMatch = document.cookie.match(/(?:^|; )${LANG_COOKIE}=([^;]+)/);
      const cookieLang = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
      const url = new URL(window.location.href);
      const requestedRouteLang = window.location.pathname === "/app" ? url.searchParams.get("lang") : null;
      const routeLang = requestedRouteLang === "en" || requestedRouteLang === "he" || requestedRouteLang === "ar"
        ? requestedRouteLang
        : null;
      const currentLang = document.documentElement.lang;
      const candidate = routeLang || cookieLang || currentLang || ${JSON.stringify(DEFAULT_LOCALE)};
      const next = candidate === "en" || candidate === "he" || candidate === "ar"
        ? candidate
        : ${JSON.stringify(DEFAULT_LOCALE)};
      document.documentElement.lang = next;
      document.documentElement.dir = next === "en" ? "ltr" : "rtl";
      window.__ccBootLang = next;
    } catch (_) {}
  })();`;
}

export function applyLang(lang: Lang) {
  const next = normalizeLang(lang);
  activeLang = next;
  runtime.setLanguage(next);
  if (typeof window !== "undefined") {
    (window as typeof window & { __ccBootLang?: Lang }).__ccBootLang = next;
  }
  if (typeof document !== "undefined") {
    const isSecure =
      typeof window !== "undefined" &&
      typeof window.location?.protocol === "string" &&
      window.location.protocol === "https:";
    document.documentElement.lang = next;
    document.documentElement.dir = getDirection(next);
    document.cookie = [
      `${LANG_COOKIE}=${encodeURIComponent(next)}`,
      "Path=/",
      "Max-Age=31536000",
      "SameSite=Lax",
      isSecure ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ");
  }
  if (typeof window !== "undefined") window.localStorage.setItem(LANG_KEY, next);
  listeners.forEach((listener) => listener());
}

export function t(key: MessageKey, params?: Params): string {
  return runtime.t(key, params);
}

export function tForLang(lang: Lang, key: MessageKey, params?: Params): string {
  return runtime.tForLanguage(lang, key, params);
}

export function labelForStatus(status: string | null | undefined): string {
  if (!status) return "—";
  const key = `status.${status}` as MessageKey;
  const translated = runtime.t(key);
  return translated || status.replace(/_/g, " ");
}

export function labelForMethod(method: string | null | undefined): string {
  if (!method) return "—";
  const key = `method.${method}` as MessageKey;
  const translated = runtime.t(key);
  return translated || method.replace(/_/g, " ");
}

export function useI18n() {
  const lang = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => activeLang,
    () => activeLang,
  );
  return { lang, dir: getDirection(lang), locale: getLocale(), t };
}
