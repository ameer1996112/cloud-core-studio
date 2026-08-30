import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { createClientOnlyFn, createIsomorphicFn } from "@tanstack/react-start";
import { getStartContext } from "@tanstack/start-storage-context";

import "@fontsource/assistant/hebrew-400.css";
import "@fontsource/assistant/hebrew-600.css";
import "@fontsource/assistant/hebrew-700.css";
import "@fontsource/assistant/latin-400.css";
import "@fontsource/assistant/latin-600.css";
import "@fontsource/assistant/latin-700.css";
import "@fontsource/cormorant-garamond/latin-600.css";
import "@fontsource/cormorant-garamond/latin-600-italic.css";
import "@fontsource/noto-sans-arabic/arabic-400.css";
import "@fontsource/noto-sans-arabic/arabic-600.css";
import "@fontsource/noto-sans-arabic/arabic-700.css";
import appCss from "../styles/base.css?url";
import { reportAppError } from "../lib/error-reporting";
import { Toaster } from "sonner";
import {
  applyLang,
  DEFAULT_LOCALE,
  getDirection,
  getBootLangScript,
  getStoredLang,
  readLangCookieHeader,
  readSupportedLang,
  setActiveLang,
  type Lang,
  useI18n,
} from "@/lib/i18n";
import { RequiredAppUpdate } from "@/components/app-shell/RequiredAppUpdate";
import {
  APP_MARKETING_LANGS,
  getAppMarketingMeta,
  isPublicAppMarketingPathname,
} from "@/lib/app-marketing";
import type { RequiredIosAppUpdate } from "@/lib/appUpdate.client";
import { shouldShowRootSkipLink } from "@/lib/public-shell-paths";
import webAppManifest from "../../public/manifest.json";

