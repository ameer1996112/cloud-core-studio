import { describe, expect, test } from "bun:test";

import {
  DEFAULT_ROOM_COLOR,
  createRoomColorForm,
  editRoomColorForm,
  roomColorSavePayload,
} from "../../src/lib/room-color";
import { programTypeInput } from "../../src/lib/admin.functions";
import { roomInput } from "../../src/lib/rooms.functions";

const tokenValues = new Map([
  ["--color-sand", "#E8DFD1"],
  ["--color-gold", "#D4AF6A"],
]);
const resolveToken = (name: string) => tokenValues.get(name) ?? "";

describe("native admin color values", () => {
  test("room create/edit forms and save payloads always expose serializable native colors", () => {
    expect(DEFAULT_ROOM_COLOR).toBe("#E8DFD1");
    expect(createRoomColorForm(resolveToken)).toBe("#E8DFD1");
    expect(editRoomColorForm("#1234AB", resolveToken)).toBe("#1234AB");
    expect(editRoomColorForm("var(--color-sand)", resolveToken)).toBe("#E8DFD1");

    expect(roomColorSavePayload("#1234AB")).toBe("#1234AB");
    expect(() => roomColorSavePayload("var(--color-sand)")).toThrow();
    expect(
      roomInput.parse({
        name: "Studio A",
        capacity: 10,
        equipment_count: 0,
        setup_minutes_before: 10,
        setup_minutes_after: 10,
        color: roomColorSavePayload("#E8DFD1"),
      }).color,
    ).toBe("#E8DFD1");
  });

  test("program validation preserves the prior omitted color default", () => {
    const parsed = programTypeInput.parse({
      slug: "flow",
      name_en: "Flow",
      name_he: "Flow HE",
      name_ar: "Flow AR",
    });

    expect(parsed.color_tag).toBe("#D4AF6A");
  });
});
