import { tForLang, type Lang } from "@/lib/i18n";

export type MemberOutcome = {
  tone: "neutral" | "info" | "success" | "warning" | "danger";
  title: string;
  body: string;
  nextAction?: { label: string; href: string };
  announce: boolean;
};

export type MemberOutcomeKind =
  | "loading"
  | "no-package"
  | "active-package"
  | "expiring-package"
  | "exhausted-credits"
  | "payment-pending"
  | "payment-succeeded"
  | "payment-failed"
  | "payment-cancelled"
  | "payment-missing"
  | "missing-receipt"
  | "receipt-unavailable"
  | "expired-session"
  | "offline-retry"
  | "profile-validation-error"
  | "profile-succeeded"
  | "account-succeeded"
  | "account-unavailable"
  | "account-failed";

export type MemberOutcomeInput = {
  kind: MemberOutcomeKind;
  lang: Lang;
  body?: string;
  nextAction?: MemberOutcome["nextAction"];
};

type OutcomeDefinition = {
  tone: MemberOutcome["tone"];
  titleKey: Parameters<typeof tForLang>[1];
  bodyKey: Parameters<typeof tForLang>[1];
  action?: { labelKey: Parameters<typeof tForLang>[1]; href: string };
  announce: boolean;
};

const OUTCOMES: Record<MemberOutcomeKind, OutcomeDefinition> = {
  loading: {
    tone: "neutral",
    titleKey: "member.outcome.loading.title",
    bodyKey: "member.outcome.loading.body",
    announce: false,
  },
  "no-package": {
    tone: "info",
    titleKey: "member.outcome.noPackage.title",
    bodyKey: "member.outcome.noPackage.body",
    action: { labelKey: "packages.choosePackage", href: "/member/packages" },
    announce: false,
  },
  "active-package": {
    tone: "success",
    titleKey: "member.outcome.activePackage.title",
    bodyKey: "member.outcome.activePackage.body",
    action: { labelKey: "member.browseSchedule", href: "/member/schedule" },
    announce: false,
  },
  "expiring-package": {
    tone: "warning",
    titleKey: "member.outcome.expiringPackage.title",
    bodyKey: "member.outcome.expiringPackage.body",
    action: { labelKey: "packages.choosePackage", href: "/member/packages" },
    announce: true,
  },
  "exhausted-credits": {
    tone: "warning",
    titleKey: "member.outcome.exhaustedCredits.title",
    bodyKey: "member.outcome.exhaustedCredits.body",
    action: { labelKey: "packages.choosePackage", href: "/member/packages" },
    announce: true,
  },
  "payment-pending": {
    tone: "info",
    titleKey: "member.outcome.paymentPending.title",
    bodyKey: "member.outcome.paymentPending.body",
    action: { labelKey: "member.outcome.action.viewPayments", href: "/member/packages" },
    announce: true,
  },
  "payment-succeeded": {
    tone: "success",
    titleKey: "member.outcome.paymentSucceeded.title",
    bodyKey: "member.outcome.paymentSucceeded.body",
    action: { labelKey: "member.outcome.action.viewPackage", href: "/member/packages" },
    announce: true,
  },
  "payment-failed": {
    tone: "danger",
    titleKey: "member.outcome.paymentFailed.title",
    bodyKey: "member.outcome.paymentFailed.body",
    action: { labelKey: "recovery.action.support", href: "/support" },
    announce: true,
  },
  "payment-cancelled": {
    tone: "danger",
    titleKey: "member.outcome.paymentCancelled.title",
    bodyKey: "member.outcome.paymentCancelled.body",
    action: { labelKey: "member.outcome.action.viewPayments", href: "/member/packages" },
    announce: true,
  },
  "payment-missing": {
    tone: "warning",
    titleKey: "member.outcome.paymentMissing.title",
    bodyKey: "member.outcome.paymentMissing.body",
    action: { labelKey: "recovery.action.support", href: "/support" },
    announce: true,
  },
  "missing-receipt": {
    tone: "warning",
    titleKey: "member.outcome.missingReceipt.title",
    bodyKey: "member.outcome.missingReceipt.body",
    action: { labelKey: "member.outcome.action.viewPayments", href: "/member/packages" },
    announce: true,
  },
  "receipt-unavailable": {
    tone: "danger",
    titleKey: "member.outcome.receiptUnavailable.title",
    bodyKey: "member.outcome.receiptUnavailable.body",
    action: { labelKey: "recovery.action.support", href: "/support" },
    announce: true,
  },
  "expired-session": {
    tone: "danger",
    titleKey: "member.outcome.expiredSession.title",
    bodyKey: "member.outcome.expiredSession.body",
    action: { labelKey: "member.outcome.action.signIn", href: "/auth" },
    announce: true,
  },
  "offline-retry": {
    tone: "danger",
    titleKey: "member.outcome.offline.title",
    bodyKey: "member.outcome.offline.body",
    action: { labelKey: "common.retry", href: "." },
    announce: true,
  },
  "profile-validation-error": {
    tone: "danger",
    titleKey: "member.outcome.profileValidation.title",
    bodyKey: "member.outcome.profileValidation.body",
    announce: true,
  },
  "profile-succeeded": {
    tone: "success",
    titleKey: "member.outcome.profileSucceeded.title",
    bodyKey: "member.outcome.profileSucceeded.body",
    announce: true,
  },
  "account-succeeded": {
    tone: "success",
    titleKey: "member.outcome.accountSucceeded.title",
    bodyKey: "member.outcome.accountSucceeded.body",
    announce: true,
  },
  "account-unavailable": {
    tone: "danger",
    titleKey: "member.outcome.accountUnavailable.title",
    bodyKey: "member.outcome.accountUnavailable.body",
    action: { labelKey: "common.retry", href: "." },
    announce: true,
  },
  "account-failed": {
    tone: "danger",
    titleKey: "member.outcome.accountFailed.title",
    bodyKey: "member.outcome.accountFailed.body",
    action: { labelKey: "recovery.action.support", href: "/support" },
    announce: true,
  },
};

