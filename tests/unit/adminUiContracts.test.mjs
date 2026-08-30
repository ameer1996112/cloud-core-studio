import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

function expectResponsiveData(path) {
  const source = read(path);
  expect(source, `${path} should use ResponsiveDataList`).toContain("ResponsiveDataList");
  expect(source, `${path} should provide a localized caption`).toContain("caption=");
}

function expectAsyncState(path) {
  const source = read(path);
  expect(source, `${path} should use AsyncState`).toContain("AsyncState");
  expect(source, `${path} should expose retryable query failures`).toContain("isError");
}

function expectPersistentOutcome(path) {
  expect(read(path), `${path} should keep mutation outcomes visible`).toContain(
    "PersistentAnnouncement",
  );
}

function expectAccessibleActions(path) {
  const source = read(path);
  expect(source, `${path} should not retain undersized icon actions`).not.toMatch(/h-[89] w-[89]/);
  const iconButtons = [...source.matchAll(/<button\b[\s\S]*?<\/(?:button)>/g)]
    .map(([button]) => button)
    .filter((button) => /<(?:X|Pencil|Trash2|Archive|RotateCcw|XCircle)[\s>]/.test(button));
  for (const button of iconButtons) {
    expect(
      button.includes("aria-label=") ||
        button.includes("{t(") ||
        button.includes("{copy.") ||
        button.includes("{label}"),
      `${path} should localize icon-only actions`,
    ).toBe(true);
  }
}

describe("Task 10 admin UI contracts", () => {
  test("Batch A uses responsive data, explicit filters, durable states, and confirmed status changes", () => {
    for (const path of [
      "src/routes/_authenticated/admin/classes/index.tsx",
      "src/routes/_authenticated/admin/members/index.tsx",
      "src/routes/_authenticated/admin/instructors.tsx",
    ]) {
      expectResponsiveData(path);
      expectAsyncState(path);
      expectAccessibleActions(path);
    }
    expect(read("src/routes/_authenticated/admin/members/index.tsx")).toContain("<fieldset");
    expect(read("src/routes/_authenticated/admin/members/index.tsx")).toContain("<legend");
    expect(read("src/routes/_authenticated/admin/classes/index.tsx")).toContain(
      "AdminDestructiveAction",
    );
    expectPersistentOutcome("src/routes/_authenticated/admin/classes/index.tsx");
    expectPersistentOutcome("src/routes/_authenticated/admin/instructors.tsx");
    expect(read("src/routes/_authenticated/admin/bookings.tsx")).toContain(
      'redirect({ to: "/admin/calendar"',
    );
  });

  test("Batch B uses responsive data, shared field messages, durable outcomes, and confirmations", () => {
    for (const path of [
      "src/routes/_authenticated/admin/payments.tsx",
      "src/routes/_authenticated/admin/plans.tsx",
      "src/routes/_authenticated/admin/programs.tsx",
    ]) {
      expectResponsiveData(path);
      expectAsyncState(path);
      expectPersistentOutcome(path);
      expectAccessibleActions(path);
    }
    expect(read("src/routes/_authenticated/admin/payments.tsx")).toContain(
      "AdminDestructiveAction",
    );
    expect(read("src/routes/_authenticated/admin/programs.tsx")).toContain(
      "AdminDestructiveAction",
    );
    expect(read("src/routes/_authenticated/admin/plans.tsx")).toContain("FieldMessage");
    expect(read("src/routes/_authenticated/admin/credits.tsx")).toContain(
      'redirect({ to: "/admin/members"',
    );
  });

  test("Batch C keeps reports, operations, settings, and messaging usable at 360px", () => {
    for (const path of [
      "src/routes/_authenticated/admin/kids.tsx",
      "src/routes/_authenticated/admin/reports.tsx",
      "src/routes/_authenticated/admin/rooms.tsx",
      "src/components/admin/ConciergeCommandCenter.tsx",
      "src/components/admin/DeliveryMonitoringConsole.tsx",
    ]) {
      expectAsyncState(path);
      expectAccessibleActions(path);
    }
    for (const path of [
      "src/routes/_authenticated/admin/kids.tsx",
      "src/routes/_authenticated/admin/reports.tsx",
      "src/routes/_authenticated/admin/rooms.tsx",
      "src/components/admin/ConciergeCommandCenter.tsx",
    ]) {
      expectResponsiveData(path);
    }
    for (const path of [
      "src/routes/_authenticated/admin/kids.tsx",
      "src/routes/_authenticated/admin/rooms.tsx",
      "src/routes/_authenticated/admin/settings.tsx",
      "src/components/admin/ConciergeCommandCenter.tsx",
      "src/components/admin/DeliveryMonitoringConsole.tsx",
    ]) {
      expectPersistentOutcome(path);
    }
    expect(read("src/routes/_authenticated/admin/kids.tsx")).toContain("AdminDestructiveAction");
    expect(read("src/routes/_authenticated/admin/rooms.tsx")).toContain("AdminDestructiveAction");
    expect(read("src/routes/_authenticated/admin/settings.tsx")).toContain("FieldMessage");
    expect(read("src/components/admin/DeliveryMonitoringConsole.tsx")).toContain("<fieldset");
    expect(read("src/components/admin/DeliveryMonitoringConsole.tsx")).toContain("<legend");
    expect(read("src/routes/_authenticated/admin/reports.tsx")).not.toContain("overflow-x-auto");
    expect(read("src/routes/_authenticated/admin/templates.tsx")).toContain(
      'redirect({ to: "/admin/messages"',
    );
  });
});
