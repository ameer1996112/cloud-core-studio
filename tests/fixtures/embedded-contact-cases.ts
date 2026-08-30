import type { EmbeddedBidiSegment } from "../../src/lib/bidi-format";

type ExpectedContact = Omit<EmbeddedBidiSegment, "kind"> & {
  kind: Exclude<EmbeddedBidiSegment["kind"], null>;
};

export type EmbeddedContactCase = {
  name: string;
  text: string;
  contacts: ExpectedContact[];
};

export const embeddedContactCases: EmbeddedContactCase[] = [
  {
    name: "local dashed phone",
    text: "Call 055-939-8438.",
    contacts: [{ kind: "phone", value: "055-939-8438" }],
  },
  {
    name: "international dashed phone",
    text: "Call +972-50-123-4567.",
    contacts: [{ kind: "phone", value: "+972-50-123-4567" }],
  },
  {
    name: "spaced and parenthesized phones",
    text: "Call +972 (50) 123 4567 or (050) 123-4567.",
    contacts: [
      { kind: "phone", value: "+972 (50) 123 4567" },
      { kind: "phone", value: "(050) 123-4567" },
    ],
  },
  {
    name: "URL followed immediately by RTL prose",
    text: "פתחו https://example.com/help,והמשיכו",
    contacts: [{ kind: "url", value: "https://example.com/help" }],
  },
  {
    name: "URL with balanced parentheses",
    text: "See https://example.com/a_(b).",
    contacts: [{ kind: "url", value: "https://example.com/a_(b)" }],
  },
  {
    name: "URLs beside unbalanced brackets and quotes",
    text: "See [https://example.com/a_(b)] and “https://example.com/help”.",
    contacts: [
      { kind: "url", value: "https://example.com/a_(b)" },
      { kind: "url", value: "https://example.com/help" },
    ],
  },
  {
    name: "URL query and hash",
    text: "See https://example.com/help?lang=he&next=%2Fapp#top!",
    contacts: [{ kind: "url", value: "https://example.com/help?lang=he&next=%2Fapp#top" }],
  },
  {
    name: "emails beside Hebrew and Arabic prefixes",
    text: "שלחו ל-cloud@example.com או راسلوا لـsupport@example.org.",
    contacts: [
      { kind: "email", value: "cloud@example.com" },
      { kind: "email", value: "support@example.org" },
    ],
  },
  {
    name: "dates times and counts are not phones",
    text: "2026-08-29, 29/08/2026, 09:30, 14 days, and 1,250 items.",
    contacts: [],
  },
  {
    name: "mixed repeated contacts",
    text: "055-939-8438 / https://example.com/help / cloud@example.com / 055-939-8438",
    contacts: [
      { kind: "phone", value: "055-939-8438" },
      { kind: "url", value: "https://example.com/help" },
      { kind: "email", value: "cloud@example.com" },
      { kind: "phone", value: "055-939-8438" },
    ],
  },
];
