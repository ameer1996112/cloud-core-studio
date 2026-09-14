import { t, useI18n } from "@/lib/i18n";
import type { ReactNode } from "react";
import { StudioBanner } from "./StudioBanner";

/** Presentation shared by the real Home page and the component gallery. */
export function StudioWelcome({ name, greeting }: { name?: string; greeting: string }) {
  const { lang, dir } = useI18n();
  return (
    <header className="home-greeting" dir={dir}>
      <div className="home-welcome-copy">
        <h1>
          {name ? (
            <>
              <span>{t(lang === "en" ? "member.welcomeBackName" : "member.helloName")}</span>{" "}
              <bdi>{name}</bdi>
            </>
          ) : (
            t("nav.home")
          )}
        </h1>
        <p>{greeting}</p>
      </div>
    </header>
  );
}

/** One photo-and-lesson composition in the application and its component review. */
export function StudioHomeFeature({ children }: { children: ReactNode }) {
  return (
    <div className="home-feature">
      <StudioBanner />
      {children}
    </div>
  );
}

export function StudioHomeLoading() {
  return (
    <div
      className="home-primary-layout home-loading"
      role="status"
      aria-label={t("common.loading")}
      aria-busy="true"
    >
      <div className="home-main-column">
        <StudioHomeFeature>
          <div className="home-loading-lesson" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </StudioHomeFeature>
      </div>
      <div className="home-account" aria-hidden="true">
        <div className="home-loading-row" />
        <div className="home-loading-row" />
      </div>
    </div>
  );
}
