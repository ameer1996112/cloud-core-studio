import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  claimMemberPromotion,
  fetchMemberPromotions,
  trackPromotionEngagement,
  type MemberPromotion,
} from "@/lib/promotions";

const queryKey = ["member", "promotions"] as const;

export function usePromotions() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey,
    queryFn: fetchMemberPromotions,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const claim = useMutation({
    mutationFn: claimMemberPromotion,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ["member-packages"] }),
      ]),
  });
  const dismiss = useMutation({
    mutationFn: (promotion: MemberPromotion) =>
      trackPromotionEngagement(promotion.slug, "dismissed", promotion.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  return { ...query, featured: query.data?.[0], claim, dismiss };
}
