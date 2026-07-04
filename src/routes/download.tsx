import { createFileRoute } from "@tanstack/react-router";
import { Apple, CalendarDays, ChevronLeft, Smartphone } from "lucide-react";

import {
  appendTrackingParams,
  getDownloadConfig,
  type DownloadConfig,
} from "@/lib/download-config";

type DownloadRouteData = DownloadConfig & {
  iosHref: string;
  androidHref: string;
};

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { title: "Download Cloud & Core App" },
      {
        name: "description",
        content:
          "Download the Cloud & Core Studio app to book classes, manage packages, and stay connected with the studio.",
      },
      { property: "og:title", content: "Download Cloud & Core App" },
      {
        property: "og:description",
        content: "Book aerial yoga and pilates classes from the Cloud & Core Studio app.",
      },
      { property: "og:image", content: "/images/classes/aerial-yoga-flow.webp" },
      { name: "twitter:title", content: "Download Cloud & Core App" },
      {
        name: "twitter:description",
        content: "Book aerial yoga and pilates classes from the Cloud & Core Studio app.",
      },
      { name: "twitter:image", content: "/images/classes/aerial-yoga-flow.webp" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ location }): DownloadRouteData => {
    const config = getDownloadConfig();
    return {
      ...config,
      iosHref: appendTrackingParams(config.appStoreUrl, location.searchStr),
      androidHref: config.googlePlayUrl
        ? appendTrackingParams(config.googlePlayUrl, location.searchStr)
        : "",
    };
  },
  component: DownloadPage,
});

function DownloadPage() {
  const { iosHref, androidHref } = Route.useLoaderData();

  return (
    <main className="download-page" dir="rtl">
      <section className="download-shell" aria-labelledby="download-title">
        <div className="download-visual" aria-hidden="true">
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
          <p className="download-kicker">Cloud &amp; Core Studio</p>
          <h1 id="download-title">הורדת האפליקציה</h1>
          <p className="download-arabic" lang="ar">
            حمّلي التطبيق
          </p>
          <p className="download-copy">
            מזמינות שיעורים, מנהלות חבילות ונשארות מעודכנות מהאפליקציה של הסטודיו.
          </p>

          <div className="download-actions" aria-label="App download links">
            <a className="download-store-button" href={iosHref} rel="noopener noreferrer">
              <Apple aria-hidden="true" />
              <span>
                <small>זמין עכשיו</small>
                App Store
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

          <div className="download-proof">
            <CalendarDays aria-hidden="true" />
            <span>הדרך הקצרה להזמין מקום בשיעור הבא שלך.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
