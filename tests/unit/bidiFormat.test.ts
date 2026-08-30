import { describe, expect, test } from "bun:test";

import {
  bidiDateTimeSegments,
  bidiDirectionFor,
  embeddedBidiSegments,
  formatBidiDateAndTime,
  formatBidiDateTime,
  formatBidiValue,
  type BidiKind,
  type DocumentDirection,
} from "../../src/lib/bidi-format";
import { embeddedContactCases } from "../fixtures/embedded-contact-cases";

const samples: Record<BidiKind, string> = {
  email: "studio@example.com",
  phone: "+972-50-123-4567",
  url: "https://cloudandcorestudio.com/app?lang=he",
  currency: "₪1,250.00",
  identifier: "PAY-2026-08/A7",
  "time-range": "09:30–10:45",
  "localized-date": "28 באוגוסט 2026",
  "localized-date-range": "28 באוגוסט — 30 באוגוסט",
};

describe("bidi formatting", () => {
  for (const contactCase of embeddedContactCases) {
    test(`tokenizes ${contactCase.name} without changing the source text`, () => {
      const segments = embeddedBidiSegments(contactCase.text);

      expect(segments.map(({ value }) => value).join("")).toBe(contactCase.text);
      expect(segments.filter(({ kind }) => kind !== null)).toEqual(contactCase.contacts);
      expect(segments.every(({ value }) => value.length > 0)).toBe(true);
    });
  }

  for (const documentDirection of ["ltr", "rtl", "auto"] satisfies DocumentDirection[]) {
    for (const [kind, value] of Object.entries(samples) as [BidiKind, string][]) {
      test(`isolates ${kind} in a ${documentDirection} document`, () => {
        const formatted = formatBidiValue(value, kind, documentDirection);
        const isolate =
          kind === "currency" || kind === "localized-date" || kind === "localized-date-range"
            ? "\u2068"
            : "\u2066";

        expect(formatted).toBe(`${isolate}${value}\u2069`);
        expect(`(${formatted})`).toBe(`(${isolate}${value}\u2069)`);
      });
    }
  }

  test("uses auto direction for currency and localized textual dates", () => {
    expect(bidiDirectionFor("currency")).toBe("auto");
    expect(bidiDirectionFor("localized-date")).toBe("auto");
    expect(bidiDirectionFor("localized-date-range")).toBe("auto");
    for (const kind of ["email", "phone", "url", "identifier", "time-range"] satisfies BidiKind[]) {
      expect(bidiDirectionFor(kind)).toBe("ltr");
    }
  });

  test("keeps Hebrew and Arabic textual dates and ranges first-strong instead of forcing LTR", () => {
    for (const [kind, value] of [
      ["localized-date", "28 באוגוסט 2026"],
      ["localized-date", "28 أغسطس 2026"],
      ["localized-date-range", "28 באוגוסט — 30 באוגוסט"],
      ["localized-date-range", "28 أغسطس — 30 أغسطس"],
    ] satisfies [BidiKind, string][]) {
      expect(formatBidiValue(value, kind, "rtl")).toBe(`\u2068${value}\u2069`);
    }
  });

  test("does not double-isolate an already formatted value", () => {
    for (const [kind, value] of Object.entries(samples) as [BidiKind, string][]) {
      const once = formatBidiValue(value, kind, "rtl");
      expect(formatBidiValue(once, kind, "rtl")).toBe(once);
      expect(once.slice(1, -1)).toBe(value);
    }
  });

  test("splits localized date-time output without changing its visible characters", () => {
    const value = new Date("2026-08-28T09:30:00.000Z");
    const options: Intl.DateTimeFormatOptions = {
      timeZone: "UTC",
      weekday: "short",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    };

    for (const locale of ["he-IL", "ar"] as const) {
      const expected = value.toLocaleString(locale, options);
      const segments = bidiDateTimeSegments(value, locale, options);
      const formatted = formatBidiDateTime(value, locale, options);

      expect(segments.map((segment) => segment.value).join("")).toBe(expected);
      expect(segments.some((segment) => segment.kind === "localized-date")).toBe(true);
      expect(segments.some((segment) => segment.kind === "time-range")).toBe(true);
      expect(formatted.replace(/[\u2066\u2068\u2069]/g, "")).toBe(expected);
      expect(formatted).toContain("\u2068");
      expect(formatted).toContain("\u2066");
    }

    expect(
      bidiDateTimeSegments(value)
        .map((segment) => segment.value)
        .join(""),
    ).toBe(value.toLocaleString());
  });

  test("composes pre-localized date and clock text with separate isolates", () => {
    const date = "28 באוגוסט 2026";
    const time = "09:30";
    const formatted = formatBidiDateAndTime(date, time);

    expect(formatted).toBe(`\u2068${date}\u2069 · \u2066${time}\u2069`);
    expect(formatted.replace(/[\u2066\u2068\u2069]/g, "")).toBe(`${date} · ${time}`);
  });
});
