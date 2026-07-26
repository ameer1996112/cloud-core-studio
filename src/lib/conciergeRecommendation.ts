export function buildConciergeRecommendationSummary(
  recommendations: ReadonlyArray<{ id: string; title?: string | null }>,
) {
  const titles = recommendations.flatMap((recommendation) => {
    const title = recommendation.title?.trim();
    return title ? [title] : [];
  });
  return titles.length ? titles.join(" · ") : null;
}
