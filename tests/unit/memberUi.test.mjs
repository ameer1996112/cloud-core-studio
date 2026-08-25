import { describe, expect, test } from "bun:test";
import { countActiveScheduleFilters, getScheduleEmptyStateKind } from "../../src/lib/member-ui.ts";

describe("member schedule presentation", () => {
  test("counts search, date, and secondary filters", () => {
    expect(countActiveScheduleFilters(" aerial ", "week", { level: "all-levels" })).toBe(3);
    expect(countActiveScheduleFilters("", "all", {})).toBe(0);
  });

  test("distinguishes missing inventory from filtered results", () => {
    expect(getScheduleEmptyStateKind(0, 0, 0)).toBe("inventory");
    expect(getScheduleEmptyStateKind(8, 0, 2)).toBe("filtered");
    expect(getScheduleEmptyStateKind(8, 3, 0)).toBeNull();
  });
});
