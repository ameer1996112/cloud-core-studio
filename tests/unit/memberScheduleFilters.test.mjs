import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { applyLang } from "../../src/lib/i18n.ts";

const wrapper = (tag, name) => {
  const Component = ({ children, asChild: _asChild, side: _side, ...props }) =>
    React.createElement(tag, { "data-sheet-part": name, ...props }, children);
  Component.displayName = name;
  return Component;
};

mock.module("@/components/ui/sheet", () => ({
  Sheet: wrapper("div", "sheet"),
  SheetTrigger: wrapper("div", "trigger"),
  SheetContent: wrapper("section", "content"),
  SheetHeader: wrapper("header", "header"),
  SheetFooter: wrapper("footer", "footer"),
  SheetTitle: wrapper("h2", "title"),
  SheetDescription: wrapper("p", "description"),
  SheetClose: wrapper("div", "close"),
}));

const { MemberScheduleFilterPanel } =
  await import("../../src/components/member/MemberScheduleFilterPanel.tsx");

applyLang("en");

describe("member schedule filters", () => {
  test("renders formatted compact filters with truthful dialog and pressed semantics", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemberScheduleFilterPanel, {
        dir: "ltr",
        lang: "en",
        search: "",
        onSearchChange: () => {},
        dateScope: "all",
        onDateScopeChange: () => {},
        filters: [
          {
            key: "level",
            label: "Level",
            options: ["all-levels"],
            value: "all-levels",
            formatOption: () => "All levels",
          },
        ],
        onFilterChange: () => {},
        onClearAll: () => {},
      }),
    );

    expect(html).toContain("All levels");
    expect(html).not.toContain(">all-levels<");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain("Filters");
    expect(html).toContain("1 active");
    expect(html).toMatch(/role="group"[^>]*aria-label="Schedule"/);
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain('role="tab"');
    expect(html.match(/aria-pressed="(?:true|false)"/g)).toHaveLength(6);
    expect(html).toContain('aria-pressed="true"');
  });
});
