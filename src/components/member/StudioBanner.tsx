import studioInterior from "@/assets/studio-interior.webp";
import "./design/reference-system.css";

/** The same studio photograph and crop in Home and the review gallery. */
export function StudioBanner() {
  return (
    <div className="ref-home-banner">
      <img src={studioInterior} alt="" width={960} height={440} fetchPriority="high" />
    </div>
  );
}
