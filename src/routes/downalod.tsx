import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/downalod")({
  beforeLoad: ({ location }) => {
    throw redirect({
      to: "/download",
      search: location.search,
      replace: true,
      statusCode: 301,
    });
  },
});
