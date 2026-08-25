import { createFileRoute, redirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getStartContext } from "@tanstack/start-storage-context";
import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

import {
  isExplicitNativePlatformRequest,
  isNativeRootRequest,
  resolveRootEntryRedirect,
  resolveRootEntryRedirectAfterAuth,
  resolveRootPublicRedirect,
} from "@/lib/app-marketing";
import { LANG_KEY, readLangCookieHeader, readSupportedLang } from "@/lib/i18n";
import { getAuthRouteContext } from "@/lib/route-guards";

const getRootRequestContext = createIsomorphicFn()
  .server(() => {
    const request = getStartContext().request;
    const url = new URL(request.url);
    return {
      isExplicitNative: isNativeRootRequest({
        search: url.search,
        userAgent: request.headers.get("user-agent"),
      }),
    };
  })
  .client(() => ({ isExplicitNative: isExplicitNativePlatformRequest(window.location.search) }));

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const rootEntryRedirect = await resolveRootEntryRedirectAfterAuth({
      auth: getAuthRouteContext(),
      isExplicitNative: getRootRequestContext()?.isExplicitNative ?? false,
    });
    if (rootEntryRedirect) {
      throw redirect({ to: rootEntryRedirect, replace: true });
    }
  },
  head: () => ({
    meta: [{ title: "Opening Cloud & Core" }, { name: "robots", content: "noindex,follow" }],
  }),
  component: RootPlatformBridge,
});

function RootPlatformBridge() {
  useEffect(() => {
    let isCurrent = true;

    void getAuthRouteContext()
      .then((auth) => {
        if (!isCurrent) return;
        const rootEntryRedirect = resolveRootEntryRedirect({
          role: auth?.role,
          isExplicitNative: false,
        });
        if (rootEntryRedirect) {
          window.location.replace(rootEntryRedirect);
          return;
        }

        redirectPublicVisitor();
      })
      .catch(() => {
        if (isCurrent) redirectPublicVisitor();
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <section className="max-w-sm text-center" lang="en" dir="ltr">
        <h1 className="font-display text-3xl text-foreground">Opening Cloud &amp; Core</h1>
        <p className="mt-3 text-sm text-muted-foreground" role="status" aria-live="polite">
          Preparing your destination…
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          <a className="underline underline-offset-4" href="/app/ar">
            Continue to Cloud &amp; Core
          </a>
        </p>
        <noscript>
          <p className="mt-3 text-sm text-muted-foreground">
            JavaScript is required to open the app. Continue with the public studio page.
          </p>
        </noscript>
      </section>
    </main>
  );
}

function redirectPublicVisitor() {
  let saved = readLangCookieHeader(document.cookie);
  try {
    saved = readSupportedLang(window.localStorage.getItem(LANG_KEY)) ?? saved;
  } catch {
    // Some privacy modes make local storage unavailable; the cookie remains a safe preference.
  }

  window.location.replace(
    resolveRootPublicRedirect({
      isNative: Capacitor.isNativePlatform(),
      saved,
      accepted: [...navigator.languages],
      search: window.location.search,
    }),
  );
}
