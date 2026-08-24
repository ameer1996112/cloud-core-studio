const APPROVED_UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_id",
] as const;

export function sanitizeMarketingUtm(input: string | URLSearchParams): URLSearchParams {
  const source = typeof input === "string" ? new URLSearchParams(input.replace(/^\?/, "")) : input;
  const result = new URLSearchParams();
  for (const key of APPROVED_UTM_KEYS) {
    const value = source.get(key);
    const trimmedValue = value?.trim();
    if (trimmedValue) result.set(key, trimmedValue.slice(0, 200));
  }
  return result;
}

export function buildMarketingHref(path: string, utm?: string | URLSearchParams): string {
  if (!utm) return path;
  const clean = sanitizeMarketingUtm(utm);
  const query = clean.toString();
  if (!query) return path;
  const [pathWithoutFragment, fragment] = path.split("#", 2);
  const separator = pathWithoutFragment.includes("?")
    ? pathWithoutFragment.endsWith("?") || pathWithoutFragment.endsWith("&")
      ? ""
      : "&"
    : "?";
  return `${pathWithoutFragment}${separator}${query}${fragment ? `#${fragment}` : ""}`;
}
