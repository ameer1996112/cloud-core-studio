import { useEffect } from "react";
import { t, useI18n } from "@/lib/i18n";

export function useDocumentTitle(titleKey: Parameters<typeof t>[0]) {
  const { lang } = useI18n();

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = t(titleKey);
  }, [lang, titleKey]);
}
