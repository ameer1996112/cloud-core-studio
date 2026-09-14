import { createFileRoute } from "@tanstack/react-router";
import { HealthOnboarding } from "@/components/health/HealthOnboarding";
export const Route = createFileRoute("/_authenticated/health-parent")({
  component: ParentHealthPage,
});
function ParentHealthPage() {
  const { user } = Route.useRouteContext();
  return <HealthOnboarding key={user.id} userId={user.id} parent />;
}
