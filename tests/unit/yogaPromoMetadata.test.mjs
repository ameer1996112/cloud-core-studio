import { describe, expect, test } from "bun:test";

import { Route } from "../../src/routes/promo.yoga-lina";

describe("Yoga with Lina public metadata", () => {
  test("publishes a stable campaign title, canonical URL, and crawl policy", () => {
    const head = Route.options.head();
    const meta = Object.fromEntries(
      head.meta.map((entry) => [
        entry.name ?? entry.property ?? "title",
        entry.content ?? entry.title,
      ]),
    );

    expect(meta.title).toBe("יוגה עם לינה | Cloud & Core Studio");
    expect(meta.description).toContain("שיעור יוגה");
    expect(meta.robots).toBe("noindex, follow");
    expect(meta["og:url"]).toBe("https://cloudandcorestudio.com/promo/yoga-lina");
    expect(head.links).toContainEqual({
      rel: "canonical",
      href: "https://cloudandcorestudio.com/promo/yoga-lina",
    });
  });
});
