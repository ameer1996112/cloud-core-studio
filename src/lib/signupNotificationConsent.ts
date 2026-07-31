export const DEFAULT_SIGNUP_NOTIFICATION_CHOICES: Readonly<{
  whatsapp: boolean;
  marketing: boolean;
}> = {
  whatsapp: false,
  marketing: false,
};

type SignupNotificationChoices = {
  phone: string;
  whatsapp: boolean;
  marketing: boolean;
};

export function buildSignupNotificationMetadata(input: SignupNotificationChoices) {
  return {
    whatsapp_updates_enabled: Boolean(input.phone.trim()) && input.whatsapp,
    email_updates_enabled: true,
    push_updates_enabled: false,
    marketing_updates_enabled: input.marketing,
  };
}
