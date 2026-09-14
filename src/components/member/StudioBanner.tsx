import "./design/reference-system.css";
import { homeStudioImage } from "@/lib/editorial-assets";

/** Generated studio atmosphere. Shared framing in Home and the review gallery. */
export function StudioBanner() {
  return (
    <div className="ref-home-banner">
      <img {...homeStudioImage} alt="" fetchPriority="high" />
    </div>
  );
}
