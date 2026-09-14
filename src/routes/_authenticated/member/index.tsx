import homeCss from "@/styles/member-home-refinement.css?url";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getMemberHome } from "@/lib/member.functions";
import { getPublicStudioSettings } from "@/lib/studioSettings.functions";
import { ClassDetailSheet } from "@/components/member/ClassDetailSheet";
import { MemberHomeContent } from "@/components/member/MemberHomeContent";
import { getMemberViewerCacheKey } from "@/lib/memberQueryKeys";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { WeeklyPromoBanner } from "@/components/member/WeeklyPromoBanner";

export const Route = createFileRoute("/_authenticated/member/")({
  component: MemberHome,
  head: () => ({ links: [{ rel: "stylesheet", href: homeCss }] }),
});

function MemberHome() {
  useDocumentTitle("page.home.title");
  const fetchHome = useServerFn(getMemberHome);
  const fetchSettings = useServerFn(getPublicStudioSettings);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["member-home"],
    queryFn: () => fetchHome(),
  });
  const { data: settings } = useQuery({
    queryKey: ["public-studio-settings"],
    queryFn: () => fetchSettings(),
  });
  const [openClass, setOpenClass] = useState<string | null>(null);
  return (
    <>
      <MemberHomeContent
        data={data}
        settings={settings}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        onOpenClass={setOpenClass}
        promotion={<WeeklyPromoBanner />}
      />
      <ClassDetailSheet
        classId={openClass}
        open={!!openClass}
        onOpenChange={(v) => !v && setOpenClass(null)}
        viewerCacheKey={getMemberViewerCacheKey(data?.member?.id)}
      />
    </>
  );
}
