const INVITE_DISMISSAL_COOLDOWN_MS = 7 * 86_400_000;

export const MEMBER_PUSH_INVITE_DISMISSED_AT_KEY = "cc-member-push-invite-dismissed-at";
export const MEMBER_PUSH_REGISTRATION_FAILED_EVENT = "cc:member-push-registration-failed";

type MemberPushPermission =
  | "prompt"
  | "prompt-with-rationale"
  | "granted"
  | "denied"
  | "unsupported";

export function isMemberPushInviteDismissed(rawDismissedAt: string | null, now = Date.now()) {
  if (!rawDismissedAt) return false;
  const dismissedAt = Number(rawDismissedAt);
  return Number.isFinite(dismissedAt) && now - dismissedAt < INVITE_DISMISSAL_COOLDOWN_MS;
}

export function shouldShowMemberPushInvite(input: {
  isNativeIos: boolean;
  isLoading: boolean;
  hasActiveDevice: boolean;
  dismissed: boolean;
}) {
  return input.isNativeIos && !input.isLoading && !input.hasActiveDevice && !input.dismissed;
}

export function memberPushOnboardingDecision(input: {
  pushEnabled: boolean;
  isLoading: boolean;
  isNativeIos: boolean;
  permission: MemberPushPermission;
  hasRegisteredToken: boolean;
  dismissed: boolean;
}) {
  if (!input.pushEnabled || input.isLoading || !input.isNativeIos) return "hidden" as const;
  if (input.permission === "granted") return "bootstrap" as const;
  if (
    input.permission === "prompt" &&
    shouldShowMemberPushInvite({
      isNativeIos: input.isNativeIos,
      isLoading: input.isLoading,
      hasActiveDevice: input.hasRegisteredToken,
      dismissed: input.dismissed,
    })
  ) {
    return "invite" as const;
  }
  return "hidden" as const;
}

export function memberPushRegistrationDecision(result: { ok: boolean; skipped?: string }) {
  if (result.ok || result.skipped === "already_started") return "enabled" as const;
  if (result.skipped === "permission_denied") return "dismissed" as const;
  return "error" as const;
}
