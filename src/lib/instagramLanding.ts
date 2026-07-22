const TRACKING_PARAM_NAMES = new Set(["fbclid", "gclid", "igshid"]);

export const VERIFIED_STUDIO_WHATSAPP = "+972559398438";
export const STUDIO_INSTAGRAM_URL = "https://www.instagram.com/cloudandcorestudio/";

export const WOMEN_TRIAL_WHATSAPP_MESSAGE =
  "مرحبا، شفت صفحة Cloud & Core وبدي أحجز حصة تجريبية للنساء بـ80 ₪. ممكن أعرف المواعيد المتاحة؟";

export const KIDS_TRIAL_WHATSAPP_MESSAGE =
  "مرحبا، شفت صفحة Cloud & Core وبدي أحجز حصة تجريبية لليوغا الهوائية للأطفال من عمر 7 سنوات بـ80 ₪. ممكن أعرف المواعيد المتاحة؟";

export function normalizeWhatsappNumber(phone: string | null | undefined) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  return digits;
}

export function buildWhatsappHref(phone: string | null | undefined, message: string) {
  const digits = normalizeWhatsappNumber(phone);
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function extractInstagramAttribution(search: string) {
  const attribution: Record<string, string> = {};
  const params = new URLSearchParams(search);

  for (const [key, value] of params.entries()) {
    const normalized = key.toLowerCase();
    if (!normalized.startsWith("utm_") && !TRACKING_PARAM_NAMES.has(normalized)) continue;
    if (!value.trim()) continue;
    attribution[normalized] = value.slice(0, 200);
  }

  return attribution;
}

export function buildGoogleMapsHref(address: string | null | undefined) {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", address?.trim() || "Cloud & Core Studio, Hurfeish");
  return url.toString();
}
