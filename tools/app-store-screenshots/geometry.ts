export type Size = { width: number; height: number };

export function apertureMatchedViewport(cssWidth: number, aperture: Size): Size {
  return {
    width: cssWidth,
    height: Math.round((cssWidth * aperture.height) / aperture.width),
  };
}

export function physicalCaptureSize(viewport: Size, deviceScaleFactor: number): Size {
  return {
    width: viewport.width * deviceScaleFactor,
    height: viewport.height * deviceScaleFactor,
  };
}

export function horizontalSourceCropPercent(source: Size, aperture: Size): number {
  const sourceRatio = source.width / source.height;
  const apertureRatio = aperture.width / aperture.height;
  return Math.max(0, 1 - apertureRatio / sourceRatio) * 100;
}
