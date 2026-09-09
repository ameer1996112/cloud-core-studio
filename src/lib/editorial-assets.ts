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
