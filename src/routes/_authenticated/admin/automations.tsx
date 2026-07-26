import { createFileRoute } from "@tanstack/react-router";
import { AdminPage, AdminPageHeader, AdminPageShell } from "@/components/admin-shared";
import { ConciergeCommandCenter } from "@/components/admin/ConciergeCommandCenter";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/automations")({
  component: AutomationsPage,
});

function AutomationsPage() {
  const { lang } = useI18n();

  return (
    <AdminPageShell>
      <AdminPage>
        <AdminPageHeader
          eyebrow="Concierge"
          title="Automations"
          description="This shared command center is also available as the first tab in Messages."
        />
        <ConciergeCommandCenter lang={lang} />
      </AdminPage>
    </AdminPageShell>
  );
}
