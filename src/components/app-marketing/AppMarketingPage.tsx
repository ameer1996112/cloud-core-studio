import { Link } from "@tanstack/react-router";
import type { JSX } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarCheck,
  CalendarDays,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  TicketCheck,
} from "lucide-react";

import {
  APP_STORE_BADGE_PATHS,
  buildMarketingHref,
  getAppMarketingCopy,
  getAppMarketingScreenshots,
  type AppMarketingPublicProfile,
} from "@/lib/app-marketing";
import { authImages } from "@/lib/auth-assets";
import { LANG_META, type Lang } from "@/lib/i18n";
import { buildWhatsappHref } from "@/lib/instagramLanding";

import "./app-marketing.css";

export type AppMarketingPageProps = {
  lang: Lang;
  appStoreUrl: string;
  marketingUtm?: Record<string, string>;
  profile: AppMarketingPublicProfile;
  trialPrice?: number | null;
};

const LANGUAGE_ORDER: Lang[] = ["he", "ar", "en"];
const APPLE_CREDIT =
  "Apple and the Apple logo are trademarks of Apple Inc., registered in the U.S. and other countries and regions. App Store is a service mark of Apple Inc.";

const PAGE_LABELS: Record<
  Lang,
  {
    skip: string;
    language: string;
    contact: string;
    footerNavigation: string;
  }
> = {
  he: {
    skip: "דילוג לתוכן",
    language: "בחירת שפה",
    contact: "יצירת קשר",
    footerNavigation: "קישורים שימושיים",
  },
  ar: {
    skip: "تخطّي إلى المحتوى",
    language: "اختيار اللغة",
    contact: "التواصل",
    footerNavigation: "روابط مفيدة",
  },
  en: {
    skip: "Skip to content",
    language: "Choose language",
    contact: "Contact",
    footerNavigation: "Useful links",
  },
};

type FeatureIcon = typeof CalendarDays;
const FEATURE_ICONS: [FeatureIcon, FeatureIcon, FeatureIcon, FeatureIcon] = [
  CalendarDays,
  TicketCheck,
  CalendarCheck,
  BadgeCheck,
];

function LanguageSelector({
  lang,
  marketingUtm,
}: {
  lang: Lang;
  marketingUtm: Record<string, string>;
}): JSX.Element {
  return (
    <div className="app-marketing__languages" role="group" aria-label={PAGE_LABELS[lang].language}>
      {LANGUAGE_ORDER.map((code) => (
        <a
          key={code}
          className="app-marketing__language"
          href={buildMarketingHref(`/app/${code}`, new URLSearchParams(marketingUtm))}
          aria-current={lang === code ? "page" : undefined}
          lang={code}
          dir={LANG_META[code].dir}
        >
          {LANG_META[code].label}
        </a>
      ))}
    </div>
  );
}

function AppStoreBadge({
  lang,
  href,
  label,
}: {
  lang: Lang;
  href: string;
  label: string;
}): JSX.Element {
  return (
    <a
      className="app-marketing__store-link"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      data-app-store-link
    >
      <img
        className="app-marketing__store-badge"
        src={APP_STORE_BADGE_PATHS[lang]}
        alt={label}
        height={40}
      />
    </a>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }): JSX.Element {
  return (
    <div className="app-marketing__section-heading">
      <p className="app-marketing__eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
    </div>
  );
}

function ContactLinks({
  profile,
  supportLabel,
  contactLabel,
}: {
  profile: AppMarketingPublicProfile;
  supportLabel: string;
  contactLabel: string;
}): JSX.Element {
  const whatsappHref = buildWhatsappHref(profile.whatsappNumber, "");

  return (
    <nav className="app-marketing__contact-links" aria-label={contactLabel}>
      <Link to="/support" className="app-marketing__contact-link">
        <MessageCircle aria-hidden="true" />
        <span>{supportLabel}</span>
      </Link>
      {profile.contactEmail ? (
        <a className="app-marketing__contact-link" href={`mailto:${profile.contactEmail}`}>
          <Mail aria-hidden="true" />
          <span dir="ltr">{profile.contactEmail}</span>
        </a>
      ) : null}
      {profile.publicPhone ? (
        <a className="app-marketing__contact-link" href={`tel:${profile.publicPhone}`}>
          <Phone aria-hidden="true" />
          <span dir="ltr">{profile.publicPhone}</span>
        </a>
      ) : null}
      {whatsappHref ? (
        <a
          className="app-marketing__contact-link"
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle aria-hidden="true" />
          <span>WhatsApp</span>
        </a>
      ) : null}
      {profile.instagramUrl ? (
        <a
          className="app-marketing__contact-link"
          href={profile.instagramUrl}
          target="_blank"
          rel="noreferrer"
        >
          <Instagram aria-hidden="true" />
          <span>Instagram</span>
        </a>
      ) : null}
    </nav>
  );
}

