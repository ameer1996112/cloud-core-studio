import { MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { StudioLogo } from "@/components/brand/StudioLogo";
import { authImages } from "@/lib/auth-assets";
import { LANG_META, t, type Lang } from "@/lib/i18n";

const STUDIO_LOCATION: Record<Lang, string> = {
  he: "חורפיש, מחוז הצפון, ישראל",
  ar: "حرفيش، المنطقة الشمالية، إسرائيل",
  en: "Hurfeish, North District, Israel",
};

/** Shared presentation only. Session, validation and recovery state stay in the routes. */
export function AuthFrame({
  lang,
  onLocaleChange,
  eyebrow,
  title,
  recovery = false,
  children,
}: {
  lang: Lang;
  onLocaleChange: (lang: Lang) => void;
  eyebrow: string;
  title: string;
  recovery?: boolean;
  children: ReactNode;
}) {
  return (
    <main
      id="main-content"
      dir={LANG_META[lang].dir}
      lang={lang}
      className={`auth-page auth-entry aura-auth${recovery ? " auth-recovery" : ""}`}
    >
      <header className="auth-page-header">
        <div className="auth-masthead-logo">
          <StudioLogo />
        </div>
        <div className="auth-language-switcher" role="group" aria-label={t("profile.language")}>
          {(["he", "en", "ar"] as const).map((code) => (
            <button
              key={code}
              type="button"
              data-active={lang === code}
              aria-pressed={lang === code}
              lang={code}
              dir={LANG_META[code].dir}
              onClick={() => onLocaleChange(code)}
            >
              {LANG_META[code].label}
            </button>
          ))}
        </div>
      </header>
      <section className="auth-studio-photo" aria-labelledby="auth-scene-title">
        <img
          src={authImages.hero.src}
          alt=""
          loading="eager"
          decoding="async"
          fetchPriority="high"
          width={853}
          height={1280}
        />
        <div className="auth-scene-heading">
          <p className="member-eyebrow">{eyebrow}</p>
          <h1 id="auth-scene-title" className="auth-form-title">
            {title}
          </h1>
        </div>
      </section>
      <div className="auth-content">
        <div className="auth-mobile-panel">
          {children}
          <footer className="auth-footer">
            <nav className="auth-legal-links" aria-label={t("legal.terms")}>
              <Link to="/privacy" className="auth-legal-link">
                {t("legal.privacy")}
              </Link>
              <Link to="/terms" className="auth-legal-link">
                {t("legal.terms")}
              </Link>
              <Link to="/support" className="auth-legal-link">
                {t("legal.support")}
              </Link>
              <Link to="/checkout" className="auth-legal-link">
                {t("legal.checkout")}
              </Link>
            </nav>
            <address className="auth-studio-signature">
              <MapPin size={20} strokeWidth={1.5} aria-hidden="true" />
              <div className="auth-studio-signature-copy">
                <span className="auth-studio-name">
                  <bdi lang="en">Cloud and Core Studio</bdi>
                </span>
                <span className="auth-studio-location">{STUDIO_LOCATION[lang]}</span>
              </div>
            </address>
          </footer>
        </div>
      </div>
    </main>
  );
}
