import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import {
  Apple,
  ArrowLeft,
  Check,
  Instagram,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";

import { appendTrackingParams, getDownloadConfig } from "@/lib/download-config";
import {
  KIDS_TRIAL_WHATSAPP_MESSAGE,
  STUDIO_INSTAGRAM_URL,
  VERIFIED_STUDIO_WHATSAPP,
  WOMEN_TRIAL_WHATSAPP_MESSAGE,
  buildGoogleMapsHref,
  buildWhatsappHref,
  normalizeWhatsappNumber,
} from "@/lib/instagramLanding";
import {
  getInstagramAnalytics,
  trackTrialWhatsappClick,
  type InstagramLandingEventName,
} from "@/lib/instagramLanding.analytics";
import {
  getInstagramLandingData,
  type InstagramAdultPlan,
  type InstagramKidsPlan,
  type InstagramLandingData,
} from "@/lib/instagramLanding.functions";

import "./instagram.css";

const CANONICAL_URL = "https://cloudandcorestudio.com/instagram";
const HERO_IMAGE = "/images/auth/cloud-core-auth-hero.webp";
const ARABIC_ADDRESS = "حرفيش، الشارع الرئيسي 89";

type InstagramRouteData = InstagramLandingData & {
  androidHref: string;
  appStoreHref: string;
  kidsWhatsappHref: string;
  mapsHref: string;
  womenWhatsappHref: string;
};

type VerifiedTestimonial = {
  body: string;
  name: string;
};

const VERIFIED_TESTIMONIALS: VerifiedTestimonial[] = [];

export const Route = createFileRoute("/instagram")({
  head: () => ({
    meta: [
      { title: "Cloud & Core | حصة تجريبية في حرفيش بـ80 ₪" },
      {
        name: "description",
        content:
          "يوغا هوائية وبيلاتس للنساء، ويوغا هوائية للأطفال من عمر 7 سنوات في استوديو Cloud & Core في حرفيش. حصة تجريبية بـ80 ₪.",
      },
      { property: "og:title", content: "Cloud & Core | مساحة للحركة في حرفيش" },
      {
        property: "og:description",
        content:
          "يوغا هوائية، Mat Pilates و-HOT Pilates للنساء، ومجموعات أطفال من عمر 7+. تجربة بـ80 ₪.",
      },
      { property: "og:image", content: `https://cloudandcorestudio.com${HERO_IMAGE}` },
      { property: "og:image:alt", content: "استوديو Cloud & Core والحرائر الهوائية في حرفيش" },
      { property: "og:locale", content: "ar_IL" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: CANONICAL_URL },
      { name: "twitter:title", content: "Cloud & Core | حصة تجريبية بـ80 ₪" },
      {
        name: "twitter:description",
        content: "استوديو بوتيك لليوغا الهوائية والبيلاتس للنساء والأطفال في حرفيش.",
      },
      { name: "twitter:image", content: `https://cloudandcorestudio.com${HERO_IMAGE}` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: CANONICAL_URL },
      { rel: "preload", href: HERO_IMAGE, as: "image", type: "image/webp" },
    ],
  }),
  loader: async ({ location }): Promise<InstagramRouteData> => {
    const downloadConfig = getDownloadConfig();
    let data: InstagramLandingData;

    try {
      data = await getInstagramLandingData();
    } catch {
      data = {
        address: null,
        adultPlans: [],
        contactEmail: null,
        instagramUrl: STUDIO_INSTAGRAM_URL,
        kidsCapacity: null,
        kidsPlans: [],
        publicPhone: VERIFIED_STUDIO_WHATSAPP,
        trialClassAllowed: true,
        whatsappNumber: VERIFIED_STUDIO_WHATSAPP,
      };
    }

    const whatsappNumber = data.whatsappNumber || VERIFIED_STUDIO_WHATSAPP;
    return {
      ...data,
      androidHref: downloadConfig.googlePlayUrl
        ? appendTrackingParams(downloadConfig.googlePlayUrl, location.searchStr)
        : "",
      appStoreHref: appendTrackingParams(downloadConfig.appStoreUrl, location.searchStr),
      kidsWhatsappHref: buildWhatsappHref(whatsappNumber, KIDS_TRIAL_WHATSAPP_MESSAGE),
      mapsHref: buildGoogleMapsHref(data.address),
      womenWhatsappHref: buildWhatsappHref(whatsappNumber, WOMEN_TRIAL_WHATSAPP_MESSAGE),
    };
  },
  component: InstagramLandingPage,
});

function InstagramLandingPage() {
  const data = Route.useLoaderData();
  const pricingRef = useRef<HTMLElement>(null);
  const offerRef = useRef<HTMLDivElement>(null);
  const trialPrice = findTrialPrice(data.adultPlans) ?? 80;

  useEffect(() => {
    const previousLanguage = document.documentElement.lang;
    const previousDirection = document.documentElement.dir;
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    getInstagramAnalytics()?.trackOnce("instagram-landing-view", "instagram_landing_view");
    return () => {
      document.documentElement.lang = previousLanguage;
      document.documentElement.dir = previousDirection;
    };
  }, []);
  useTrackedSectionView(pricingRef, "pricing_view", "pricing");
  useTrackedSectionView(offerRef, "limited_offer_view", "limited-offer");

  const phone = data.publicPhone || data.whatsappNumber || VERIFIED_STUDIO_WHATSAPP;
  const phoneHref = normalizeWhatsappNumber(phone) ? `tel:+${normalizeWhatsappNumber(phone)}` : "";
  const structuredData = buildLocalBusinessSchema(data, trialPrice, phone);

  return (
    <main id="top" className="igc-page" dir="rtl" lang="ar">
      <a className="igc-skip-link" href="#igc-main-content">
        انتقلي إلى المحتوى الرئيسي
      </a>

      <header className="igc-header" aria-label="Cloud & Core">
        <a className="igc-brand" href="#top" aria-label="Cloud & Core Studio">
          <img src="/brand/cloud-core-wordmark.svg" width="168" height="37" alt="Cloud & Core" />
        </a>
        <div className="igc-location" aria-label="موقع الاستوديو">
          <MapPin aria-hidden="true" />
          <span lang="ar">حرفيش · الشمال</span>
          <span lang="he" dir="rtl">
            חורפיש · צפון
          </span>
        </div>
        <a
          className="igc-header-instagram"
          href={data.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Cloud & Core on Instagram"
          onClick={() =>
            getInstagramAnalytics()?.track("instagram_direct_click", {
              cta_location: "header",
              link_type: "profile",
            })
          }
        >
          <Instagram aria-hidden="true" />
        </a>
      </header>

      <section id="igc-main-content" className="igc-hero" aria-labelledby="igc-title">
        <figure className="igc-hero-media">
          <img
            src={HERO_IMAGE}
            width="853"
            height="1280"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            alt="الحرائر الهوائية الفيروزية وشعار Cloud & Core داخل الاستوديو الحقيقي في حرفيش"
          />
          <figcaption>
            <span lang="ar">الاستوديو في حرفيش</span>
            <span lang="he" dir="rtl">
              הסטודיו בחורפיש
            </span>
          </figcaption>
        </figure>

        <div className="igc-hero-copy">
          <p className="igc-eyebrow">AERIAL · MAT · HOT PILATES</p>
          <h1 id="igc-title">
            <span className="igc-title-main">مساحة للحركة.</span>
            <span className="igc-title-accent">مكان إلك.</span>
          </h1>
          <p className="igc-lead" lang="ar">
            يوغا هوائية، بيلاتس وحصص بوتيك للنساء والأطفال في حرفيش.
          </p>
          <p className="igc-secondary-copy" lang="he" dir="rtl">
            סטודיו בוטיק בחורפיש ליוגה אווירית, פילאטיס ותנועה.
          </p>
          <div className="igc-trial-lockup" aria-label={`حصة تجريبية ${trialPrice} شيكل`}>
            <span>
              <b lang="ar">حصة تجريبية</b>
              <small lang="he" dir="rtl">
                שיעור ניסיון
              </small>
            </span>
            <strong>
              <bdi dir="ltr">{trialPrice} ₪</bdi>
            </strong>
          </div>
          <p className="igc-beginner-note">
            <Check aria-hidden="true" />
            <span lang="ar">مناسبة للمبتدئات</span>
            <span aria-hidden="true">·</span>
            <span lang="he" dir="rtl">
              מתאים למתחילות
            </span>
          </p>
        </div>
      </section>

      <section className="igc-booking" aria-labelledby="igc-booking-title">
        <div className="igc-section-heading">
          <p className="igc-eyebrow">ابدئي من هون</p>
          <h2 id="igc-booking-title">اختاري التجربة المناسبة إلك</h2>
          <p lang="he" dir="rtl">
            בחרי את שיעור הניסיון שמתאים לך
          </p>
        </div>

        <div className="igc-booking-grid">
          <article className="igc-booking-card igc-booking-card--women">
            <span className="igc-card-index">01</span>
            <div>
              <p className="igc-card-label">للنساء · לנשים</p>
              <h3>يوغا هوائية وبيلاتس</h3>
              <p lang="he" dir="rtl">
                יוגה אווירית, Mat Pilates ו־HOT Pilates
              </p>
            </div>
            <WhatsAppCta
              href={data.womenWhatsappHref}
              audience="women"
              location="booking-card"
              arabic="احجزي حصة تجريبية للنساء"
              hebrew="שיעור ניסיון לנשים"
              className="igc-primary-cta"
            />
            <div ref={offerRef} className="igc-offer">
              <span>عرض افتتاحي لأول 10 مشتركات</span>
              <strong>خصم 50% على الشهر الأول</strong>
              <p>عند الاشتراك خلال 24 ساعة من حصة التجربة.</p>
              <small lang="he" dir="rtl">
                ל־10 מצטרפות חדשות ראשונות, בהרשמה בתוך 24 שעות משיעור הניסיון.
              </small>
            </div>
          </article>

          <article className="igc-booking-card igc-booking-card--kids">
            <span className="igc-card-index">02</span>
            <div>
              <p className="igc-card-label">للأطفال · לילדים</p>
              <h3>يوغا هوائية من عمر 7+</h3>
              <p lang="he" dir="rtl">
                יוגה אווירית לילדים מגיל 7+
              </p>
            </div>
            <WhatsAppCta
              href={data.kidsWhatsappHref}
              audience="kids"
              location="booking-card"
              arabic="احجزوا تجربة للأطفال 7+"
              hebrew="שיעור ניסיון לילדים מגיל 7+"
              className="igc-secondary-cta"
            />
            <p className="igc-kids-note">معدات مهنية، إشراف قريب وتجربة مناسبة من عمر 7 سنوات.</p>
          </article>
        </div>
      </section>

      <section className="igc-trust" aria-labelledby="igc-trust-title">
        <div className="igc-section-heading igc-section-heading--light">
          <p className="igc-eyebrow">WHY CLOUD &amp; CORE</p>
          <h2 id="igc-trust-title">ليش Cloud &amp; Core؟</h2>
          <p lang="he" dir="rtl">
            למה Cloud &amp; Core?
          </p>
        </div>
        <div className="igc-trust-grid">
          <TrustItem arabic="مجموعات صغيرة" hebrew="קבוצות קטנות" />
          <TrustItem arabic="اهتمام وإشراف شخصي" hebrew="יחס וליווי אישי" />
          <TrustItem arabic="مناسب للمبتدئات" hebrew="מתאים למתחילות" />
          <TrustItem arabic="أجواء هادئة ومريحة" hebrew="אווירה רגועה ונעימה" />
          <TrustItem arabic="استوديو بوتيك محلي في حرفيش" hebrew="סטודיו בוטיק מקומי בחורפיש" />
          <TrustItem
            arabic={`حتى ${data.kidsCapacity ?? 7} أطفال في مجموعة الأطفال`}
            hebrew={`עד ${data.kidsCapacity ?? 7} ילדים בקבוצת הילדים`}
          />
        </div>
      </section>

      <section className="igc-experience igc-experience--women" aria-labelledby="igc-women-title">
        <div className="igc-experience-copy">
          <p className="igc-eyebrow">للنساء</p>
          <h2 id="igc-women-title">قوة، حركة ووقت إلك.</h2>
          <p>بيئة هادئة ومناسبة للمبتدئات، بمجموعات صغيرة واهتمام شخصي في كل حصة.</p>
          <p className="igc-secondary-copy" lang="he" dir="rtl">
            סביבה רגועה שמתאימה למתחילות, עם קבוצות קטנות ויחס אישי בכל שיעור.
          </p>
          <div className="igc-discipline-list" aria-label="Women’s classes">
            <span>Aerial Yoga</span>
            <span>Mat Pilates</span>
            <span>HOT Pilates</span>
          </div>
          <WhatsAppCta
            href={data.womenWhatsappHref}
            audience="women"
            location="women-section"
            arabic={`احجزي تجربة بـ${trialPrice} ₪`}
            hebrew={`קבעי שיעור ניסיון ב־${trialPrice} ₪`}
            className="igc-primary-cta"
          />
        </div>
        <div className="igc-experience-mark" aria-hidden="true">
          <span>هدوء</span>
          <span>قوة</span>
          <span>توازن</span>
        </div>
      </section>

      <section className="igc-experience igc-experience--kids" aria-labelledby="igc-kids-title">
        <div className="igc-kids-visual" aria-hidden="true">
          <Users />
          <span>{data.kidsCapacity ?? 7}</span>
          <small>MAX</small>
        </div>
        <div className="igc-experience-copy">
          <p className="igc-eyebrow">للأطفال من عمر 7+</p>
          <h2 id="igc-kids-title">حركة، ثقة ومتعة بإشراف قريب.</h2>
          <ul className="igc-check-list">
            <li>
              <Check aria-hidden="true" /> مجموعات صغيرة
            </li>
            <li>
              <Check aria-hidden="true" /> إشراف واهتمام قريب
            </li>
            <li>
              <Check aria-hidden="true" /> حصة تجريبية بـ<bdi dir="ltr">{trialPrice} ₪</bdi>
            </li>
            <li>
              <Check aria-hidden="true" /> حتى {data.kidsCapacity ?? 7} أطفال في المجموعة
            </li>
          </ul>
          <p className="igc-secondary-copy" lang="he" dir="rtl">
            תנועה, ביטחון והנאה בליווי קרוב, בקבוצה של עד {data.kidsCapacity ?? 7} ילדים.
          </p>
          <WhatsAppCta
            href={data.kidsWhatsappHref}
            audience="kids"
            location="kids-section"
            arabic="احجزوا حصة تجربة للأطفال"
            hebrew="קבעו שיעור ניסיון לילדים"
            className="igc-secondary-cta"
          />
        </div>
      </section>

      <section ref={pricingRef} className="igc-pricing" aria-labelledby="igc-pricing-title">
        <div className="igc-section-heading">
          <p className="igc-eyebrow">أسعار محدثة من نظام الاستوديو</p>
          <h2 id="igc-pricing-title">الأسعار</h2>
          <p lang="he" dir="rtl">
            מחירים מעודכנים ממערכת הסטודיו
          </p>
        </div>

        <div className="igc-pricing-columns">
          <PricingGroup titleArabic="للنساء" titleHebrew="לנשים">
            {data.adultPlans.length ? (
              data.adultPlans.map((plan) => <AdultPrice key={plan.code} plan={plan} />)
            ) : (
              <PricingUnavailable />
            )}
          </PricingGroup>
          <PricingGroup titleArabic="للأطفال" titleHebrew="לילדים">
            {data.kidsPlans.length ? (
              data.kidsPlans.map((plan) => <KidsPrice key={plan.code} plan={plan} />)
            ) : (
              <PricingUnavailable />
            )}
          </PricingGroup>
        </div>
        <p className="igc-pricing-note">
          التسجيل الأولي وحجز التجربة عبر WhatsApp. الأسعار النهائية حسب الباقة الفعالة في نظام
          الاستوديو.
        </p>
      </section>

      <section className="igc-proof" aria-labelledby="igc-proof-title">
        <div>
          <ShieldCheck aria-hidden="true" />
          <p className="igc-eyebrow">حقائق مؤكدة</p>
          <h2 id="igc-proof-title">استوديو حقيقي. تجربة محلية.</h2>
        </div>
        <ul>
          <li>استوديو بوتيك في حرفيش</li>
          <li>
            حصة تجريبية متاحة بـ<bdi dir="ltr">{trialPrice} ₪</bdi>
          </li>
          <li>مجموعات يوغا هوائية للأطفال من عمر 7+</li>
          <li>صورة الاستوديو الحقيقية والحرائر الفيروزية</li>
        </ul>
      </section>

      <TestimonialsSection testimonials={VERIFIED_TESTIMONIALS} />

      <section className="igc-contact" aria-labelledby="igc-contact-title">
        <div className="igc-section-heading igc-section-heading--light">
          <p className="igc-eyebrow">تواصلي معنا</p>
          <h2 id="igc-contact-title">جاهزة تجرّبي؟</h2>
          <p lang="he" dir="rtl">
            מוכנה לנסות?
          </p>
        </div>
        <div className="igc-contact-grid">
          <a
            href={data.womenWhatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackTrialWhatsappClick("women", "contact")}
          >
            <MessageCircle aria-hidden="true" />
            <span>
              <b>WhatsApp</b>
              <small>احجزي حصة تجريبية</small>
            </span>
            <ArrowLeft aria-hidden="true" />
          </a>
          {phoneHref ? (
            <a href={phoneHref}>
              <Phone aria-hidden="true" />
              <span>
                <b dir="ltr">{phone}</b>
                <small>اتصال مباشر · חיוג ישיר</small>
              </span>
              <ArrowLeft aria-hidden="true" />
            </a>
          ) : null}
          <a
            href={data.mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => getInstagramAnalytics()?.track("map_click", { cta_location: "contact" })}
          >
            <MapPin aria-hidden="true" />
            <span>
              <b lang="ar">{ARABIC_ADDRESS}</b>
              <small lang="he" dir="rtl">
                {data.address || "חורפיש, כביש ראשי 89"}
              </small>
            </span>
            <ArrowLeft aria-hidden="true" />
          </a>
          <a
            href={data.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              getInstagramAnalytics()?.track("instagram_direct_click", {
                cta_location: "contact",
                link_type: "profile",
              })
            }
          >
            <Instagram aria-hidden="true" />
            <span>
              <b>Instagram</b>
              <small>@cloudandcorestudio</small>
            </span>
            <ArrowLeft aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="igc-app" aria-labelledby="igc-app-title">
        <div>
          <p className="igc-eyebrow">للعضوات الحاليات</p>
          <h2 id="igc-app-title">عضوة حالية؟ حمّلي التطبيق لإدارة حصصك وحجوزاتك.</h2>
          <p lang="he" dir="rtl">
            חברה קיימת? הורידי את האפליקציה לניהול השיעורים וההזמנות.
          </p>
        </div>
        <div className="igc-app-actions">
          <a
            href={data.appStoreHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              getInstagramAnalytics()?.track("app_store_click", { cta_location: "member-app" })
            }
          >
            <Apple aria-hidden="true" />
            <span>
              <small>Download on the</small>App Store
            </span>
          </a>
          {data.androidHref ? (
            <a href={data.androidHref} target="_blank" rel="noopener noreferrer">
              <Smartphone aria-hidden="true" />
              <span>Google Play</span>
            </a>
          ) : (
            <p className="igc-android-note">
              <Smartphone aria-hidden="true" />
              Android قريبًا · Android בקרוב — الحجز متاح دائمًا عبر WhatsApp.
            </p>
          )}
        </div>
      </section>

      <footer className="igc-footer">
        <img src="/brand/cloud-core-mark.svg" width="46" height="46" alt="" aria-hidden="true" />
        <p>
          <strong>Cloud &amp; Core Studio</strong>
          <span>حرفيش · חורפיש</span>
        </p>
        {data.contactEmail ? <a href={`mailto:${data.contactEmail}`}>{data.contactEmail}</a> : null}
      </footer>

      <div className="igc-sticky" role="region" aria-label="حجز حصة تجريبية">
        <a
          href={data.womenWhatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackTrialWhatsappClick("women", "sticky")}
        >
          <MessageCircle aria-hidden="true" />
          <span>
            <b>
              احجزي حصة تجريبية بـ<bdi dir="ltr">{trialPrice} ₪</bdi>
            </b>
            <small lang="he" dir="rtl">
              קבעי שיעור ניסיון
            </small>
          </span>
          <ArrowLeft aria-hidden="true" />
        </a>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
    </main>
  );
}

function WhatsAppCta({
  arabic,
  audience,
  className,
  hebrew,
  href,
  location,
}: {
  arabic: string;
  audience: "women" | "kids";
  className: string;
  hebrew: string;
  href: string;
  location: string;
}) {
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackTrialWhatsappClick(audience, location)}
    >
      <MessageCircle aria-hidden="true" />
      <span>
        <b lang="ar">{arabic}</b>
        <small lang="he" dir="rtl">
          {hebrew}
        </small>
      </span>
      <ArrowLeft aria-hidden="true" />
    </a>
  );
}

