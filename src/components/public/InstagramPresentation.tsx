import { Link } from "@tanstack/react-router";
import { ArrowLeft, Instagram, MapPin, MessageCircle, Smartphone } from "lucide-react";

import aerialImage from "@/assets/classes/aerial-yoga-flow-hero.webp";
import aerialThumbImage from "@/assets/classes/aerial-yoga-flow-thumb.webp";
import studioImage from "@/assets/studio-interior.webp";

export type InstagramPresentationProps = {
  address: string | null;
  contactEmail: string | null;
  whatsappHref: string;
};

export function InstagramPresentation({
  address,
  contactEmail,
  whatsappHref,
}: InstagramPresentationProps) {
  return (
    <div data-product-view="instagram-default">
      <header className="ig-editorial__nav">
        <Link to="/auth" className="ig-editorial__logo" aria-label="Cloud & Core home">
          <img src="/brand/cloud-core-wordmark.svg" alt="Cloud & Core" width={300} height={69} />
        </Link>
        <span className="ig-editorial__place">
          <MapPin aria-hidden="true" /> HURFEISH · 2026
        </span>
      </header>
      <section className="ig-editorial__hero" aria-labelledby="ig-editorial-title">
        <div className="ig-editorial__portrait">
          <picture>
            <source media="(max-width: 800px)" srcSet={aerialThumbImage} />
            <img
              src={aerialImage}
              alt="Aerial yoga at Cloud & Core Studio"
              width={1680}
              height={720}
              loading="eager"
              decoding="async"
            />
          </picture>
          <span>01</span>
        </div>
        <div className="ig-editorial__intro">
          <p className="ig-editorial__overline">AERIAL · PILATES · BOUTIQUE STUDIO</p>
          <h1 id="ig-editorial-title">
            مساحة للحركة.<em>مكان إلك.</em>
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
              احجزي من التطبيق<small lang="he">להזמנה באפליקציה</small>
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
                احجزي على WhatsApp<small lang="he">לקביעת שיעור ניסיון</small>
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
        <img
          src={studioImage}
          alt="Cloud & Core boutique studio in Hurfeish"
          width={512}
          height={357}
          loading="lazy"
          decoding="async"
        />
        <div>
          <span>THE STUDIO</span>
          <h2>
            مجموعات صغيرة.
            <br />
            اهتمام شخصي.
          </h2>
          <p lang="he" style={{ color: "var(--color-navy)" }}>
            קבוצות קטנות. יחס אישי. מתחילות בקצב שלך.
          </p>
        </div>
      </section>
      <footer className="ig-editorial__footer">
        <div>
          <img
            src="/brand/cloud-core-mark.svg"
            alt=""
            aria-hidden="true"
            width={214}
            height={150}
          />
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
    </div>
  );
}
