import type { ReactNode } from "react";

/** Shared editorial heading; each route supplies its existing localized content. */
export function AtelierPageHeading({
  title,
  children,
  image,
}: {
  title: ReactNode;
  children?: ReactNode;
  image?: string;
}) {
  return (
    <header className={`atelier-page-heading${image ? " atelier-page-heading--photo" : ""}`}>
      <div className="atelier-page-heading-copy">
        <h1>{title}</h1>
        {children && <div className="atelier-page-heading-body">{children}</div>}
      </div>
      {image && (
        <img className="atelier-page-heading-image" src={image} alt="" width={1024} height={1536} />
      )}
    </header>
  );
}
