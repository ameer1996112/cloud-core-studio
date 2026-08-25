import { createFileRoute, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";

import {
  APP_MARKETING_LANGS,
  buildMarketingHref,
  parseAppMarketingSearch,
  resolveAppMarketingRedirect,
  sanitizeMarketingUtm,
} from "@/lib/app-marketing";
import { LANG_KEY, LANG_META, readLangCookieHeader, readSupportedLang } from "@/lib/i18n";

export const Route = createFileRoute("/app")({
  validateSearch: parseAppMarketingSearch,
  beforeLoad: ({ location }) => {
    if (location.pathname !== "/app") return;

    const search = parseAppMarketingSearch(location.search);
    if (!search.lang) return;

    const decision = resolveAppMarketingRedirect({
      explicit: search.lang,
      search: location.searchStr,
    });

    throw redirect({
      to: decision.to,
      search: decision.search,
      replace: true,
      statusCode: 307,
    });
  },
  head: ({ matches }) =>
    matches.at(-1)?.pathname === "/app"
      ? {
          meta: [{ title: "Opening Cloud & Core" }, { name: "robots", content: "noindex,follow" }],
        }
      : {},
  headers: ({ matches }) =>
    matches.at(-1)?.pathname === "/app"
      ? { "X-Robots-Tag": "noindex, follow", "Cache-Control": "private, no-store" }
      : undefined,
  component: AppMarketingResolverRoute,
});

function AppMarketingResolverRoute() {
  const location = useLocation();
  if (location.pathname !== "/app") return <Outlet />;
  return <AppMarketingLocaleBridge search={location.searchStr} />;
}

function AppMarketingLocaleBridge({ search }: { search: string }) {
  useEffect(() => {
    let saved = readLangCookieHeader(document.cookie);
    try {
      saved = readSupportedLang(window.localStorage.getItem(LANG_KEY)) ?? saved;
    } catch {
      // Privacy modes can deny local storage. Cookie and browser language remain valid fallbacks.
    }

    const decision = resolveAppMarketingRedirect({
      saved,
      accepted: [...navigator.languages],
      search,
    });
    window.location.replace(
      buildMarketingHref(decision.to, new URLSearchParams(Object.entries(decision.search))),
    );
  }, [search]);

  const marketingUtm = new URLSearchParams(sanitizeMarketingUtm(search));

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <section className="max-w-sm text-center" lang="en" dir="ltr">
        <h1 className="font-display text-3xl text-foreground">Opening Cloud &amp; Core</h1>
        <p className="mt-3 text-sm text-muted-foreground" role="status" aria-live="polite">
          Choosing your saved language…
        </p>
        <nav className="mt-5 flex flex-wrap justify-center gap-4" aria-label="Choose language">
          {APP_MARKETING_LANGS.map((lang) => (
            <a
              key={lang}
              className="underline underline-offset-4"
              href={buildMarketingHref(`/app/${lang}`, marketingUtm)}
              hrefLang={lang}
              lang={lang}
              dir={LANG_META[lang].dir}
            >
              {LANG_META[lang].label}
            </a>
          ))}
        </nav>
        <noscript>
          <p className="mt-4 text-sm text-muted-foreground">
            Choose a language to continue to the public studio page.
          </p>
        </noscript>
      </section>
    </main>
  );
}