function TrustItem({ arabic, hebrew }: { arabic: string; hebrew: string }) {
  return (
    <div className="igc-trust-item">
      <Check aria-hidden="true" />
      <p>
        <b lang="ar">{arabic}</b>
        <span lang="he" dir="rtl">
          {hebrew}
        </span>
      </p>
    </div>
  );
}

function PricingGroup({
  children,
  titleArabic,
  titleHebrew,
}: {
  children: ReactNode;
  titleArabic: string;
  titleHebrew: string;
}) {
  return (
    <div className="igc-price-group">
      <h3>
        <span lang="ar">{titleArabic}</span>
        <small lang="he" dir="rtl">
          {titleHebrew}
        </small>
      </h3>
      <div>{children}</div>
    </div>
  );
}

function AdultPrice({ plan }: { plan: InstagramAdultPlan }) {
  const copy = adultPlanCopy(plan);
  return (
    <div className="igc-price-row">
      <p>
        <b lang="ar">{copy.ar}</b>
        <span lang="he" dir="rtl">
          {copy.he}
        </span>
      </p>
      <strong>
        <bdi dir="ltr">{plan.priceIls} ₪</bdi>
      </strong>
    </div>
  );
}

function KidsPrice({ plan }: { plan: InstagramKidsPlan }) {
  const copy = kidsPlanCopy(plan);
  return (
    <div className="igc-price-row">
      <p>
        <b lang="ar">{copy.ar}</b>
        <span lang="he" dir="rtl">
          {copy.he}
        </span>
      </p>
      <strong>
        <bdi dir="ltr">{plan.priceIls} ₪</bdi>
      </strong>
    </div>
  );
}

