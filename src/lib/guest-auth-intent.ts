import { sanitizeMarketingUtm } from "@/lib/marketing-attribution";

export const GUEST_AUTH_INTENT_STORAGE_KEY = "cc_guest_auth_intent";

const GUEST_AUTH_INTENT_TTL_MS = 10 * 60 * 1000;
const INTERNAL_ORIGIN_FALLBACK = "https://cloudandcore.local";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type GuestAuthIntentRecord = {
  returnTo: string;
  savedAt: number;
};

function normalizeClassId(classId: string | null | undefined) {
  if (typeof classId !== "string") return null;
  const trimmed = classId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildMemberScheduleReturnTo(
  classId?: string | null,
  attribution?: string | URLSearchParams,
) {
  const normalizedClassId = normalizeClassId(classId);
  const search = sanitizeMarketingUtm(attribution ?? "");
  if (normalizedClassId) search.set("classId", normalizedClassId);
  const query = search.toString();
  return `/member/schedule${query ? `?${query}` : ""}`;
}

export function buildAuthReturnToHref(returnTo: string) {
  return `/auth?returnTo=${encodeURIComponent(returnTo)}`;
}

export function buildProtectedRouteAuthHref(pathname: string, search = "", hash = "") {
  return buildAuthReturnToHref(`${pathname}${search}${hash}`);
}

export function readMemberScheduleClassId(href: string) {
  const url = new URL(href, INTERNAL_ORIGIN_FALLBACK);
  return normalizeClassId(url.searchParams.get("classId"));
}

export function buildMemberScheduleUrl(href: string, classId: string | null) {
  const url = new URL(href, INTERNAL_ORIGIN_FALLBACK);
  const normalizedClassId = normalizeClassId(classId);

  if (normalizedClassId) url.searchParams.set("classId", normalizedClassId);
  else url.searchParams.delete("classId");

  return `${url.pathname}${url.search}${url.hash}`;
}

export function clearGuestAuthIntent(storage: StorageLike | null | undefined) {
  storage?.removeItem(GUEST_AUTH_INTENT_STORAGE_KEY);
}

export function rememberGuestAuthIntent(
  storage: StorageLike | null | undefined,
  returnTo: string,
  now = Date.now(),
) {
  storage?.setItem(
    GUEST_AUTH_INTENT_STORAGE_KEY,
    JSON.stringify({ returnTo, savedAt: now } satisfies GuestAuthIntentRecord),
  );
}

export function syncGuestScheduleAuthIntent(
  storage: StorageLike | null | undefined,
  classId: string | null,
  now = Date.now(),
) {
  const normalizedClassId = normalizeClassId(classId);
  if (!normalizedClassId) {
    clearGuestAuthIntent(storage);
    return;
  }

  rememberGuestAuthIntent(storage, buildMemberScheduleReturnTo(normalizedClassId), now);
}

export function resolveSafeInternalReturnTo(candidate: string | null | undefined, origin: string) {
  if (typeof candidate !== "string") return null;

  const trimmed = candidate.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;

  const url = new URL(trimmed, origin);
  if (url.origin !== origin) return null;
  if (url.pathname === "/auth" || url.pathname.startsWith("/auth/")) return null;

  return `${url.pathname}${url.search}${url.hash}`;
}

export function consumeGuestAuthIntent(
  storage: StorageLike | null | undefined,
  origin: string,
  now = Date.now(),
) {
  const stored = storage?.getItem(GUEST_AUTH_INTENT_STORAGE_KEY);
  if (!stored) return null;

  clearGuestAuthIntent(storage);

  try {
    const parsed = JSON.parse(stored) as Partial<GuestAuthIntentRecord>;
    if (typeof parsed.savedAt !== "number" || now - parsed.savedAt > GUEST_AUTH_INTENT_TTL_MS) {
      return null;
    }

    return resolveSafeInternalReturnTo(parsed.returnTo, origin);
  } catch {
    return null;
  }
}

export function resolvePostAuthDestination({
  fallbackTo,
  origin,
  returnTo,
  storage,
  now = Date.now(),
}: {
  fallbackTo: string;
  origin: string;
  returnTo: string | null | undefined;
  storage: StorageLike | null | undefined;
  now?: number;
}) {
  const explicitReturnTo = resolveSafeInternalReturnTo(returnTo, origin);
  if (explicitReturnTo) {
    clearGuestAuthIntent(storage);
    return explicitReturnTo;
  }

  return consumeGuestAuthIntent(storage, origin, now) ?? fallbackTo;
}
