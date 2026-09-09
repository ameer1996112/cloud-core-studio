import { STUDIO_TIMEZONE } from "./studio-time";

export function studioDateKey(value: Date | string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STUDIO_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
