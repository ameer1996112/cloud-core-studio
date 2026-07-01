export function getViewerCacheKey(session: any) {
  const userId = session?.user?.id;
  return typeof userId === "string" && userId.length > 0 ? `member:${userId}` : "guest";
}

export function getFallbackViewerCacheKey(viewerContext: "member" | "guest") {
  return viewerContext === "guest" ? "guest" : "member:pending";
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
