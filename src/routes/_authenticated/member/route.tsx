import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRouteRole } from "@/lib/route-guards";
import { YogaPromoBanner } from "@/components/member/YogaPromoBanner";
import { useYogaPromo } from "@/hooks/useYogaPromo";

export const Route = createFileRoute("/_authenticated/member")({
  beforeLoad: async ({ location }) => {
    return requireRouteRole(
      ["member"],
      `${location.pathname}${location.searchStr}${location.hash}`,
    );
  },
  component: MemberLayout,
});

function MemberLayout() {
  const promo = useYogaPromo({ autoClaim: true });
  const visible = Boolean(promo.data?.active || promo.data?.claimedByCurrentUser);
  return (
    <>
      {visible ? (
        <YogaPromoBanner
          status={promo.data}
          claimPending={promo.claim.isPending}
          onClaim={() => promo.claim.mutate()}
          className="mb-6"
        />
      ) : null}
      <Outlet />
    </>
  );
}
