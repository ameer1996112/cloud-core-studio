import { LANG_META, type Lang } from "@/lib/i18n";
import type { AppMarketingPublicProfile } from "@/lib/app-marketing";

export type AppMarketingPageProps = {
  lang: Lang;
  appStoreUrl: string;
  profile: AppMarketingPublicProfile;
};

export function AppMarketingPage({ lang }: AppMarketingPageProps) {
  return <main id="main-content" lang={lang} dir={LANG_META[lang].dir} />;
}
