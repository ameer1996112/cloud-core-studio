export type MemberProfileQueryState = {
  hasProfileData: boolean;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
};

export type MemberProfileSaveState = {
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
};

export function getMemberProfileQueryView({
  hasProfileData,
  isPending,
  isError,
  isSuccess,
}: MemberProfileQueryState): "loading" | "error" | "content" {
  if (hasProfileData) return "content";
  if (isError || isSuccess) return "error";
  if (isPending) return "loading";
  return "loading";
}

export function shouldResetMemberProfileSaveOnEdit({
  isPending,
  isSuccess,
  isError,
}: MemberProfileSaveState) {
  return !isPending && (isSuccess || isError);
}
