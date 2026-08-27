import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/promo/yoga-lina")({
  beforeLoad: ({ location }) => {
    throw redirect({
      href: `/promo/yoga-lina-launch${location.searchStr}`,
      replace: true,
      statusCode: 301,
    });
  },
});
