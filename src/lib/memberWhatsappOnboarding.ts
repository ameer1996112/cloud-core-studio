import { isValidSignupWhatsappPhone } from "@/lib/signupNotificationConsent";

const LEGACY_AUTO_CONSENT_SOURCES = new Set([
  "existing_member_auto_enable",
  "new_active_member_auto_enable",
  "legacy_auto_enable_pending_reconsent",
]);

export function shouldOfferMemberWhatsappOnboarding(input: {
  phone: string | null;
  whatsappEnabled: boolean;
  consentSource: string | null;
  optedOutAt: string | null;
}) {
  if (!isValidSignupWhatsappPhone(input.phone ?? "")) return false;
  if (input.optedOutAt) return false;
  if (input.consentSource && !LEGACY_AUTO_CONSENT_SOURCES.has(input.consentSource)) return false;
  return !input.whatsappEnabled || LEGACY_AUTO_CONSENT_SOURCES.has(input.consentSource ?? "");
}