export function deriveMemberOutcome(input: MemberOutcomeInput): MemberOutcome {
  const definition = OUTCOMES[input.kind];
  const defaultAction = definition.action
    ? {
        label: tForLang(input.lang, definition.action.labelKey),
        href: definition.action.href,
      }
    : undefined;

  return {
    tone: definition.tone,
    title: tForLang(input.lang, definition.titleKey),
    body: input.body ?? tForLang(input.lang, definition.bodyKey),
    ...(input.nextAction || defaultAction ? { nextAction: input.nextAction ?? defaultAction } : {}),
    announce: definition.announce,
  };
}

export function memberPackageOutcomeKind(input: {
  status?: string | null;
  credits: number;
  expiresAt?: string | null;
  now?: number;
  expiringWithinMs?: number;
}): "no-package" | "active-package" | "expiring-package" | "exhausted-credits" {
  if (input.status !== "active") return "no-package";
  if (input.credits <= 0) return "exhausted-credits";
  if (input.expiresAt) {
    const timeRemaining = new Date(input.expiresAt).getTime() - (input.now ?? Date.now());
    if (timeRemaining <= (input.expiringWithinMs ?? 7 * 24 * 60 * 60 * 1000)) {
      return "expiring-package";
    }
  }
  return "active-package";
}

export function memberRecoveryKind(input: {
  online: boolean;
  sessionExpired: boolean;
  fallback?: "account-failed" | "account-unavailable";
}): "offline-retry" | "expired-session" | "account-failed" | "account-unavailable" {
  if (!input.online) return "offline-retry";
  if (input.sessionExpired) return "expired-session";
  return input.fallback ?? "account-failed";
}

export function isExpiredMemberSession(error: unknown): boolean {
  const candidate = error as { status?: number; message?: string; code?: string } | null;
  if (candidate?.status === 401) return true;
  return /jwt|unauthori[sz]ed|not authenticated|auth session|session.*expired/i.test(
    `${candidate?.code ?? ""} ${candidate?.message ?? ""}`,
  );
}
