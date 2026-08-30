import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { BidiDateTime, BidiValue, EmbeddedContactText } from "../../src/components/ui/bidi";
import { termsCopy } from "../../src/routes/terms";
import { embeddedContactCases } from "../fixtures/embedded-contact-cases";

describe("BidiValue rendering", () => {
  for (const contactCase of embeddedContactCases) {
    test(`renders ${contactCase.name} with exact SSR contact boundaries`, () => {
      const markup = renderToStaticMarkup(<EmbeddedContactText text={contactCase.text} />);
      const expectedTextMarkup = renderToStaticMarkup(<>{contactCase.text}</>);
      const isolatedValues = [...markup.matchAll(/<bdi dir="ltr">([\s\S]*?)<\/bdi>/g)].map(
        (match) => match[1],
      );
      const expectedValues = contactCase.contacts.map(({ value }) =>
        renderToStaticMarkup(<>{value}</>),
      );

      expect(isolatedValues).toEqual(expectedValues);
      expect(markup.replace(/<bdi dir="ltr">|<\/bdi>/g, "")).toBe(expectedTextMarkup);
    });
  }

  test("renders Hebrew and Arabic localized dates with truthful auto direction", () => {
    for (const value of ["28 באוגוסט 2026", "28 أغسطس 2026"]) {
      const markup = renderToStaticMarkup(
        <section dir="rtl">
          <BidiValue kind="localized-date">{value}</BidiValue>
        </section>,
      );

      expect(markup).toBe(`<section dir="rtl"><bdi dir="auto">${value}</bdi></section>`);
    }
  });

  test("renders LTR technical values and auto-directed currency without changing their text", () => {
    const markup = renderToStaticMarkup(
      <section dir="rtl">
        <BidiValue kind="email">studio@example.com</BidiValue>
        <BidiValue kind="identifier">PAY-2026-08/A7</BidiValue>
        <BidiValue kind="time-range">09:30–10:45</BidiValue>
        <BidiValue kind="currency">₪1,250.00</BidiValue>
      </section>,
    );

    expect(markup).toContain('<bdi dir="ltr">studio@example.com</bdi>');
    expect(markup).toContain('<bdi dir="ltr">PAY-2026-08/A7</bdi>');
    expect(markup).toContain('<bdi dir="ltr">09:30–10:45</bdi>');
    expect(markup).toContain('<bdi dir="auto">₪1,250.00</bdi>');
  });

  test("renders a combined localized timestamp as separately isolated date and clock runs", () => {
    const value = new Date("2026-08-28T09:30:00.000Z");
    const options: Intl.DateTimeFormatOptions = {
      timeZone: "UTC",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    };
    const markup = renderToStaticMarkup(
      <BidiDateTime value={value} locales="he-IL" options={options} />,
    );

    expect(markup).toContain('<bdi dir="auto">');
    expect(markup).toContain('<bdi dir="ltr">');
    expect(markup.replace(/<[^>]+>/g, "")).toBe(value.toLocaleString("he-IL", options));
  });

  test("isolates embedded phone, email, and URL tokens without changing SSR text", () => {
    const text = "צרו קשר: 055-939-8438; cloudandcorestudio@gmail.com; https://example.com/help.";
    const markup = renderToStaticMarkup(<EmbeddedContactText text={text} />);
    const expectedTextMarkup = renderToStaticMarkup(<>{text}</>);

    expect(markup.replace(/<bdi dir="ltr">|<\/bdi>/g, "")).toBe(expectedTextMarkup);
    expect(markup).toContain('<bdi dir="ltr">055-939-8438</bdi>');
    expect(markup).toContain('<bdi dir="ltr">cloudandcorestudio@gmail.com</bdi>');
    expect(markup).toContain('<bdi dir="ltr">https://example.com/help</bdi>.');
  });

  test("preserves every EN, HE, and AR terms contact line while isolating every occurrence", () => {
    const expectedContact = /055-939-8438|cloudandcorestudio@gmail\.com/g;

    for (const lang of ["en", "he", "ar"] as const) {
      let localeContactCount = 0;
      for (const section of termsCopy[lang].sections) {
        const contacts = [...section.matchAll(expectedContact)].map((match) => match[0]);
        if (contacts.length === 0) continue;
        localeContactCount += contacts.length;

        const markup = renderToStaticMarkup(<EmbeddedContactText text={section} />);
        const expectedTextMarkup = renderToStaticMarkup(<>{section}</>);
        expect(markup.replace(/<bdi dir="ltr">|<\/bdi>/g, "")).toBe(expectedTextMarkup);
        expect(markup.match(/<bdi dir="ltr">/g)).toHaveLength(contacts.length);
        for (const contact of contacts) {
          expect(markup).toContain(`<bdi dir="ltr">${contact}</bdi>`);
        }
      }
      expect(localeContactCount).toBe(4);
    }
  });
});
