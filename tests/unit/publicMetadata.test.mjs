import { describe, expect, test } from "bun:test";

import { buildPublicPageHead } from "../../src/lib/public-metadata";

describe("public page metadata", () => {
  test("builds one canonical, robots, Open Graph, and Twitter contract", () => {
    const head = buildPublicPageHead({
      title: "Example | Cloud & Core Studio",
      description: "Example description.",
      path: "/example",
    });
    const meta = Object.fromEntries(
      head.meta.map((entry) => [
        entry.name ?? entry.property ?? "title",
        entry.content ?? entry.title,
      ]),
    );

    expect(meta.title).toBe("Example | Cloud & Core Studio");
    expect(meta.robots).toBe("index, follow");
    expect(meta["og:url"]).toBe("https://cloudandcorestudio.com/example");
    expect(meta["twitter:card"]).toBe("summary_large_image");
    expect(head.links).toEqual([
      { rel: "canonical", href: "https://cloudandcorestudio.com/example" },
    ]);
  });
});
