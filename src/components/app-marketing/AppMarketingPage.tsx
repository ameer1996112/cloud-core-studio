import { useEffect, useMemo, type JSX } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarCheck,
  CalendarDays,
  Instagram,
  LogIn,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  TicketCheck,
} from "lucide-react";

import {
  APP_STORE_BADGE_PATHS,
  APP_STORE_BADGE_DIMENSIONS,
  buildMarketingHref,
  getAppMarketingAddressDisplay,
  getAppMarketingCopy,
  getAppMarketingScreenshots,
  type AppMarketingPublicProfile,
} from "@/lib/app-marketing";
import { authImages } from "@/lib/auth-assets";
import {
  createBrowserAppMarketingAnalytics,
  createAppMarketingAnalyticsPageContext,
  shouldTrackAppMarketingLanguageChange,
  type AppMarketingAnalyticsEventName,
  type AppMarketingCtaLocation,
} from "@/lib/app-marketing.analytics";
import { applyLang, LANG_META, type Lang } from "@/lib/i18n";
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
    faq: string;
    location: string;
    maps: string;
  }
> = {
  he: {
    skip: "דילוג לתוכן",
    language: "בחירת שפה",
    contact: "יצירת קשר",
    footerNavigation: "קישורים שימושיים",
    faq: "שאלות נפוצות",
    location: "הכתובת שלנו",
    maps: "פתיחה במפות",
  },
  ar: {
    skip: "تخطّي إلى المحتوى",
    language: "اختيار اللغة",
    contact: "التواصل",
    footerNavigation: "روابط مفيدة",
    faq: "أسئلة شائعة",
    location: "عنواننا",
    maps: "الفتح في الخرائط",
  },
  en: {
    skip: "Skip to content",
    language: "Choose language",
    contact: "Contact",
    footerNavigation: "Useful links",
    faq: "Frequently asked questions",
    location: "Find the studio",
    maps: "Open in Maps",
  },
};

type FeatureIcon = typeof CalendarDays;
const FEATURE_ICONS: [FeatureIcon, FeatureIcon, FeatureIcon, FeatureIcon] = [
  CalendarDays,
  TicketCheck,
  CalendarCheck,
  BadgeCheck,
];

type AppMarketingClickTracker = (
  event: AppMarketingAnalyticsEventName,
  ctaLocation: AppMarketingCtaLocation,
) => void;

