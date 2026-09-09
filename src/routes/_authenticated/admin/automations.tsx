import { createFileRoute } from "@tanstack/react-router";
import { AdminPage, AdminPageHeader, AdminPageShell } from "@/components/admin-shared";
import { ConciergeCommandCenter } from "@/components/admin/ConciergeCommandCenter";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/automations")({
  component: AutomationsPage,
});

function AutomationsPage() {
  const { lang, t } = useI18n();

  return (
    <AdminPageShell>
      <AdminPage>
        <AdminPageHeader
          eyebrow={t("admin.automationsEyebrow")}
          title={t("admin.automationsTitle")}
          description={t("admin.automationsDescription")}
        />
        <ConciergeCommandCenter lang={lang} />
      </AdminPage>
    </AdminPageShell>
  );
}
