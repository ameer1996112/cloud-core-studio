const NATIVE_COLOR = /^#[0-9a-f]{6}$/i;

/** style-contract-allow-color: persisted native color inputs require a serializable literal default. */
export const DEFAULT_ROOM_COLOR = "#E8DFD1";

export type ColorTokenReader = (tokenName: string) => string;

function requireNativeColor(value: string, context: string) {
  const normalized = value.trim();
  if (!NATIVE_COLOR.test(normalized)) {
    throw new Error(`${context} must resolve to a #RRGGBB color`);
  }
  return normalized;
}

function resolveFormColor(value: string, readToken: ColorTokenReader) {
  const token = value.trim().match(/^var\(\s*(--[\w-]+)\s*\)$/);
  return requireNativeColor(token ? readToken(token[1]) : value, "Room color");
}

export function createRoomColorForm(readToken: ColorTokenReader) {
  return resolveFormColor("var(--color-sand)", readToken);
}

export function editRoomColorForm(value: string, readToken: ColorTokenReader) {
  return resolveFormColor(value, readToken);
}

export function roomColorSavePayload(value: string) {
  return requireNativeColor(value, "Saved room color");
}
