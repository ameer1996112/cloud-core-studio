export function shouldShowMemberPushInvite(input: {
  isNativePlatform: boolean;
  isLoading: boolean;
  hasActiveDevice: boolean;
  dismissed: boolean;
}) {
  return input.isNativePlatform && !input.isLoading && !input.hasActiveDevice && !input.dismissed;
}
