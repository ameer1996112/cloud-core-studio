import { useSyncExternalStore } from "react";
import { SunMoon } from "lucide-react";
import { useI18n, type Lang } from "@/lib/i18n";

const labels = {
  he: { title: "מראה", light: "בהיר", dark: "כהה", system: "לפי המכשיר" },
  ar: { title: "المظهر", light: "فاتح", dark: "داكن", system: "حسب الجهاز" },
  en: { title: "Appearance", light: "Light", dark: "Dark", system: "System" },
};
const subscribe = (notify: () => void) => {
  window.addEventListener("cc:appearance-changed", notify);
  return () => window.removeEventListener("cc:appearance-changed", notify);
};
const snapshot = () => document.documentElement.dataset.appearance || "light";
const serverSnapshot = () => "light";
export function AppearanceControl({ lang: suppliedLang }: { lang?: Lang }) {
  const { lang } = useI18n();
  const copy = labels[suppliedLang || lang];
  const value = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return (
    <label className="appearance-control" title={copy.title}>
      <SunMoon size={19} aria-hidden="true" />
      <span className="sr-only">{copy.title}</span>
      <select
        aria-label={copy.title}
        value={value}
        onChange={(event) => {
          window.dispatchEvent(
            new CustomEvent("cc:choose-appearance", { detail: event.target.value }),
          );
        }}
      >
        <option value="light">{copy.light}</option>
        <option value="dark">{copy.dark}</option>
        <option value="system">{copy.system}</option>
      </select>
    </label>
  );
}
