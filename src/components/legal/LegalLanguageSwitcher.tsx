import { applyLang, LANG_META, t, type Lang } from "@/lib/i18n";

export function LegalLanguageSwitcher({ lang }: { lang: Lang }) {
  return (
    <div
      className="inline-flex border border-gold/30 bg-ivory text-[10px] uppercase tracking-[0.18em]"
      role="group"
      aria-label={t("profile.language")}
    >
      {(Object.keys(LANG_META) as Lang[]).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => applyLang(code)}
          aria-pressed={lang === code}
          lang={code}
          dir={LANG_META[code].dir}
          className={`min-h-11 px-3 py-1.5 ${
            lang === code ? "bg-navy text-ivory" : "text-slate hover:text-navy"
          }`}
        >
          {LANG_META[code].label}
        </button>
      ))}
    </div>
  );
}
