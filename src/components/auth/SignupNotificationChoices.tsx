import { MailCheck, MessageCircle, Tag } from "lucide-react";
import { tForLang, type Lang } from "@/lib/i18n";
import { isValidSignupWhatsappPhone } from "@/lib/signupNotificationConsent";

const WHATSAPP_PHONE_HELP_ID = "signup-whatsapp-phone-help";

type SignupNotificationChoicesProps = {
  lang: Lang;
  phone: string;
  whatsapp: boolean;
  marketing: boolean;
  disabled?: boolean;
  onWhatsappChange: (checked: boolean) => void;
  onMarketingChange: (checked: boolean) => void;
};

export function SignupNotificationChoices({
  lang,
  phone,
  whatsapp,
  marketing,
  disabled = false,
  onWhatsappChange,
  onMarketingChange,
}: SignupNotificationChoicesProps) {
  const hasValidPhone = isValidSignupWhatsappPhone(phone);
  const copy = (key: Parameters<typeof tForLang>[1]) => tForLang(lang, key);

  return (
    <section
      aria-labelledby="signup-notification-choices-title"
      className="border-t border-gold/20 pt-4 text-start"
    >
      <h2 id="signup-notification-choices-title" className="text-sm font-semibold text-navy">
        {copy("auth.notificationChoicesTitle")}
      </h2>

      <div className="mt-3 flex gap-3 rounded-xl border border-gold/15 bg-ivory/45 px-3 py-3 text-navy">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold-dark" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium leading-6">{copy("auth.essentialEmailTitle")}</p>
          <p className="mt-0.5 text-xs leading-5 text-slate">{copy("auth.essentialEmailBody")}</p>
        </div>
      </div>

      <div className="mt-2 space-y-2">
        <ConsentChoice
          checked={hasValidPhone && whatsapp}
          descriptionId={!hasValidPhone ? WHATSAPP_PHONE_HELP_ID : undefined}
          disabled={disabled || !hasValidPhone}
          icon={<MessageCircle className="h-5 w-5" aria-hidden="true" />}
          label={copy("auth.notificationConsentWhatsapp")}
          onChange={onWhatsappChange}
        />
        {!hasValidPhone ? (
          <p id={WHATSAPP_PHONE_HELP_ID} className="px-1 text-xs leading-5 text-slate">
            {copy("auth.notificationConsentWhatsappNeedsPhone")}
          </p>
        ) : null}
        <ConsentChoice
          checked={marketing}
          icon={<Tag className="h-5 w-5" aria-hidden="true" />}
          label={copy("auth.notificationConsentMarketing")}
          onChange={onMarketingChange}
        />
      </div>

      <p className="mt-2 px-1 text-xs leading-5 text-slate">
        {copy("auth.notificationConsentBody")}
      </p>
    </section>
  );
}

function ConsentChoice({
  checked,
  descriptionId,
  disabled = false,
  icon,
  label,
  onChange,
}: {
  checked: boolean;
  descriptionId?: string;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex min-h-12 items-center justify-between gap-4 rounded-xl border px-3 py-2.5 text-sm leading-6 transition-colors ${
        disabled
          ? "cursor-not-allowed border-slate/10 bg-slate/5 text-slate"
          : "border-gold/15 bg-ivory/45 text-navy"
      }`}
    >
      <span className="flex items-center gap-3">
        <span className="shrink-0 text-gold-dark">{icon}</span>
        <span>{label}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={descriptionId}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 shrink-0 accent-navy"
      />
    </label>
  );
}
