import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getMemberProfileQueryView,
  shouldResetMemberProfileSaveOnEdit,
} from "../../src/lib/memberProfileState.ts";

const accountSource = readFileSync(
  resolve(import.meta.dir, "../../src/routes/_authenticated/member/account.tsx"),
  "utf8",
);

describe("member profile route state", () => {
  test("keeps pending and paused initial queries in a neutral loading state", () => {
    expect(
      getMemberProfileQueryView({
        hasProfileData: false,
        isPending: true,
        isError: false,
        isSuccess: false,
      }),
    ).toBe("loading");
  });

  test("shows a fatal retry state only when a failed query has no profile data", () => {
    expect(
      getMemberProfileQueryView({
        hasProfileData: false,
        isPending: false,
        isError: true,
        isSuccess: false,
      }),
    ).toBe("error");
  });

  test("keeps cached profile data usable through a background refetch failure", () => {
    expect(
      getMemberProfileQueryView({
        hasProfileData: true,
        isPending: false,
        isError: true,
        isSuccess: false,
      }),
    ).toBe("content");
  });

  test("treats a successful response without a member record as an invariant error", () => {
    expect(
      getMemberProfileQueryView({
        hasProfileData: false,
        isPending: false,
        isError: false,
        isSuccess: true,
      }),
    ).toBe("error");
  });

  test("clears settled feedback before the next edit but never resets a pending save", () => {
    expect(
      shouldResetMemberProfileSaveOnEdit({
        isPending: false,
        isSuccess: true,
        isError: false,
      }),
    ).toBe(true);
    expect(
      shouldResetMemberProfileSaveOnEdit({
        isPending: false,
        isSuccess: false,
        isError: true,
      }),
    ).toBe(true);
    expect(
      shouldResetMemberProfileSaveOnEdit({
        isPending: true,
        isSuccess: false,
        isError: false,
      }),
    ).toBe(false);
    expect(
      shouldResetMemberProfileSaveOnEdit({
        isPending: false,
        isSuccess: false,
        isError: false,
      }),
    ).toBe(false);
  });

  test("the production route applies both state policies", () => {
    expect(accountSource).toContain("getMemberProfileQueryView({");
    expect(accountSource).toContain("shouldResetMemberProfileSaveOnEdit(update)");
    expect(accountSource).toMatch(
      /if \(shouldResetMemberProfileSaveOnEdit\(update\)\) update\.reset\(\);\s+setForm/,
    );
  });
});
