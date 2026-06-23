import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StudioPulse } from "@/components/admin/StudioPulse";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/instructor/")({
  head: () => ({ meta: [{ title: "מצב הסטודיו — Cloud & Core" }] }),
  component: InstructorHome,
});

function InstructorHome() {
  const { data: name } = useQuery({
    queryKey: ["instructor-display-name"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const meta = u.user?.user_metadata as { name?: string; full_name?: string } | undefined;
      const fromMeta = meta?.name ?? meta?.full_name;
      if (fromMeta) return fromMeta;
      if (!u.user) return t("pulse.instructorFallback");
      const { data: inst } = await supabase
        .from("instructors")
        .select("name")
        .eq("user_id", u.user.id)
        .maybeSingle();
      return inst?.name ?? u.user.email?.split("@")[0] ?? t("pulse.instructorFallback");
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
