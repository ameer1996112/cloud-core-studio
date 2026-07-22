import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Instagram, MapPin, MessageCircle, Smartphone } from "lucide-react";

import aerialImage from "@/assets/classes/aerial-yoga-flow-hero.webp";
import studioImage from "@/assets/studio-interior.webp";
import {
  getInstagramLandingData,
  type InstagramLandingData,
} from "@/lib/instagramLanding.functions";

type InstagramRouteData = Pick<
  InstagramLandingData,
  "address" | "contactEmail" | "whatsappNumber"
> & {
  whatsappHref: string;
};

const KIDS_WHATSAPP_MESSAGE =
  "مرحباً، وصلت من إنستغرام ومهتمة بحصة تجريبية لليوغا الهوائية للأطفال. عمر طفلي/طفلتي هو ___.";

export const Route = createFileRoute("/instagram")({
  head: () => ({
    meta: [
      { title: "Cloud & Core | Aerial Yoga & Pilates" },
      {
        name: "description",
        content:
          "Boutique aerial yoga and Pilates for women, plus small aerial-yoga groups for children in Hurfeish.",
      },
      { property: "og:title", content: "Cloud & Core Studio | Hurfeish" },
      {
        property: "og:description",
        content: "Movement, strength and calm for women and children in Hurfeish.",
      },
      { property: "og:image", content: "/images/classes/aerial-yoga-flow.webp" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async (): Promise<InstagramRouteData> => {
    try {
      const settings = await getInstagramLandingData();
      return {
        ...settings,
        whatsappHref: buildWhatsappHref(settings.whatsappNumber),
      };
    } catch {
      return {
        address: null,
        contactEmail: null,
        whatsappNumber: null,
        whatsappHref: "",
      };
    }
  },
  component: InstagramLandingPage,
});

function InstagramLandingPage() {
  const { address, contactEmail, whatsappHref } = Route.useLoaderData();

  return (
    <main className="ig-editorial" dir="rtl">
      <header className="ig-editorial__nav">
        <Link to="/auth" className="ig-editorial__logo" aria-label="Cloud & Core home">
          <img src="/brand/cloud-core-wordmark.svg" alt="Cloud & Core" />
        </Link>
        <span className="ig-editorial__place">
          <MapPin aria-hidden="true" />
          HURFEISH · 2026
        </span>
      </header>

      <section className="ig-editorial__hero" aria-labelledby="ig-editorial-title">
        <div className="ig-editorial__portrait">
          <img src={aerialImage} alt="Aerial yoga at Cloud & Core Studio" />
          <span>01</span>
        </div>

        <div className="ig-editorial__intro">
          <p className="ig-editorial__overline">AERIAL · PILATES · BOUTIQUE STUDIO</p>
          <h1 id="ig-editorial-title">
            مساحة للحركة.
            <em>مكان إلك.</em>
          </h1>
          <p className="ig-editorial__intro-he" lang="he">
            סטודיו בוטיק בחורפיש לתנועה, כוח ורוגע — לנשים ולילדים.
          </p>
          <div className="ig-editorial__trial">
            <span>حصة تجريبية · שיעור ניסיון</span>
            <strong>₪80</strong>
          </div>
        </div>
      </section>

      <section className="ig-editorial__routes" aria-labelledby="ig-routes-title">
        <div className="ig-editorial__routes-head">
          <span>CHOOSE YOUR PATH</span>
          <h2 id="ig-routes-title">من وين بتحبي تبلّشي؟</h2>
        </div>

        <article className="ig-route ig-route--women">
          <span className="ig-route__number">01</span>
          <div className="ig-route__copy">
            <p>للنساء · לנשים</p>
            <h3>Aerial Yoga &amp; Pilates</h3>
            <span>مرة بالأسبوع ₪280 · مرتين ₪350 · 10 حصص ₪700</span>
          </div>
          <Link
            className="ig-route__button"
            to="/download"
            search={{
              utm_campaign: "organic_profile",
              utm_content: "women",
              utm_medium: "bio",
              utm_source: "instagram",
            }}
          >
            <Smartphone aria-hidden="true" />
            <span>
              احجزي من التطبيق
              <small lang="he">להזמנה באפליקציה</small>
            </span>
            <ArrowLeft aria-hidden="true" />
          </Link>
        </article>

        <article className="ig-route ig-route--kids">
          <span className="ig-route__number">02</span>
          <div className="ig-route__copy">
            <p>للأطفال · לילדים</p>
            <h3>Kids Aerial · 7+</h3>
            <span>حتى 6 أطفال · مرة بالأسبوع · ₪280 بالشهر</span>
          </div>
          {whatsappHref ? (
            <a
              className="ig-route__button"
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle aria-hidden="true" />
              <span>
                احجزي على WhatsApp
                <small lang="he">לקביעת שיעור ניסיון</small>
              </span>
              <ArrowLeft aria-hidden="true" />
            </a>
          ) : (
            <span className="ig-route__pending">WhatsApp link is being prepared</span>
          )}
        </article>
      </section>

      <section className="ig-editorial__note" aria-label="Limited adult offer">
        <span>LIMITED / 10 WOMEN</span>
        <p>
          لأول 10 مشتركات جديدات: <strong>50% على الشهر الأول</strong> عند الاشتراك خلال 24 ساعة من
          حصة التجربة.
        </p>
      </section>

      <section className="ig-editorial__studio">
        <img src={studioImage} alt="Cloud & Core boutique studio in Hurfeish" />
        <div>
          <span>THE STUDIO</span>
          <h2>
            مجموعات صغيرة.
            <br />
            اهتمام شخصي.
          </h2>
          <p lang="he">קבוצות קטנות. יחס אישי. מתחילות בקצב שלך.</p>
        </div>
      </section>

      <footer className="ig-editorial__footer">
        <div>
          <img src="/brand/cloud-core-mark.svg" alt="" aria-hidden="true" />
          <p>
            <strong>Cloud &amp; Core Studio</strong>
            <span>{address || "Hurfeish · حرفيش · חורפיש"}</span>
          </p>
        </div>
        <div className="ig-editorial__footer-links">
          <a href="https://www.instagram.com/cloudandcorestudio/" aria-label="Instagram">
            <Instagram aria-hidden="true" />
          </a>
          {contactEmail ? <a href={`mailto:${contactEmail}`}>EMAIL</a> : null}
        </div>
      </footer>
    </main>
  );
}

function buildWhatsappHref(phone: string | null) {
  const digits = phone?.replace(/\D/g, "") || "";
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(KIDS_WHATSAPP_MESSAGE)}`;
}
