export type BidiKind =
  | "email"
  | "phone"
  | "url"
  | "currency"
  | "identifier"
  | "time-range"
  | "localized-date"
  | "localized-date-range";

export type DocumentDirection = "ltr" | "rtl" | "auto";
export type IsolatedDirection = "ltr" | "auto";
export type BidiDateTimeSegment = {
  kind: "localized-date" | "time-range" | null;
  value: string;
};
export type EmbeddedBidiSegment = {
  kind: "email" | "phone" | "url" | null;
  value: string;
};

const LEFT_TO_RIGHT_ISOLATE = "\u2066";
const FIRST_STRONG_ISOLATE = "\u2068";
const POP_DIRECTIONAL_ISOLATE = "\u2069";
const URL_PREFIX_PATTERN = /^(?:https?:\/\/|www\.)/iu;
const EMAIL_PATTERN =
  /^[A-Z0-9][A-Z0-9._%+-]*@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+/iu;
const PHONE_PATTERNS = [
  /^\+\d{1,3}[ -]+(?:\(\d{1,4}\)|\d{1,4})[ -]+\d{2,4}[ -]+\d{4}/u,
  /^(?:\(0\d{1,2}\)|0\d{1,2})[ -]+\d{3}[ -]+\d{4}/u,
] as const;
const HARD_URL_BOUNDARY = /[\s<>"'“”‘’]/u;
const RTL_LETTER = /[\p{Script=Arabic}\p{Script=Hebrew}]/u;
const URL_PROSE_SEPARATOR = /[,;،؛]/u;
const TERMINAL_URL_PUNCTUATION = /[.,;:!?…،؛]/u;

type ContactMatch = {
  kind: Exclude<EmbeddedBidiSegment["kind"], null>;
  value: string;
  end: number;
};

const CLOSING_BRACKETS: Record<string, string> = {
  ")": "(",
  "]": "[",
  "}": "{",
};

function urlMatchAt(text: string, start: number): ContactMatch | null {
  const prefix = text.slice(start).match(URL_PREFIX_PATTERN)?.[0];
  if (!prefix) return null;

  const brackets: string[] = [];
  let end = start + prefix.length;
  while (end < text.length) {
    const character = text[end];
    if (HARD_URL_BOUNDARY.test(character)) break;
    if (URL_PROSE_SEPARATOR.test(character) && RTL_LETTER.test(text[end + 1] ?? "")) break;

    if (character === "(" || character === "[" || character === "{") {
      brackets.push(character);
    } else if (character in CLOSING_BRACKETS) {
      if (brackets.at(-1) !== CLOSING_BRACKETS[character]) break;
      brackets.pop();
    }
    end += character.length;
  }

  while (end > start + prefix.length && TERMINAL_URL_PUNCTUATION.test(text[end - 1])) end -= 1;
  if (end <= start + prefix.length) return null;
  return { kind: "url", value: text.slice(start, end), end };
}

function emailMatchAt(text: string, start: number): ContactMatch | null {
  const value = text.slice(start).match(EMAIL_PATTERN)?.[0];
  return value ? { kind: "email", value, end: start + value.length } : null;
}

function phoneMatchAt(text: string, start: number): ContactMatch | null {
  if (/\d/u.test(text[start - 1] ?? "")) return null;
  for (const pattern of PHONE_PATTERNS) {
    const value = text.slice(start).match(pattern)?.[0];
    if (!value || /\d/u.test(text[start + value.length] ?? "")) continue;
    const digitCount = value.replace(/\D/gu, "").length;
    if (digitCount >= 9 && digitCount <= 15) {
      return { kind: "phone", value, end: start + value.length };
    }
  }
  return null;
}

function contactMatchAt(text: string, start: number): ContactMatch | null {
  return urlMatchAt(text, start) ?? emailMatchAt(text, start) ?? phoneMatchAt(text, start);
}

/** Split prose into unchanged plain text and semantic technical contact tokens. */
export function embeddedBidiSegments(text: string): EmbeddedBidiSegment[] {
  const segments: EmbeddedBidiSegment[] = [];
  let cursor = 0;
  let scan = 0;

  while (scan < text.length) {
    const match = contactMatchAt(text, scan);
    if (!match) {
      scan += 1;
      continue;
    }
    if (scan > cursor) segments.push({ kind: null, value: text.slice(cursor, scan) });
    segments.push({ kind: match.kind, value: match.value });
    cursor = match.end;
    scan = match.end;
  }

  if (cursor < text.length) segments.push({ kind: null, value: text.slice(cursor) });
  return segments.length > 0 ? segments : [{ kind: null, value: text }];
}

/** Direction for semantic HTML isolation (`bdi`). */
export function bidiDirectionFor(kind: BidiKind): IsolatedDirection {
  return kind === "currency" || kind === "localized-date" || kind === "localized-date-range"
    ? "auto"
    : "ltr";
}

/**
 * Isolate a technical value when markup is not available (toasts, titles, and
 * composed plain text). Isolation is required in LTR, RTL, and auto contexts:
 * it keeps adjacent punctuation outside the value's directional run.
 */
export function formatBidiValue(
  value: string | number,
  kind: BidiKind,
  documentDirection: DocumentDirection = "auto",
): string {
  void documentDirection;
  const text = String(value);
  if (
    (text.startsWith(LEFT_TO_RIGHT_ISOLATE) || text.startsWith(FIRST_STRONG_ISOLATE)) &&
    text.endsWith(POP_DIRECTIONAL_ISOLATE)
  ) {
    return text;
  }
  const isolate =
    kind === "currency" || kind === "localized-date" || kind === "localized-date-range"
      ? FIRST_STRONG_ISOLATE
      : LEFT_TO_RIGHT_ISOLATE;
  return `${isolate}${text}${POP_DIRECTIONAL_ISOLATE}`;
}

const TIME_PART_TYPES = new Set<Intl.DateTimeFormatPartTypes>([
  "dayPeriod",
  "fractionalSecond",
  "hour",
  "minute",
  "second",
  "timeZoneName",
]);
const DATE_TIME_OPTION_KEYS = [
  "dateStyle",
  "day",
  "dayPeriod",
  "era",
  "fractionalSecondDigits",
  "hour",
  "minute",
  "month",
  "second",
  "timeStyle",
  "timeZoneName",
  "weekday",
  "year",
] as const satisfies readonly (keyof Intl.DateTimeFormatOptions)[];

function toLocaleStringOptions(options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions {
  if (options && DATE_TIME_OPTION_KEYS.some((key) => options[key] !== undefined)) return options;
  return {
    ...options,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  };
}

/**
 * Preserve Intl's exact localized date-time text while identifying the date
 * and technical clock runs that need different directional isolation.
 */
export function bidiDateTimeSegments(
  value: Date | string | number,
  locales?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
): BidiDateTimeSegment[] {
  const parts = new Intl.DateTimeFormat(locales, toLocaleStringOptions(options)).formatToParts(
    new Date(value),
  );
  const kinds = parts.map((part, index): BidiDateTimeSegment["kind"] => {
    if (part.type !== "literal") {
      return TIME_PART_TYPES.has(part.type) ? "time-range" : "localized-date";
    }
    const previous = parts
      .slice(0, index)
      .reverse()
      .find((candidate) => candidate.type !== "literal");
    const next = parts.slice(index + 1).find((candidate) => candidate.type !== "literal");
    const previousKind = previous
      ? TIME_PART_TYPES.has(previous.type)
        ? "time-range"
        : "localized-date"
      : null;
    const nextKind = next
      ? TIME_PART_TYPES.has(next.type)
        ? "time-range"
        : "localized-date"
      : null;
    if (previousKind && nextKind && previousKind !== nextKind) return null;
    return previousKind ?? nextKind;
  });

  const segments: BidiDateTimeSegment[] = [];
  for (const [index, part] of parts.entries()) {
    const kind = kinds[index];
    const previous = segments.at(-1);
    if (previous?.kind === kind) previous.value += part.value;
    else segments.push({ kind, value: part.value });
  }
  return segments;
}

export function formatBidiDateTime(
  value: Date | string | number,
  locales?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
): string {
  return bidiDateTimeSegments(value, locales, options)
    .map((segment) => (segment.kind ? formatBidiValue(segment.value, segment.kind) : segment.value))
    .join("");
}

export function formatBidiDateAndTime(
  localizedDate: string,
  technicalTime: string,
  separator = " · ",
): string {
  return `${formatBidiValue(localizedDate, "localized-date")}${separator}${formatBidiValue(
    technicalTime,
    "time-range",
  )}`;
}
