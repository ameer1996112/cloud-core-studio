import { createFileRoute } from "@tanstack/react-router";
import { StudioPulse } from "@/components/admin/StudioPulse";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/pulse")({
  head: () => ({ meta: [{ title: "מצב הסטודיו — Cloud & Core" }] }),
  component: PulsePage,
});

function PulsePage() {
  return <StudioPulse heading={t("pulse.heading")} subheading={t("pulse.subheading")} />;
}
