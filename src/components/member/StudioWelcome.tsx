import { t, useI18n } from "@/lib/i18n";
import { StudioBanner } from "./StudioBanner";

/** Presentation shared by the real Home page and the component gallery. */
export function StudioWelcome({ name, greeting }: { name?: string; greeting: string }) {
  const { lang, dir } = useI18n();
  return (
    <header className="home-greeting" dir={dir}>
      <div className="home-welcome-copy">
        <p>{greeting}</p>
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
      </div>
      <StudioBanner />
    </header>
  );
}
