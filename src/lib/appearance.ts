/** Local presentation preference only; never writes a member profile or auth state. */
export type Appearance = "light" | "dark" | "system";
export const APPEARANCE_KEY = "cc_theme";
export function isAppearance(value: unknown): value is Appearance {
  return value === "light" || value === "dark" || value === "system";
}

// Runs before styles/first paint. Keep self-contained so the same resolver handles
// boot, OS changes, cross-tab changes and the visible appearance control.
export function bootAppearance() {
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  let choice = "light";
  const valid = (value: string | null): value is "light" | "dark" | "system" =>
    value === "light" || value === "dark" || value === "system";
  const read = () => {
    try {
      const saved = localStorage.getItem("cc_theme") ?? localStorage.getItem("theme");
      return valid(saved) ? saved : "light";
    } catch {
      return "light";
    }
  };
  const apply = () => {
    root.dataset.appearance = choice;
    root.dataset.theme = choice === "system" ? (media.matches ? "dark" : "light") : choice;
    root.classList.toggle("dark", root.dataset.theme === "dark");
    root.classList.toggle("light", root.dataset.theme === "light");
    window.dispatchEvent(new Event("cc:appearance-changed"));
  };
  choice = read();
  apply();
  media.addEventListener("change", apply);
  window.addEventListener("storage", (event) => {
    if (event.key === "cc_theme" || event.key === "theme" || event.key === null) {
      choice = read();
      apply();
    }
  });
  window.addEventListener("cc:choose-appearance", (event) => {
    const value = (event as CustomEvent).detail;
    if (!valid(value)) return;
    choice = value;
    try {
      localStorage.setItem("cc_theme", value);
    } catch {
      /* Session choice still works. */
    }
    apply();
  });
}
export const getBootAppearanceScript = () => `(${bootAppearance.toString()})()`;
