import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { claimYogaPromo, fetchYogaPromoStatus, trackYogaPromo } from "@/lib/yogaPromo";

export const YOGA_PROMO_QUERY_KEY = ["promotion", "yoga-lina-launch"] as const;

export function useYogaPromo() {
  const queryClient = useQueryClient();
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

  const refresh = useCallback(() => query.refetch(), [query]);
  const claimPromotion = useCallback(() => claim.mutate(), [claim]);
  return { ...query, claim, claimPromotion, refresh };
}
