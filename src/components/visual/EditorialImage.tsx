import { editorialSrc, editorialSrcSet, type EditorialScene } from "@/lib/editorial-assets";
/** Decorative editorial photograph; nearby HTML carries the content. */
export function EditorialImage({
  scene,
  className = "",
  eager = false,
  sizes = "100vw",
  priority,
}: {
  scene: EditorialScene;
  className?: string;
  eager?: boolean;
  sizes?: string;
  priority?: "high" | "low" | "auto";
}) {
  return (
    <img
      src={editorialSrc(scene)}
      srcSet={editorialSrcSet(scene)}
      sizes={sizes}
      width={1536}
      height={1024}
      alt=""
      className={className}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ?? (eager ? "high" : "auto")}
    />
  );
}
