import { PublicLanguageSwitcher } from "@/components/public/PublicLanguageSwitcher";
import type { Lang } from "@/lib/i18n";

/** @deprecated Use PublicLanguageSwitcher for all public surfaces. */
export function LegalLanguageSwitcher({ lang }: { lang: Lang }) {
  return <PublicLanguageSwitcher lang={lang} />;
}
