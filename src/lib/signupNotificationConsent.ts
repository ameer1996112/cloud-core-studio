export const DEFAULT_SIGNUP_NOTIFICATION_CHOICES: Readonly<{
  whatsapp: boolean;
  marketing: boolean;
}> = {
  whatsapp: false,
  marketing: false,
};

export const SIGNUP_NOTIFICATION_CONSENT_VERSION = 2;

type SignupNotificationChoices = {
  phone: string;
  whatsapp: boolean;
  marketing: boolean;
};

export function buildSignupNotificationMetadata(input: SignupNotificationChoices) {
  return {
    notification_consent_version: SIGNUP_NOTIFICATION_CONSENT_VERSION,
    whatsapp_signup_opt_in_v2: isValidSignupWhatsappPhone(input.phone) && input.whatsapp,
    email_updates_enabled: true,
    push_updates_enabled: false,
    marketing_updates_enabled: input.marketing,
  };
}

export function isValidSignupWhatsappPhone(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed || !/^[+\d\s().-]+$/.test(trimmed)) return false;

  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}