function PricingUnavailable() {
  return (
    <p className="igc-pricing-unavailable">
      السعر الحالي متوفر عند التواصل عبر WhatsApp.
      <span lang="he" dir="rtl">
        המחיר העדכני זמין ב־WhatsApp.
      </span>
    </p>
  );
}

function TestimonialsSection({ testimonials }: { testimonials: VerifiedTestimonial[] }) {
  if (!testimonials.length) return null;
  return (
    <section className="igc-testimonials" aria-label="تجارب حقيقية">
      {testimonials.map((testimonial) => (
        <blockquote key={`${testimonial.name}-${testimonial.body}`}>
          <p>{testimonial.body}</p>
          <cite>{testimonial.name}</cite>
        </blockquote>
      ))}
    </section>
  );
}

function useTrackedSectionView(
  ref: RefObject<Element | null>,
  event: InstagramLandingEventName,
  key: string,
) {
  useEffect(() => {
    const element = ref.current;
    const analytics = getInstagramAnalytics();
    if (!element || !analytics) return;
    if (!("IntersectionObserver" in window)) {
      analytics.trackOnce(key, event);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        analytics.trackOnce(key, event);
        observer.disconnect();
      },
      { threshold: 0.35 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [event, key, ref]);
}

function findTrialPrice(plans: InstagramAdultPlan[]) {
  return plans.find((plan) => plan.code === "single_class")?.priceIls ?? null;
}

function adultPlanCopy(plan: InstagramAdultPlan) {
  if (plan.code === "single_class") return { ar: "حصة واحدة / تجربة", he: "שיעור בודד / ניסיון" };
  if (plan.code === "cloud_monthly_1x_week")
    return { ar: "مرة بالأسبوع · شهري", he: "פעם בשבוע · חודשי" };
  if (plan.code === "cloud_monthly_2x_week")
    return { ar: "مرتين بالأسبوع · شهري", he: "פעמיים בשבוע · חודשי" };
  if (plan.code === "cloud_10_entry_card")
    return { ar: "بطاقة 10 حصص · 90 يوم", he: "כרטיסיית 10 שיעורים · 90 יום" };
  return { ar: plan.name, he: plan.name };
}

function kidsPlanCopy(plan: InstagramKidsPlan) {
  if (plan.code === "monthly") return { ar: "4 حصص · شهري", he: "4 שיעורים · חודשי" };
  if (plan.code === "yearly")
    return { ar: "برنامج 10 أشهر · 40 حصة", he: "תוכנית ל־10 חודשים · 40 שיעורים" };
  return { ar: plan.name, he: plan.name };
}

function buildLocalBusinessSchema(data: InstagramRouteData, trialPrice: number, phone: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: "Cloud & Core Studio",
    url: CANONICAL_URL,
    image: `https://cloudandcorestudio.com${HERO_IMAGE}`,
    telephone: phone,
    sameAs: [data.instagramUrl],
    address: {
      "@type": "PostalAddress",
      addressCountry: "IL",
      addressLocality: "Hurfeish",
      streetAddress: data.address || "Main Road 89",
    },
    makesOffer: {
      "@type": "Offer",
      name: "Trial class",
      price: String(trialPrice),
      priceCurrency: "ILS",
      availability: "https://schema.org/InStock",
    },
  };
}
