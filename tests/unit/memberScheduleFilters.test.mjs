import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { applyLang } from "../../src/lib/i18n.ts";
import { getLocalizedIntensity } from "../../src/lib/lesson-card-variants.ts";
import { MemberScheduleFilterPanel } from "../../src/components/member/MemberScheduleFilterPanel.tsx";

applyLang("en");

function renderFilters(overrides = {}) {
  applyLang("en");
  return renderToStaticMarkup(
    React.createElement(MemberScheduleFilterPanel, {
      dir: "ltr",
      lang: "en",
      search: "",
      onSearchChange: () => {},
      dateScope: "all",
      onDateScopeChange: () => {},
      filters: [],
      onFilterChange: () => {},
      ...overrides,
    }),
  );
}

describe("member schedule filters", () => {
  test("localizes schedule level slugs without exposing raw values", () => {
    const labels = ["en", "he", "ar"].map((lang) => getLocalizedIntensity("all-levels", lang));
    expect(labels).toEqual(["All levels", "לכל הרמות", "لكل المستويات"]);
    expect(labels.join(" ")).not.toContain("all-levels");
  });

  test("exposes search and a truthful closed filter dialog before opening", () => {
    const html = renderFilters();
    expect(html).toContain('aria-label="Search by class name…"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain(">Reset<");
  });

  test("offers reset for a search, date scope, or selected filter", () => {
    for (const state of [
      { search: "Pilates" },
      { dateScope: "today" },
      {
        filters: [
          {
            key: "level",
            label: "Level",
            options: ["all-levels"],
            value: "all-levels",
            formatOption: (value) => getLocalizedIntensity(value, "en"),
          },
        ],
      },
    ]) {
      expect(renderFilters(state)).toContain(">Reset<");
    }
  });
});
