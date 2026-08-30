import { applyLang, LANG_META, type Lang, useI18n } from "@/lib/i18n";

const PUBLIC_LANGUAGES: Lang[] = ["he", "ar", "en"];

export interface PublicLanguageSwitcherProps {
  /** Retained for callers that already own locale state. */
  lang?: Lang;
  className?: string;
}

export function PublicLanguageSwitcher({ lang, className = "" }: PublicLanguageSwitcherProps) {
  const { lang: activeLang, t } = useI18n();
  const selectedLang = lang ?? activeLang;

  return (
    <div
      className={`inline-flex border border-gold/30 bg-ivory text-[10px] uppercase tracking-[0.18em] ${className}`}
      role="group"
      aria-label={t("profile.language")}
    >
      {PUBLIC_LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => applyLang(code)}
          aria-pressed={selectedLang === code}
          lang={code}
          dir={LANG_META[code].dir}
          className={`min-h-[var(--cc-target-min)] min-w-[var(--cc-target-min)] px-3 py-1.5 focus-visible:outline-[var(--cc-focus-outline)] focus-visible:outline-offset-[var(--cc-focus-offset)] ${
            selectedLang === code ? "bg-navy text-ivory" : "text-slate hover:text-navy"
          }`}
        >
          {LANG_META[code].label}
        </button>
      ))}
    </div>
  );
}
