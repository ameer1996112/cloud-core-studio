import type { Lang } from "@/lib/i18n";

export function resolveMemberProfileLanguage(
  draftLanguage: Lang | undefined,
  persistedLanguage: Lang | null | undefined,
  interfaceLanguage: Lang,
): Lang {
  return draftLanguage ?? persistedLanguage ?? interfaceLanguage;
}
