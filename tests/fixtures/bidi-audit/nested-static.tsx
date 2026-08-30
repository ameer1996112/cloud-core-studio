declare const lang: "en" | "he" | "ar";

const nestedCopy = {
  en: {
    sections: [
      {
        paragraphs: [
          { body: "Call 055-111-2233 for English support." },
          { body: "Email nested-en@example.com or visit https://example.com/en/help." },
        ],
      },
    ],
  },
  he: {
    sections: [
      {
        paragraphs: [
          { body: "לתמיכה התקשרו 055-222-3344." },
          { body: "כתבו אל nested-he@example.com או בקרו ב-https://example.com/he/help." },
        ],
      },
    ],
  },
  ar: {
    sections: [
      {
        paragraphs: [
          { body: "للدعم اتصلوا على 055-333-4455." },
          { body: "راسلوا nested-ar@example.com أو زوروا https://example.com/ar/help." },
        ],
      },
    ],
  },
};

export function NestedStaticFixture() {
  const data = nestedCopy[lang];

  return (
    <main>
      {data.sections.map((section) =>
        section.paragraphs.map((paragraph) => <p key={paragraph.body}>{paragraph.body}</p>),
      )}
    </main>
  );
}
