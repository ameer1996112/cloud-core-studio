import { createFileRoute } from "@tanstack/react-router";

import { NewClass } from "@/components/admin/AdminSessionForm";

export const Route = createFileRoute("/_authenticated/admin/classes/new")({
  component: NewClass,
});