export function AppMarketingPage({
  lang,
  appStoreUrl,
  marketingUtm = {},
  profile,
  trialPrice = null,
}: AppMarketingPageProps): JSX.Element {
  const copy = getAppMarketingCopy(lang, trialPrice);
  const labels = PAGE_LABELS[lang];
  const screenshots = getAppMarketingScreenshots(lang);

  return (
    <div className="app-marketing" lang={lang} dir={LANG_META[lang].dir}>
      <a className="app-marketing__skip-link" href="#main-content">
        {labels.skip}
      </a>

      <header className="app-marketing__header">
        <div className="app-marketing__header-inner">
          <a
            href={buildMarketingHref(`/app/${lang}`, new URLSearchParams(marketingUtm))}
            className="app-marketing__brand-link"
            aria-label="Cloud & Core Studio"
          >
            <img
              className="app-marketing__header-logo"
              src="/brand/cloud-core-logo-full.webp"
              alt="Cloud & Core Studio"
              width={164}
              height={100}
            />
          </a>
          <div className="app-marketing__header-actions">
            <LanguageSelector lang={lang} marketingUtm={marketingUtm} />
            <Link to="/auth" className="app-marketing__header-cta" data-auth-link>
              <span>{copy.headerAction}</span>
              <ArrowUpRight className="app-marketing__direction-icon" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="app-marketing__main">
        <section className="app-marketing__hero" aria-labelledby="app-marketing-title">
          <div className="app-marketing__hero-copy">
            <p className="app-marketing__eyebrow">{copy.hero.eyebrow}</p>
            <h1 id="app-marketing-title">{copy.hero.title}</h1>
            <p className="app-marketing__hero-body">{copy.hero.body}</p>
            <div className="app-marketing__hero-actions">
              <Link to="/auth" className="app-marketing__primary-cta" data-auth-link>
                <span>{copy.hero.primaryCta}</span>
                <ArrowUpRight className="app-marketing__direction-icon" aria-hidden="true" />
              </Link>
              <AppStoreBadge lang={lang} href={appStoreUrl} label={copy.hero.storeCta} />
            </div>
          </div>

          <figure className="app-marketing__hero-media">
            <span className="app-marketing__hero-rule" aria-hidden="true" />
            <img
              src="/images/auth/cloud-core-auth-hero.webp"
              alt={authImages.hero.alt[lang]}
              width={853}
              height={1280}
              fetchPriority="high"
            />
            <figcaption aria-hidden="true">Cloud &amp; Core · Hurfeish</figcaption>
          </figure>
        </section>

        <section className="app-marketing__features" aria-label={copy.features.title}>
          <SectionHeading eyebrow={copy.features.eyebrow} title={copy.features.title} />
          <div className="app-marketing__feature-grid">
            {copy.features.items.map(([title, body], index) => {
              const Icon = FEATURE_ICONS[index];
              return (
                <article className="app-marketing__feature" key={title}>
                  <div className="app-marketing__feature-number" aria-hidden="true">
                    0{index + 1}
                  </div>
                  <Icon className="app-marketing__feature-icon" aria-hidden="true" />
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="app-marketing__screens-section" aria-label={copy.screenshots.title}>
          <SectionHeading eyebrow={copy.screenshots.eyebrow} title={copy.screenshots.title} />
          <div
            className="app-marketing__screenshots"
            role="region"
            aria-label={copy.screenshots.title}
            tabIndex={0}
          >
            {screenshots.map((screenshot) => (
              <figure
                className="app-marketing__screenshot"
                data-app-screenshot
                key={screenshot.kind}
              >
                <div className="app-marketing__phone-top" aria-hidden="true" />
                <img
                  src={screenshot.src}
                  alt={screenshot.alt}
                  width={390}
                  height={844}
                  loading="lazy"
                  decoding="async"
                />
              </figure>
            ))}
          </div>
        </section>

        <section className="app-marketing__classes" aria-label={copy.classes.title}>
          <div className="app-marketing__classes-copy">
            <SectionHeading eyebrow={copy.classes.eyebrow} title={copy.classes.title} />
            <p className="app-marketing__classes-body">{copy.classes.body}</p>
            <ul className="app-marketing__class-list">
              {copy.classes.items.map((item, index) => (
                <li key={item}>
                  <span aria-hidden="true">0{index + 1}</span>
                  <strong>{item}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="app-marketing__classes-media" aria-hidden="true">
            <figure className="app-marketing__studio-image">
              <img
                src="/images/studio/studio-interior.webp"
                alt=""
                width={512}
                height={357}
                loading="lazy"
              />
            </figure>
            <figure className="app-marketing__class-image">
              <img
                src="/images/classes/aerial-yoga-flow.webp"
                alt=""
                width={1270}
                height={714}
                loading="lazy"
              />
            </figure>
          </div>
        </section>

        <section className="app-marketing__steps" aria-label={copy.steps.title}>
          <SectionHeading eyebrow={copy.steps.eyebrow} title={copy.steps.title} />
          <ol className="app-marketing__steps-list">
            {copy.steps.items.map((item, index) => (
              <li key={item}>
                <span className="app-marketing__step-number" aria-hidden="true">
                  0{index + 1}
                </span>
                <strong>{item}</strong>
              </li>
            ))}
          </ol>
        </section>

        <section className="app-marketing__final-cta" aria-labelledby="app-marketing-final-title">
          <div className="app-marketing__final-copy">
            <p className="app-marketing__final-location">
              <MapPin aria-hidden="true" />
              <span>{copy.footer.location}</span>
            </p>
            <h2 id="app-marketing-final-title">{copy.finalCta.title}</h2>
            <p>{copy.finalCta.body}</p>
          </div>
          <div className="app-marketing__final-actions">
            <Link
              to="/auth"
              className="app-marketing__primary-cta app-marketing__primary-cta--ivory"
              data-auth-link
            >
              <span>{copy.hero.primaryCta}</span>
              <ArrowUpRight className="app-marketing__direction-icon" aria-hidden="true" />
            </Link>
            <AppStoreBadge lang={lang} href={appStoreUrl} label={copy.hero.storeCta} />
            <Link to="/support" className="app-marketing__final-support">
              <MessageCircle aria-hidden="true" />
              <span>{copy.footer.support}</span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="app-marketing__footer">
        <div className="app-marketing__footer-primary">
          <div className="app-marketing__footer-brand">
            <img
              src="/brand/cloud-core-wordmark.svg"
              alt="Cloud & Core Studio"
              width={210}
              height={49}
            />
            <p>Cloud &amp; Core Studio</p>
            <p className="app-marketing__footer-location">{copy.footer.location}</p>
            {profile.address ? (
              <p className="app-marketing__footer-address">{profile.address}</p>
            ) : null}
          </div>
          <ContactLinks
            profile={profile}
            supportLabel={copy.footer.support}
            contactLabel={labels.contact}
          />
          <nav className="app-marketing__footer-nav" aria-label={labels.footerNavigation}>
            <Link to="/support">{copy.footer.support}</Link>
            <Link to="/privacy">{copy.footer.privacy}</Link>
            <Link to="/terms">{copy.footer.terms}</Link>
            <Link to="/auth">{copy.footer.signIn}</Link>
          </nav>
        </div>
        <div className="app-marketing__footer-legal">
          <p>© {new Date().getFullYear()} Cloud &amp; Core Studio</p>
          <p lang="en" dir="ltr">
            {APPLE_CREDIT}
          </p>
        </div>
      </footer>
    </div>
  );
}
