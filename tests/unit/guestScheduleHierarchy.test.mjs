import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";

const source = readFileSync(
  resolve(import.meta.dir, "../../src/routes/member.schedule.tsx"),
  "utf8",
);

describe("guest schedule task hierarchy", () => {
  test("keeps discovery in heading, controls, class list, trust, then sign-in order", () => {
    const steps = ["heading", "date-controls", "class-list", "trust", "sign-in-handoff"];
    const positions = steps.map((step) => source.indexOf(`data-guest-flow-step="${step}"`));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  test("preserves scoped guest queries and class-specific post-auth intent", () => {
    expect(source).toContain('viewerCacheKey="guest"');
    expect(source).toContain("getMemberScheduleQueryKey(resolvedViewerCacheKey)");
    expect(source).toContain("buildAuthReturnToHref(buildMemberScheduleReturnTo(openClass))");
    expect(source).toContain("syncGuestScheduleAuthIntent(window.sessionStorage, openClass)");
  });
});
