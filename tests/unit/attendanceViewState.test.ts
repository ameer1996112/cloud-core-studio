import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  deriveAttendanceRosterState,
  deriveAttendanceSaveState,
  getAttendanceStatusPresentation,
  type AttendanceSaveStatus,
  type AttendanceStatus,
} from "../../src/lib/attendance-view-state";

const attendanceRoute = readFileSync(
  resolve(import.meta.dir, "../../src/routes/_authenticated/admin/attendance.tsx"),
  "utf8",
);
const instructorRoster = readFileSync(
  resolve(import.meta.dir, "../../src/components/admin/ClassRosterDrawer.tsx"),
  "utf8",
);
const attendanceRosterList = readFileSync(
  resolve(import.meta.dir, "../../src/components/admin/AttendanceRosterList.tsx"),
  "utf8",
);

describe("attendance roster state", () => {
  test("distinguishes loading, empty, and ready rosters", () => {
    expect(deriveAttendanceRosterState({ isLoading: true, roster: [] })).toMatchObject({
      status: "loading",
    });
    expect(deriveAttendanceRosterState({ isLoading: false, roster: [] })).toMatchObject({
      status: "empty",
    });
    expect(deriveAttendanceRosterState({ isLoading: false, roster: [{ id: "b-1" }] })).toEqual({
      status: "ready",
      data: [{ id: "b-1" }],
    });
  });
});

describe("attendance status presentation", () => {
  test.each([
    ["present", "Present"],
    ["absent", "Absent"],
    ["late", "Late"],
    ["excused", "Excused"],
  ] as const)("gives %s a visible text label in addition to its tone", (status, label) => {
    expect(getAttendanceStatusPresentation(status, "en")).toMatchObject({ status, label });
    expect(getAttendanceStatusPresentation(status, "en").className).not.toBe("");
  });

  test.each([
    ["checked_in", "present"],
    ["attended", "present"],
    ["no_show", "absent"],
    ["cancelled", "excused"],
    ["booked", "unmarked"],
  ] as const)("adapts existing %s values to %s without changing mutations", (value, status) => {
    expect(getAttendanceStatusPresentation(value, "en").status).toBe(status);
  });

  test.each(["en", "he", "ar"] as const)("localizes every status in %s", (lang) => {
    for (const status of ["present", "absent", "late", "excused"] as AttendanceStatus[]) {
      expect(getAttendanceStatusPresentation(status, lang).label).not.toBe("");
    }
  });
});

describe("attendance save state", () => {
  test.each([
    ["idle", false, false],
    ["pending", true, false],
    ["saved", false, true],
    ["save-failed", false, true],
    ["offline-retry", false, true],
  ] as const)(
    "models %s with duplicate locking and persistent outcomes",
    (status, locked, persistent) => {
      const state = deriveAttendanceSaveState({ status, lang: "en", memberName: "Maya" });

      expect(state.actionLocked).toBe(locked);
      expect(Boolean(state.outcome?.persistent)).toBe(persistent);
      if (status !== "idle") expect(state.label).not.toBe("");
    },
  );

  test.each([
    ["en", "Attendance for Maya could not be saved. Try again."],
    ["he", "לא הצלחנו לשמור את הנוכחות של Maya. נסו שוב."],
    ["ar", "تعذر حفظ حضور Maya. حاولي مرة أخرى."],
  ] as const)("keeps raw provider failures out of the visible %s outcome", (lang, body) => {
    const failure = deriveAttendanceSaveState({
      status: "save-failed",
      lang,
      memberName: "Maya",
      errorMessage: "Failed to fetch",
    });

    expect(failure.outcome).toMatchObject({ tone: "error", body, persistent: true });
    expect(failure.outcome?.body).not.toContain("Failed to fetch");
  });

  test("keeps offline retry visible", () => {
    const offline = deriveAttendanceSaveState({
      status: "offline-retry",
      lang: "en",
      memberName: "Maya",
    });

    expect(offline.outcome).toMatchObject({ tone: "error", retry: true, persistent: true });
  });

  test("has an exhaustive public save-state vocabulary", () => {
    const statuses: AttendanceSaveStatus[] = [
      "idle",
      "pending",
      "saved",
      "save-failed",
      "offline-retry",
    ];
    expect(
      statuses.map((status) => deriveAttendanceSaveState({ status, lang: "en" }).status),
    ).toEqual(statuses);
  });
});

describe("attendance route composition", () => {
  test("uses shared loading, responsive roster, and persistent outcome components", () => {
    expect(attendanceRoute).toContain("<AsyncState");
    expect(attendanceRoute).toContain("<AttendanceRosterList");
    expect(attendanceRosterList).toContain("<ResponsiveDataList");
    expect(attendanceRosterList).toContain("<AsyncState");
    expect(attendanceRoute).toContain("<PersistentAnnouncement");
    expect(attendanceRoute).toContain("deriveAttendanceRosterState");
    expect(attendanceRoute).toContain("deriveAttendanceSaveState");
  });

  test("locks every attendance action while its booking save is pending", () => {
    expect(attendanceRoute).toContain("pendingBookingId");
    expect(attendanceRoute).toContain("attendancePendingRef");
    expect(attendanceRoute).toMatch(/disabled=\{saveState\.actionLocked\}/);
  });

  test("keeps shared instructor roster save outcomes persistent and locks duplicate marks", () => {
    expect(instructorRoster).toContain("deriveAttendanceSaveState");
    expect(instructorRoster).toContain("<PersistentAnnouncement");
    expect(instructorRoster).toContain("pendingBookingId");
    expect(instructorRoster).toContain("attendancePendingRef");
    expect(instructorRoster).toMatch(/disabled=\{actionLocked\}/);
  });

  test("does not pass technical error messages into either attendance presentation model", () => {
    expect(attendanceRoute).not.toContain("errorMessage: saveOutcome?.errorMessage");
    expect(instructorRoster).not.toContain("errorMessage: attendanceOutcome?.errorMessage");
  });
});
