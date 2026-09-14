/** Generated atmosphere, never instructor identity or evidence of the studio premises.
 * Provenance and original files: docs/redesign/ASSET_MANIFEST.md.
 */
export type EditorialScene =
  | "welcome"
  | "welcome-context"
  | "membership"
  | "fabric"
  | "mat"
  | "arrival";

export const homeStudioImage = {
  src: "/images/editorial/home-studio-v2-960.webp",
  srcSet:
    "/images/editorial/home-studio-v2-640.webp 640w, /images/editorial/home-studio-v2-960.webp 960w, /images/editorial/home-studio-v2-1600.webp 1600w",
  sizes: "(max-width: 767px) calc(100vw - 40px), 760px",
  width: 1600,
  height: 800,
} as const;

export function editorialSrc(scene: EditorialScene, width: 480 | 960 | 1440 = 960) {
  return `/images/editorial/${scene === "welcome" ? "welcome-v2" : scene === "welcome-context" ? "welcome" : scene}-${width}.webp`;
}
export function editorialSrcSet(scene: EditorialScene) {
  return [480, 960, 1440]
    .map(
      (width) =>
        `/images/editorial/${scene === "welcome" ? "welcome-v2" : scene === "welcome-context" ? "welcome" : scene}-${width}.webp ${width}w`,
    )
    .join(", ");
}
