const INVITE_DISMISSAL_COOLDOWN_MS = 7 * 86_400_000;

export const MEMBER_PUSH_INVITE_DISMISSED_AT_KEY = "cc-member-push-invite-dismissed-at";
export const MEMBER_PUSH_REGISTRATION_FAILED_EVENT = "cc:member-push-registration-failed";

export function isMemberPushInviteDismissed(rawDismissedAt: string | null, now = Date.now()) {
  if (!rawDismissedAt) return false;
  const dismissedAt = Number(rawDismissedAt);
  return Number.isFinite(dismissedAt) && now - dismissedAt < INVITE_DISMISSAL_COOLDOWN_MS;
}

export function shouldShowMemberPushInvite(input: {
  isNativeIos: boolean;
  isLoading: boolean;
  isBootstrapPending: boolean;
  isRegistrationPending: boolean;
  needsLocalPermission: boolean;
  hasActiveDevice: boolean;
  dismissed: boolean;
}) {
  return (
    input.isNativeIos &&
    !input.isLoading &&
    !input.isBootstrapPending &&
    !input.isRegistrationPending &&
    (input.needsLocalPermission || !input.hasActiveDevice) &&
    !input.dismissed
  );
}
