import type { ReactNode } from "react";

/** Shared reference heading; each route supplies its existing localized content. */
export function AtelierPageHeading({
  title,
  children,
}: {
  title: ReactNode;
  children?: ReactNode;
  image?: string;
}) {
  return (
    <header className="ref-page-heading">
      <div className="ref-page-heading-copy">
        <h1>{title}</h1>
        {children && <div className="ref-page-heading-body">{children}</div>}
      </div>
    </header>
  );
}