function NotFoundComponent() {
  const { dir, t } = useI18n();

  return (
    <main
      id="main-content"
      dir={dir}
      className="flex min-h-screen items-center justify-center bg-background px-6"
    >
      <div className="max-w-md text-center">
        <h1 className="font-display text-6xl text-foreground">{t("recovery.notFound.title")}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t("recovery.notFound.body")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            to="/"
            className="inline-flex min-h-[var(--cc-target-min)] items-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground focus-visible:outline-[var(--cc-focus-outline)] focus-visible:outline-offset-[var(--cc-focus-offset)]"
          >
            {t("recovery.action.home")}
          </Link>
          <Link
            to="/support"
            className="inline-flex min-h-[var(--cc-target-min)] items-center rounded-full border border-border px-6 py-3 text-sm font-medium text-foreground focus-visible:outline-[var(--cc-focus-outline)] focus-visible:outline-offset-[var(--cc-focus-offset)]"
          >
            {t("recovery.action.support")}
          </Link>
        </div>
      </div>
    </main>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const { dir, t } = useI18n();
  useEffect(() => {
    reportAppError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <main
      id="main-content"
      dir={dir}
      className="flex min-h-screen items-center justify-center bg-background px-6"
    >
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl text-foreground">{t("recovery.error.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("recovery.error.body")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="min-h-[var(--cc-target-min)] rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground focus-visible:outline-[var(--cc-focus-outline)] focus-visible:outline-offset-[var(--cc-focus-offset)]"
          >
            {t("common.retry")}
          </button>
          <Link
            to="/"
            className="inline-flex min-h-[var(--cc-target-min)] items-center rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground focus-visible:outline-[var(--cc-focus-outline)] focus-visible:outline-offset-[var(--cc-focus-offset)]"
          >
            {t("recovery.action.home")}
          </Link>
          <Link
            to="/support"
            className="inline-flex min-h-[var(--cc-target-min)] items-center rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground focus-visible:outline-[var(--cc-focus-outline)] focus-visible:outline-offset-[var(--cc-focus-offset)]"
          >
            {t("recovery.action.support")}
          </Link>
        </div>
        {import.meta.env.DEV ? (
          <details className="mt-6 text-start text-xs text-muted-foreground">
            <summary className="cursor-pointer">{t("recovery.error.details")}</summary>
            <pre className="mt-2 overflow-auto rounded-md bg-muted p-3 text-start whitespace-pre-wrap">
              {error.message}
            </pre>
          </details>
        ) : null}
      </div>
    </main>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: webAppManifest.theme_color },
      { name: "facebook-domain-verification", content: "k7ee0g6u6wldkv9oqr22yeh7oxbgcg" },
      { title: "Cloud & Core Studio" },
      { name: "description", content: "Boutique aerial yoga & mat pilates — Cloud & Core Studio." },
      { property: "og:title", content: "Cloud & Core Studio" },
      { name: "twitter:title", content: "Cloud & Core Studio" },
      {
        property: "og:description",
        content: "Boutique aerial yoga & mat pilates — Cloud & Core Studio.",
      },
      {
        name: "twitter:description",
        content: "Boutique aerial yoga & mat pilates — Cloud & Core Studio.",
      },
      { property: "og:image", content: "/images/auth/cloud-core-auth-hero.webp" },
      { name: "twitter:image", content: "/images/auth/cloud-core-auth-hero.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/favicon-32x32.png", sizes: "32x32" },
      { rel: "icon", type: "image/png", href: "/favicon-16x16.png", sizes: "16x16" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const initialLang = getInitialShellLang();
  const alternateAppMarketingLocale = getStaticAppMarketingAlternateLocale();
  setActiveLang(initialLang);

  return (
    <html lang={initialLang} dir={getDirection(initialLang)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: getBootLangScript() }} />
        {alternateAppMarketingLocale ? (
          <meta property="og:locale:alternate" content={alternateAppMarketingLocale} />
        ) : null}
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const getStaticAppMarketingLang = createIsomorphicFn()
  .server(() => {
    const request = getStartContext().request;
    const url = new URL(request.url);
    return readSupportedLang(url.pathname.match(/^\/app\/(ar|he|en)$/)?.[1]);
  })
  .client(() => {
    return typeof window !== "undefined"
      ? readSupportedLang(window.location.pathname.match(/^\/app\/(ar|he|en)$/)?.[1])
      : null;
  });

const getInitialShellLang = createIsomorphicFn()
  .server(() => {
    const routeLang = getStaticAppMarketingLang();
    if (routeLang) return routeLang;
    return readLangCookieHeader(getStartContext().request.headers.get("cookie")) ?? DEFAULT_LOCALE;
  })
  .client(() => {
    const routeLang = getStaticAppMarketingLang();
    if (routeLang) return routeLang;
    const bootLang =
      typeof window !== "undefined" && "__ccBootLang" in window
        ? (window as typeof window & { __ccBootLang?: unknown }).__ccBootLang
        : null;
    const htmlLang = typeof document !== "undefined" ? document.documentElement.lang : null;
    if (bootLang === "he" || bootLang === "ar" || bootLang === "en") return bootLang;
    if (htmlLang === "he" || htmlLang === "ar" || htmlLang === "en") return htmlLang;
    const storedLang = getStoredLang();
    if (storedLang === "he" || storedLang === "ar" || storedLang === "en") return storedLang;
    return DEFAULT_LOCALE;
  });

const getStaticAppMarketingAlternateLocale = createIsomorphicFn()
  .server(() => getSecondaryAppMarketingLocale(getStaticAppMarketingLang()))
  .client(() => getSecondaryAppMarketingLocale(getStaticAppMarketingLang()));

function getSecondaryAppMarketingLocale(lang: Lang | null) {
  const alternate = lang ? APP_MARKETING_LANGS.find((locale) => locale !== lang) : null;
  return alternate ? getAppMarketingMeta(alternate).locale : null;
}

const registerAdminPushNotifications = createClientOnlyFn(() => {
  void import("@/lib/adminPush.client")
    .then(({ maybeRegisterAdminPushNotifications }) => maybeRegisterAdminPushNotifications())
    .catch(() => undefined);
});

const checkRequiredIosAppUpdate = createClientOnlyFn(() =>
  import("@/lib/appUpdate.client").then(({ findRequiredIosAppUpdate }) =>
    findRequiredIosAppUpdate(),
  ),
);

const getFreshRootSession = createClientOnlyFn(() =>
  import("@/lib/root-session-lifecycle.client").then(({ getFreshRootSession }) =>
    getFreshRootSession(),
  ),
);

type RootSessionLifecycleHandlers = {
  onSessionAvailable: () => void;
  onSessionChanged: () => void;
  onSignedOut: () => void;
  onError: (error: unknown) => void;
};

const startRootSessionLifecycle = createClientOnlyFn((handlers: RootSessionLifecycleHandlers) =>
  import("@/lib/root-session-lifecycle.client").then(({ startRootSessionLifecycle }) =>
    startRootSessionLifecycle(handlers),
  ),
);

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { t: translate } = useI18n();
  const showRootSkipLink = shouldShowRootSkipLink(pathname);
  const [requiredAppUpdate, setRequiredAppUpdate] = useState<RequiredIosAppUpdate | null>(null);
  useEffect(() => {
    if (isPublicAppMarketingPathname(window.location.pathname)) return;

    let active = true;
    let stop: () => void = () => undefined;
    void import("@/lib/nativeAppLinks")
      .then(({ installNativeAppLinkHandling, startNativeAppLinkHandling }) => {
        if (!active) return;
        const nextStop = startNativeAppLinkHandling(() =>
          installNativeAppLinkHandling((route) => {
            void getFreshRootSession().then(async () => {
              if (!active) return;
              await router.invalidate();
              if (!active) return;
              await router.navigate({ to: route as never, replace: true });
            });
          }),
        );
        if (!active) {
          nextStop();
          return;
        }
        stop = nextStop;
      })
      .catch((error) => console.warn("native_app_link_setup_failed", error));
    return () => {
      active = false;
      stop();
    };
  }, [router]);
  useEffect(() => {
    if (isPublicAppMarketingPathname(window.location.pathname)) return;

    let active = true;
    let checkInFlight = false;

    const checkForRequiredUpdate = async () => {
      if (checkInFlight) return;
      checkInFlight = true;
      try {
        const requirement = await checkRequiredIosAppUpdate();
        if (active) setRequiredAppUpdate(requirement);
      } catch (error) {
        console.warn("ios_required_update_check_failed", error);
        if (active) setRequiredAppUpdate(null);
      } finally {
        checkInFlight = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkForRequiredUpdate();
    };

    void checkForRequiredUpdate();
    window.addEventListener("focus", checkForRequiredUpdate);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      window.removeEventListener("focus", checkForRequiredUpdate);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
  useEffect(() => {
    if (isPublicAppMarketingPathname(window.location.pathname)) return;

    if (typeof window !== "undefined") {
      applyLang(getStoredLang());
    }
    if (typeof window !== "undefined") {
      void import("@capacitor/splash-screen")
        .then(({ SplashScreen }) => SplashScreen.hide())
        .catch(() => undefined);
    }
    let effectActive = true;
    let stop: () => void = () => undefined;
    void startRootSessionLifecycle({
      onSessionAvailable: registerAdminPushNotifications,
      onSessionChanged: () => {
        void router.invalidate();
        void queryClient.invalidateQueries();
      },
      onSignedOut: () => {
        void queryClient.cancelQueries().finally(() => queryClient.clear());
        void router.navigate({ to: "/auth", replace: true });
      },
      onError: (error) => console.warn("native_auth_lifecycle_setup_failed", error),
    })
      .then((nextStop) => {
        if (!effectActive) {
          nextStop();
          return;
        }
        stop = nextStop;
      })
      .catch((error) => console.warn("native_auth_lifecycle_setup_failed", error));
    return () => {
      effectActive = false;
      stop();
    };
  }, [router, queryClient]);

  if (requiredAppUpdate) {
    return (
      <RequiredAppUpdate
        lang={getStoredLang()}
        appStoreUrl={requiredAppUpdate.appStoreUrl}
        installedVersion={requiredAppUpdate.installedVersion}
        minimumVersion={requiredAppUpdate.minimumVersion}
      />
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {showRootSkipLink ? (
        <a className="global-skip-link" href="#main-content">
          {translate("common.skipToContent")}
        </a>
      ) : null}
      <Outlet />
      <Toaster
        className="app-toaster"
        position="top-center"
        offset={{ top: 24, right: 16, left: 16 }}
        mobileOffset={{
          top: "calc(env(safe-area-inset-top) + 152px)",
          right: 16,
          left: 16,
        }}
        toastOptions={{
          style: {
            background: "var(--card)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
          },
        }}
      />
    </QueryClientProvider>
  );
}
