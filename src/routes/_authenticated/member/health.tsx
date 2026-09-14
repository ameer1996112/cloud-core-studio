import { createFileRoute } from "@tanstack/react-router";
import { HealthOnboarding } from "@/components/health/HealthOnboarding";
export const Route = createFileRoute("/_authenticated/member/health")({
  validateSearch: (search: Record<string, unknown>) => ({
    classId: typeof search.classId === "string" ? search.classId : undefined,
  }),
  component: HealthPage,
});
function HealthPage() {
  const { user } = Route.useRouteContext();
  const { classId } = Route.useSearch();
  return (
    <section className="cc-health-route">
      <HealthOnboarding key={user.id} userId={user.id} classId={classId} />
    </section>
  );
}
