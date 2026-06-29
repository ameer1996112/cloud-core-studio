import { createFileRoute } from "@tanstack/react-router";
import { StudioPulse } from "@/components/admin/StudioPulse";
import { AdminPage } from "@/components/admin-shared";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export const Route = createFileRoute("/_authenticated/admin/pulse")({
  component: PulsePage,
});

function PulsePage() {
  useDocumentTitle("page.pulse.title");
  return (
    <AdminPage>
      <StudioPulse showHeader={false} />
    </AdminPage>
  );
}
