import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  claimYogaPromo,
  fetchYogaPromoStatus,
  getYogaPromoAttributionToken,
  trackYogaPromo,
} from "@/lib/yogaPromo";

export const YOGA_PROMO_QUERY_KEY = ["promotion", "yoga-lina-launch"] as const;

export function useYogaPromo(options: { autoClaim?: boolean } = {}) {
  const queryClient = useQueryClient();
  const autoClaimAttempted = useRef(false);
  const query = useQuery({
    queryKey: YOGA_PROMO_QUERY_KEY,
    queryFn: fetchYogaPromoStatus,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const claim = useMutation({
    mutationFn: claimYogaPromo,
    onSuccess: async (result) => {
      if (result.status === "claimed") trackYogaPromo("yoga_promo_claim_succeeded");
      else if (result.status === "already_claimed")
        trackYogaPromo("yoga_promo_claim_already_exists");
      else if (result.status === "sold_out") trackYogaPromo("yoga_promo_claim_sold_out");
      else if (result.status === "ineligible")
        trackYogaPromo("yoga_promo_claim_ineligible", { reason: result.reason });
      await queryClient.invalidateQueries({ queryKey: YOGA_PROMO_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ["member-packages"] });
    },
  });

  useEffect(() => {
    if (
      !options.autoClaim ||
      autoClaimAttempted.current ||
      !getYogaPromoAttributionToken() ||
      !query.data?.active ||
      query.data.claimedByCurrentUser ||
      query.data.soldOut
    ) {
      return;
    }
    autoClaimAttempted.current = true;
    claim.mutate();
  }, [claim, options.autoClaim, query.data]);

  const refresh = useCallback(() => query.refetch(), [query]);
  return { ...query, claim, refresh };
}
