import { describe, expect, test } from "bun:test";
import { getClassFormDisabledReason } from "../../src/lib/adminClassFormValidation";

const translate = (key: string) => key;

const legacyClass = {
  title: "Hot Pilates",
  starts_at: "2026-07-29T18:00",
  room: "Main Studio",
  room_id: "",
  instructor_id: "",
  program_type_id: "",
};

describe("admin class form validation", () => {
  test("allows an existing legacy class to save a time change without a template", () => {
    expect(
      getClassFormDisabledReason({
        mode: "edit",
        form: legacyClass,
        activeRooms: [],
        activePrograms: [],
        activeInstructors: [],
        t: translate,
      }),
    ).toBeNull();
  });

  test("still requires a template and configured resources when creating a class", () => {
    expect(
      getClassFormDisabledReason({
        mode: "create",
        form: legacyClass,
        activeRooms: [],
        activePrograms: [],
        activeInstructors: [],
        t: translate,
      }),
    ).toBe("admin.classes.needMainStudio");
  });

  test("rejects a partial edit date instead of sending malformed time data", () => {
    expect(
      getClassFormDisabledReason({
        mode: "edit",
        form: { ...legacyClass, starts_at: "T18:00" },
        activeRooms: [],
        activePrograms: [],
        activeInstructors: [],
        t: translate,
      }),
    ).toBe("admin.classes.needDateTime");
  });
});
