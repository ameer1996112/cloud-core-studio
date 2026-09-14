import { createFileRoute, notFound } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import memberCss from "@/styles/member.css?url";
import packagesCss from "@/styles/packages.css?url";
const Gallery =
  import.meta.env.DEV || import.meta.env.MODE === "checkpoint-review"
    ? lazy(() => import("@/components/member/design/ComponentGallery"))
    : () => null;
export const Route = createFileRoute("/design-review")({
  beforeLoad: () => {
    if (!(import.meta.env.DEV || import.meta.env.MODE === "checkpoint-review")) throw notFound();
  },
  head: () => ({
    links: [
      { rel: "stylesheet", href: memberCss },
      { rel: "stylesheet", href: packagesCss },
    ],
  }),
  component: () => (
    <Suspense fallback={<p>Loading component review…</p>}>
      <Gallery />
    </Suspense>
  ),
});