function LanguageSelector({
  lang,
  marketingUtm,
  onLanguageChange,
}: {
  lang: Lang;
  marketingUtm: Record<string, string>;
  onLanguageChange: (language: Lang) => void;
}): JSX.Element {
  return (
    <div className="app-marketing__languages" role="group" aria-label={PAGE_LABELS[lang].language}>
      {LANGUAGE_ORDER.map((code) => (
        <a
          key={code}
          className="app-marketing__language"
          href={buildMarketingHref(`/app/${code}`, new URLSearchParams(marketingUtm))}
          aria-current={lang === code ? "page" : undefined}
          hrefLang={code}
          lang={code}
          dir={LANG_META[code].dir}
          onClick={() => {
            if (shouldTrackAppMarketingLanguageChange(lang, code)) onLanguageChange(code);
            applyLang(code);
          }}
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
  ctaLocation,
  onTrack,
}: {
  lang: Lang;
  href: string;
  label: string;
  ctaLocation: AppMarketingCtaLocation;
  onTrack: AppMarketingClickTracker;
}): JSX.Element {
  const dimensions = APP_STORE_BADGE_DIMENSIONS[lang];

  return (
    <a
      className="app-marketing__store-link"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      data-app-store-link
      onClick={() => onTrack("app_landing_app_store_click", ctaLocation)}
    >
      <img
        className="app-marketing__store-badge"
        src={APP_STORE_BADGE_PATHS[lang]}
        alt={label}
        width={dimensions.width}
        height={dimensions.height}
      />
    </a>
  );
}

function SectionHeading({
  eyebrow,
  title,
  titleId,
}: {
  eyebrow: string;
  title: string;
  titleId?: string;
}): JSX.Element {
  return (
    <div className="app-marketing__section-heading">
      <p className="app-marketing__eyebrow">{eyebrow}</p>
      <h2 id={titleId}>{title}</h2>
    </div>
  );
}

function ContactLinks({
  profile,
  supportLabel,
  contactLabel,
  ctaLocation,
  onTrack,
}: {
  profile: AppMarketingPublicProfile;
  supportLabel: string;
  contactLabel: string;
  ctaLocation: "location" | "footer";
  onTrack: AppMarketingClickTracker;
}): JSX.Element {
  const publicPhone = profile.publicPhone ?? "055-939-8438";
  const whatsappHref = buildWhatsappHref(profile.whatsappNumber ?? publicPhone, "");

  return (
    <nav className="app-marketing__contact-links" aria-label={contactLabel}>
      <a
        href="/support"
        className="app-marketing__contact-link"
        onClick={() => onTrack("app_landing_support_click", ctaLocation)}
      >
        <MessageCircle aria-hidden="true" />
        <span>{supportLabel}</span>
      </a>
      {profile.contactEmail ? (
        <a className="app-marketing__contact-link" href={`mailto:${profile.contactEmail}`}>
          <Mail aria-hidden="true" />
          <span dir="ltr">{profile.contactEmail}</span>
        </a>
      ) : null}
      {publicPhone ? (
        <a className="app-marketing__contact-link" href={`tel:${publicPhone}`}>
          <Phone aria-hidden="true" />
          <span dir="ltr">{publicPhone}</span>
        </a>
      ) : null}
      {whatsappHref ? (
        <a
          className="app-marketing__contact-link"
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          onClick={() => onTrack("app_landing_whatsapp_click", ctaLocation)}
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
          onClick={() => onTrack("app_landing_instagram_click", ctaLocation)}
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
  const analyticsUtmSource = marketingUtm.utm_source;
  const analyticsUtmMedium = marketingUtm.utm_medium;
  const analyticsUtmCampaign = marketingUtm.utm_campaign;
  const analyticsContext = useMemo(
    () =>
      createAppMarketingAnalyticsPageContext(lang, {
        ...(analyticsUtmSource ? { utm_source: analyticsUtmSource } : {}),
        ...(analyticsUtmMedium ? { utm_medium: analyticsUtmMedium } : {}),
        ...(analyticsUtmCampaign ? { utm_campaign: analyticsUtmCampaign } : {}),
      }),
    [lang, analyticsUtmCampaign, analyticsUtmMedium, analyticsUtmSource],
  );
  const analytics = useMemo(
    () => createBrowserAppMarketingAnalytics(analyticsContext),
    [analyticsContext],
  );

  useEffect(() => {
    analytics?.trackView();
  }, [analytics]);

  const copy = getAppMarketingCopy(lang, trialPrice);
  const address = getAppMarketingAddressDisplay(copy.footer.address, profile.address);
  const labels = PAGE_LABELS[lang];
  const screenshots = getAppMarketingScreenshots(lang);
  const utm = new URLSearchParams(marketingUtm);
  const scheduleHref = buildMarketingHref(`/member/schedule`, utm);
  const authHref = buildMarketingHref(`/auth`, utm);
  const mapsHref = "https://www.google.com/maps/search/?api=1&query=33.016109,35.349285";
  const trackCta: AppMarketingClickTracker = (event, ctaLocation) => {
    analytics?.track(event, { cta_location: ctaLocation });
  };

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
            <LanguageSelector
              lang={lang}
              marketingUtm={marketingUtm}
              onLanguageChange={(language) => analytics?.trackLanguageChange(language)}
            />
            <a
              href={authHref}
              className="app-marketing__header-cta"
              data-auth-link
              onClick={() => trackCta("app_landing_login", "header")}
            >
              <span>{copy.headerAction}</span>
              <ArrowUpRight className="app-marketing__direction-icon" aria-hidden="true" />
            </a>
          </div>
        </div>
      </header>

      <main id="main-content" className="app-marketing__main">
        <section className="app-marketing__hero" aria-labelledby="app-marketing-title">
          <div className="app-marketing__hero-copy">
            <p className="app-marketing__eyebrow">{copy.hero.eyebrow}</p>
            <h1 id="app-marketing-title">{copy.hero.title}</h1>
            <p className="app-marketing__hero-body">{copy.hero.body}</p>
            <p className="app-marketing__trust">{copy.hero.trust}</p>
            {copy.hero.offer ? <p className="app-marketing__offer">{copy.hero.offer}</p> : null}
            <div className="app-marketing__hero-actions">
              <a
                href={scheduleHref}
                className="app-marketing__primary-cta"
                data-schedule-link
                onClick={() => trackCta("app_landing_view_schedule", "hero")}
              >
                <span>{copy.hero.primaryCta}</span>
                <ArrowUpRight className="app-marketing__direction-icon" aria-hidden="true" />
              </a>
              <AppStoreBadge
                lang={lang}
                href={appStoreUrl}
                label={copy.storeAccessibleLabel}
                ctaLocation="hero"
                onTrack={trackCta}
              />
            </div>
            <a
              href={authHref}
              className="app-marketing__member-link"
              data-auth-link
              onClick={() => trackCta("app_landing_login", "hero")}
            >
              {copy.hero.memberCta}
            </a>
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

        <section
          className="app-marketing__trust-signals"
          aria-labelledby="app-marketing-trust-title"
        >
          <SectionHeading
            eyebrow={copy.trustSignals.eyebrow}
            title={copy.trustSignals.title}
            titleId="app-marketing-trust-title"
          />
          <ul className="app-marketing__trust-list">
            {copy.trustSignals.items.map((item) => (
              <li key={item}>
                <BadgeCheck aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
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
            {screenshots.map((screenshot, index) => (
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
                <figcaption>{copy.screenshots.headings[index]}</figcaption>
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
                  <div>
                    <h3>{item}</h3>
                    <p>{copy.classes.descriptions[index]}</p>
                  </div>
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
                decoding="async"
              />
            </figure>
            <figure className="app-marketing__class-image">
              <img
                src="/images/studio/studio-sign.webp"
                alt=""
                width={502}
                height={357}
                loading="lazy"
                decoding="async"
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

        <section className="app-marketing__faq" aria-labelledby="app-marketing-faq-title">
          <SectionHeading
            eyebrow={copy.hero.eyebrow}
            title={labels.faq}
            titleId="app-marketing-faq-title"
          />
          <div className="app-marketing__faq-list">
            {copy.faq.map(([question, answer]) => (
              <details className="app-marketing__faq-item" key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="app-marketing__location" aria-labelledby="app-marketing-location-title">
          <div className="app-marketing__location-copy">
            <p className="app-marketing__eyebrow">{copy.footer.location}</p>
            <h2 id="app-marketing-location-title">{labels.location}</h2>
            <address>{address.localized}</address>
            {address.canonical ? (
              <p className="app-marketing__canonical-address" dir="auto">
                {address.canonical}
              </p>
            ) : null}
            <a
              className="app-marketing__maps-link"
              href={mapsHref}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackCta("app_landing_maps_click", "location")}
            >
              <MapPin aria-hidden="true" />
              <span>{labels.maps}</span>
            </a>
          </div>
          <ContactLinks
            profile={profile}
            supportLabel={copy.footer.support}
            contactLabel={labels.contact}
            ctaLocation="location"
            onTrack={trackCta}
          />
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
            <a
              href={scheduleHref}
              className="app-marketing__primary-cta app-marketing__primary-cta--ivory"
              data-schedule-link
              onClick={() => trackCta("app_landing_view_schedule", "final")}
            >
              <span>{copy.hero.primaryCta}</span>
              <ArrowUpRight className="app-marketing__direction-icon" aria-hidden="true" />
            </a>
            <AppStoreBadge
              lang={lang}
              href={appStoreUrl}
              label={copy.storeAccessibleLabel}
              ctaLocation="final"
              onTrack={trackCta}
            />
            <a
              href={authHref}
              className="app-marketing__final-login"
              data-login-link
              onClick={() => trackCta("app_landing_login", "final")}
            >
              <LogIn aria-hidden="true" />
              <span>{copy.finalCta.actions[2]}</span>
            </a>
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
            <p className="app-marketing__footer-address">{address.localized}</p>
            {address.canonical ? (
              <p
                className="app-marketing__footer-address app-marketing__footer-address--canonical"
                dir="auto"
              >
                {address.canonical}
              </p>
            ) : null}
          </div>
          <ContactLinks
            profile={profile}
            supportLabel={copy.footer.support}
            contactLabel={labels.contact}
            ctaLocation="footer"
            onTrack={trackCta}
          />
          <nav className="app-marketing__footer-nav" aria-label={labels.footerNavigation}>
            <a href="/support" onClick={() => trackCta("app_landing_support_click", "footer")}>
              {copy.footer.support}
            </a>
            <a href="/privacy">{copy.footer.privacy}</a>
            <a href="/terms">{copy.footer.terms}</a>
            <a href={authHref} onClick={() => trackCta("app_landing_login", "footer")}>
              {copy.footer.signIn}
            </a>
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
