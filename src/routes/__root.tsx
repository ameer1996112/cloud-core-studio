import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getStartContext } from "@tanstack/start-storage-context";

import appCss from "../styles.css?url";
import { reportAppError } from "../lib/error-reporting";
import { supabase } from "@/integrations/supabase/client";
import {
  clearSupabaseAccessTokenCookie,
  writeSupabaseAccessTokenCookie,
} from "@/integrations/supabase/session-cookie";
import { Toaster } from "sonner";
import {
  applyLang,
  DEFAULT_LOCALE,
  LANG_COOKIE,
  getDirection,
  getBootLangScript,
  getStoredLang,
  setActiveLang,
  t,
} from "@/lib/i18n";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <h1 className="font-display text-6xl text-foreground">הדף לא נמצא</h1>
        <p className="mt-3 text-sm text-muted-foreground">העמוד הזה לא נשמר.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
          >
            חזרה לבית
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportAppError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl text-foreground">רגע שקט</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          משהו נעצר אצלנו. אפשר לנסות שוב בעוד רגע.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            {t("common.retry")}
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0B1D3A" },
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
      { property: "og:image", content: "/images/classes/aerial-yoga-flow.webp" },
      { name: "twitter:image", content: "/images/classes/aerial-yoga-flow.webp" },
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
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function getDomPatchesScript() {
  return `
    (function() {
      try {
        if (typeof Node !== 'undefined') {
          var origInsertBefore = Node.prototype.insertBefore;
          Node.prototype.insertBefore = function(newNode, refNode) {
            if (refNode && refNode.parentNode !== this) {
              console.warn('DOM Patch [insertBefore]: referenceNode is not a child of this parent. Appending instead.', { parent: this, newNode: newNode, refNode: refNode });
              return this.appendChild(newNode);
            }
            return origInsertBefore.call(this, newNode, refNode);
          };

          var origRemoveChild = Node.prototype.removeChild;
          Node.prototype.removeChild = function(child) {
            if (child && child.parentNode !== this) {
              console.warn('DOM Patch [removeChild]: child is not a child of this parent. Skipping.', { parent: this, child: child });
              return child;
            }
            return origRemoveChild.call(this, child);
          };

          var origReplaceChild = Node.prototype.replaceChild;
          Node.prototype.replaceChild = function(newChild, oldChild) {
            if (oldChild && oldChild.parentNode !== this) {
              console.warn('DOM Patch [replaceChild]: oldChild is not a child of this parent. Appending instead.', { parent: this, newChild: newChild, oldChild: oldChild });
              this.appendChild(newChild);
              return oldChild;
            }
            return origReplaceChild.call(this, newChild, oldChild);
          };
        }

        if (typeof Window !== 'undefined') {
          var origPostMessage = Window.prototype.postMessage;
          Window.prototype.postMessage = function(message, targetOrigin, transfer) {
            try {
              return origPostMessage.call(this, message, targetOrigin, transfer);
            } catch (e) {
              if (e instanceof Error && (e.message.indexOf('target origin') !== -1 || e.message.indexOf('origin') !== -1)) {
                console.warn('DOM Patch [postMessage]: Suppressed origin mismatch error.', e);
                return;
              }
              throw e;
            }
          };
        }
      } catch (err) {
        console.error('DOM safety patches failed to initialize:', err);
      }
    })();
  `;
}

function RootShell({ children }: { children: ReactNode }) {
  const initialLang = getInitialShellLang();
  setActiveLang(initialLang);

  return (
    <html lang={initialLang} dir={getDirection(initialLang)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: getDomPatchesScript() }} />
        <script dangerouslySetInnerHTML={{ __html: getBootLangScript() }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const getInitialShellLang = createIsomorphicFn()
  .server(() => {
    const cookieHeader = getStartContext().request.headers.get("cookie");
    return readLangCookie(cookieHeader) ?? DEFAULT_LOCALE;
  })
  .client(() => {
    const storedLang = getStoredLang();
    if (storedLang === "he" || storedLang === "ar" || storedLang === "en") return storedLang;
    const bootLang =
      typeof window !== "undefined" && "__ccBootLang" in window
        ? (window as typeof window & { __ccBootLang?: unknown }).__ccBootLang
        : null;
    const htmlLang = typeof document !== "undefined" ? document.documentElement.lang : null;
    if (bootLang === "he" || bootLang === "ar" || bootLang === "en") return bootLang;
    if (htmlLang === "he" || htmlLang === "ar" || htmlLang === "en") return htmlLang;
    return DEFAULT_LOCALE;
  });

function readLangCookie(cookieHeader: string | null) {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LANG_COOKIE}=`));
  if (!match) return null;
  const value = decodeURIComponent(match.slice(LANG_COOKIE.length + 1));
  if (value === "en" || value === "he" || value === "ar") return value;
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      applyLang(getStoredLang());
    }
    void supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (token) writeSupabaseAccessTokenCookie(token, data.session?.expires_in ?? 3600);
      else clearSupabaseAccessTokenCookie();
    });
    if (typeof window !== "undefined") {
      void import("@capacitor/splash-screen")
        .then(({ SplashScreen }) => SplashScreen.hide())
        .catch(() => undefined);
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT" &&
        event !== "USER_UPDATED" &&
        event !== "TOKEN_REFRESHED"
      ) {
        return;
      }
      if (event === "SIGNED_OUT") {
        clearSupabaseAccessTokenCookie();
        void queryClient.cancelQueries().finally(() => queryClient.clear());
        void router.navigate({ to: "/auth", replace: true });
        return;
      }
      void supabase.auth.getSession().then(({ data }) => {
        const token = data.session?.access_token;
        if (token) writeSupabaseAccessTokenCookie(token, data.session?.expires_in ?? 3600);
      });
      if (event === "SIGNED_IN") return;
      router.invalidate();
      void queryClient.invalidateQueries();
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
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
