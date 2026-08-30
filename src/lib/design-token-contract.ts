const HEX_COLOR = /^#([\da-f]{3}|[\da-f]{6})$/i;

function parseHexColor(color: string): [number, number, number] {
  const match = HEX_COLOR.exec(color);

  if (!match) {
    throw new Error(`Expected a 3- or 6-digit hexadecimal color, received: ${color}`);
  }

  const value =
    match[1].length === 3
      ? match[1]
          .split("")
          .map((channel) => channel.repeat(2))
          .join("")
      : match[1];

  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function relativeLuminance(color: string): number {
  const [red, green, blue] = parseHexColor(color).map((channel) => {
    const srgb = channel / 255;

    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });

  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

export function contrastRatio(foreground: string, background: string): number {
  const [first, second] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (left, right) => right - left,
  );

  return (first + 0.05) / (second + 0.05);
}

export function meetsNormalTextContrast(foreground: string, background: string): boolean {
  return contrastRatio(foreground, background) >= 4.5;
}
