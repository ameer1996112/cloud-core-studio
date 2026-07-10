export const STUDIO_TIMEZONE = "Asia/Jerusalem";

type StudioDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string) {
  const cached = formatters.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  formatters.set(timeZone, formatter);
  return formatter;
}

function partsFor(date: Date, timeZone: string): StudioDateTimeParts {
  const values = formatterFor(timeZone)
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== "literal") result[part.type] = part.value;
      return result;
    }, {});

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function toInputValue(
  parts: Pick<StudioDateTimeParts, "year" | "month" | "day" | "hour" | "minute">,
) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

function parseInput(value: string): StudioDateTimeParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new RangeError(`Invalid studio date-time: ${value}`);

  const [, year, month, day, hour, minute] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: 0,
  };
}

export function formatStudioDateTimeInput(value: Date | string, timeZone = STUDIO_TIMEZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid date");
  return toInputValue(partsFor(date, timeZone));
}

export function studioDateTimeInputToIso(value: string, timeZone = STUDIO_TIMEZONE) {
  const target = parseInput(value);
  const desiredUtcMs = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    0,
    0,
  );

  let guess = new Date(desiredUtcMs);
  for (let step = 0; step < 4; step += 1) {
    const current = partsFor(guess, timeZone);
    const currentUtcMs = Date.UTC(
      current.year,
      current.month - 1,
      current.day,
      current.hour,
      current.minute,
      current.second,
      0,
    );
    const diff = desiredUtcMs - currentUtcMs;
    if (diff === 0) return guess.toISOString();
    guess = new Date(guess.getTime() + diff);
  }

  return guess.toISOString();
}
