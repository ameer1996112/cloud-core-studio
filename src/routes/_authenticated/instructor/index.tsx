import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StudioPulse } from "@/components/admin/StudioPulse";
import { useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export const Route = createFileRoute("/_authenticated/instructor/")({
  component: InstructorHome,
});

function InstructorHome() {
  const { t } = useI18n();
  useDocumentTitle("page.instructor.title");
  const { data: name } = useQuery({
    queryKey: ["instructor-display-name"],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      const meta = user?.user_metadata as { name?: string; full_name?: string } | undefined;
      const fromMeta = meta?.name ?? meta?.full_name;
      if (fromMeta) return fromMeta;
      if (!user) return t("pulse.instructorFallback");
      const { data: inst } = await supabase
        .from("instructors")
        .select("name")
        .eq("user_id", user.id)
        .maybeSingle();
      return inst?.name ?? user.email?.split("@")[0] ?? t("pulse.instructorFallback");
    },
  });

  return (
    <StudioPulse
      heading={t("pulse.instructorHeading", { name: name ?? t("pulse.instructorFallback") })}
      subheading={t("pulse.instructorSubheading")}
      mineOnly
    />
  );
}
