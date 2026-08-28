import { createFileRoute } from "@tanstack/react-router";
import { Apple, CalendarDays, ChevronLeft, ShieldCheck, Smartphone } from "lucide-react";

import {
  appendTrackingParams,
  buildNativeAppStoreUrl,
  getDownloadConfig,
  type DownloadConfig,
} from "@/lib/download-config";
import { buildPublicPageHead } from "@/lib/public-metadata";

type DownloadRouteData = DownloadConfig & {
  iosHref: string;
  iosNativeHref: string;
  androidHref: string;
};

const CURRENT_APP_VERSION = "1.0.7";
const UPDATE_PAGE_TITLE = "עדכון אפליקציית Cloud & Core | גרסה " + CURRENT_APP_VERSION;
const UPDATE_PAGE_DESCRIPTION =
  "העדכון החדש של Cloud & Core זמין עכשיו עם חיבור יציב יותר, גישה מהירה לשיעורים והתראות טובות יותר.";

export const Route = createFileRoute("/download")({
  head: () =>
    buildPublicPageHead({
      title: UPDATE_PAGE_TITLE,
      description: UPDATE_PAGE_DESCRIPTION,
      path: "/download",
    }),
  loader: ({ location }): DownloadRouteData => {
    const config = getDownloadConfig();
    const iosHref = appendTrackingParams(config.appStoreUrl, location.searchStr);
    return {
      ...config,
      iosHref,
      iosNativeHref: buildNativeAppStoreUrl(iosHref),
      androidHref: config.googlePlayUrl
        ? appendTrackingParams(config.googlePlayUrl, location.searchStr)
        : "",
    };
  },
  component: DownloadPage,
});

function DownloadPage() {
  const { iosHref, iosNativeHref, androidHref } = Route.useLoaderData();

  return (
    <main id="main-content" className="download-page" dir="rtl">
      <section className="download-shell" aria-labelledby="download-title">
        <div className="download-visual" aria-hidden="true">
          <span className="download-version-orbit">{CURRENT_APP_VERSION}</span>
          <div className="download-phone">
            <div className="download-phone-bar" />
            <div className="download-phone-card">
              <span>Cloud &amp; Core</span>
              <strong>18:30</strong>
              <small>Aerial Flow</small>
            </div>
            <div className="download-phone-card download-phone-card-soft">
              <span>מקום שמור</span>
              <strong>6</strong>
              <small>שיעורים זמינים</small>
            </div>
          </div>
        </div>

        <div className="download-content">
          <img
            className="download-wordmark"
            src="/brand/cloud-core-wordmark.svg"
            alt="Cloud & Core"
            width={300}
            height={69}
          />
          <p className="download-kicker">העדכון החדש · גרסה {CURRENT_APP_VERSION}</p>
          <h1 id="download-title">העדכון החדש זמין עכשיו</h1>
          <p className="download-arabic" lang="ar">
            التحديث الجديد متوفر الآن
          </p>
          <p className="download-copy">
            עדכני עכשיו לחיבור יציב יותר, גישה מהירה לשיעורים והתראות טובות יותר.
          </p>

          <div className="download-actions" aria-label="App download links">
            <a
              className="download-store-button"
              href={iosNativeHref}
              aria-label="פתיחת Cloud & Core ב-App Store"
            >
              <Apple aria-hidden="true" />
              <span>
                <small>לחצי כאן לפתיחה</small>
                עדכון ב-App Store
              </span>
              <ChevronLeft aria-hidden="true" />
            </a>

            {androidHref ? (
              <a className="download-secondary-button" href={androidHref} rel="noopener noreferrer">
                <Smartphone aria-hidden="true" />
                <span>Google Play</span>
              </a>
            ) : (
              <div className="download-android-note" role="note">
                <Smartphone aria-hidden="true" />
                <span>גרסת Android תעלה בקרוב · نسخة Android قريبًا</span>
              </div>
            )}
          </div>

          <p className="download-browser-note">
            <ShieldCheck aria-hidden="true" />
            <span>
              אם ה-App Store לא נפתח, לחצי על ⋯ ובחרי ״פתיחה בדפדפן״, או{" "}
              <a href={iosHref} target="_blank" rel="noopener noreferrer">
                פתחי את עמוד Apple
              </a>
              .
            </span>
          </p>

          <div className="download-proof">
            <CalendarDays aria-hidden="true" />
            <span>העדכון הרשמי והמאובטח של Cloud &amp; Core.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
