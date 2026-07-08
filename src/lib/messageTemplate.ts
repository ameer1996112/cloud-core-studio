// Isomorphic helpers for rendering message templates and WhatsApp URLs.

export type TemplateVars = Record<string, string | number | null | undefined>;

export function renderTemplate(body: string, vars: TemplateVars): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => {
    const v = vars[k];
    return v === null || v === undefined ? `{{${k}}}` : String(v);
  });
}

/** Strip everything except digits; convert leading + or 00 to E.164 digits. */
export function normalizePhoneForWa(raw?: string | null): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("00")) s = s.slice(2);
  s = s.replace(/\D+/g, "");
  if (s.length === 10 && s.startsWith("0")) {
    s = `972${s.slice(1)}`;
  }
  return s.length >= 6 ? s : null;
}

export function waUrl(opts: { to?: string | null; text: string }): string {
  const num = normalizePhoneForWa(opts.to);
  const encoded = encodeURIComponent(opts.text);
  return num ? `https://wa.me/${num}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export function formatClassDate(iso: string, tz = "Asia/Jerusalem"): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: tz,
  });
}
export function formatClassTime(iso: string, tz = "Asia/Jerusalem"): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  });
}

export const SUPPORTED_VARIABLES = [
  "member_name",
  "class_name",
  "class_date",
  "class_time",
  "room_name",
  "instructor_name",
  "studio_name",
  "studio_phone",
  "studio_whatsapp",
  "credits_remaining",
  "package_name",
  "package_expiry",
  "waitlist_position",
  "cancellation_deadline",
] as const;

export const TRIGGER_TYPES = [
  { key: "manual", label: "Manual" },
  { key: "class_reminder", label: "Class reminder" },
  { key: "booking_confirmation", label: "Booking confirmation" },
  { key: "cancellation_confirmation", label: "Cancellation confirmation" },
  { key: "waitlist_spot", label: "Waitlist spot available" },
  { key: "package_expiring", label: "Package expiring" },
  { key: "low_credits", label: "Low credits" },
  { key: "trial_followup", label: "Trial follow-up" },
  { key: "no_show_followup", label: "No-show follow-up" },
] as const;

export const CHANNELS = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "Email" },
  { key: "in_app", label: "In-app" },
] as const;

export const LANGUAGES = [
  { key: "en", label: "English" },
  { key: "he", label: "עברית" },
  { key: "ar", label: "العربية" },
] as const;

/** Build a downloadable .ics file content for a class. */
export function buildIcs(opts: {
  uid: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  location?: string | null;
  description?: string | null;
  studioName?: string | null;
}): string {
  const start = new Date(opts.startsAt);
  const end = new Date(start.getTime() + opts.durationMinutes * 60_000);
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cloud & Core//Studio//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${opts.uid}@cloudandcore`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(opts.title)}`,
    opts.location ? `LOCATION:${esc(opts.location)}` : "",
    opts.description ? `DESCRIPTION:${esc(opts.description)}` : "",
    opts.studioName
      ? `ORGANIZER;CN=${esc(opts.studioName)}:mailto:noreply@cloudandcore.studio`
      : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

type CalendarShareData = {
  files?: File[];
  title?: string;
  text?: string;
};

type CalendarNavigator = Navigator & {
  canShare?: (data: CalendarShareData) => boolean;
  share?: (data: CalendarShareData) => Promise<void>;
};

export async function downloadIcs(filename: string, content: string) {
  const file = new File([content], filename, { type: "text/calendar;charset=utf-8" });
  const nav = typeof navigator !== "undefined" ? (navigator as CalendarNavigator) : null;

  if (nav?.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: filename.replace(/\.ics$/i, ""),
        text: "Add this class to your calendar.",
      });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
