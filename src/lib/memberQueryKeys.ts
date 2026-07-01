export type ViewerContext = "member" | "guest";

export function getViewerCacheKey(session: unknown) {
  const userId =
    typeof session === "object" && session !== null && "user" in session
      ? (session as { user?: { id?: unknown } }).user?.id
      : undefined;
  return typeof userId === "string" && userId.length > 0 ? `member:${userId}` : "guest";
}

export function getFallbackViewerCacheKey(viewerContext: ViewerContext) {
  return viewerContext === "guest" ? "guest" : "member:pending";
}

export function getMemberViewerCacheKey(userId: string | null | undefined) {
  return typeof userId === "string" && userId.length > 0 ? `member:${userId}` : undefined;
}

export function getMemberScheduleQueryKey(viewerCacheKey: string) {
  return ["member-schedule", viewerCacheKey] as const;
}

export function getClassDetailQueryKey(classId: string | null, viewerCacheKey: string) {
  return ["class-detail", viewerCacheKey, classId] as const;
}

export function isAuthenticatedMemberScheduleQueryKey(queryKey: readonly unknown[]) {
  return (
    queryKey[0] === "member-schedule" &&
    typeof queryKey[1] === "string" &&
    queryKey[1].startsWith("member:")
  );
}

export function isConcreteMemberViewerCacheKey(viewerCacheKey: string | null | undefined) {
  return (
    typeof viewerCacheKey === "string" &&
    viewerCacheKey.startsWith("member:") &&
    viewerCacheKey !== "member:pending"
  );
}

export function getMemberScheduleInvalidationTarget(
  viewerContext: ViewerContext,
  viewerCacheKey?: string,
) {
  if (viewerContext === "guest") {
    return { queryKey: getMemberScheduleQueryKey("guest") };
  }

  if (isConcreteMemberViewerCacheKey(viewerCacheKey)) {
    return { queryKey: getMemberScheduleQueryKey(viewerCacheKey) };
  }

  return {
    predicate: (query: { queryKey: readonly unknown[] }) =>
      isAuthenticatedMemberScheduleQueryKey(query.queryKey),
  };
}
