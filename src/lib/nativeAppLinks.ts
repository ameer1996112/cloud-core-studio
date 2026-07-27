import { Capacitor } from "@capacitor/core";

const TRUSTED_APP_LINK_HOSTS = new Set(["cloudandcorestudio.com", "www.cloudandcorestudio.com"]);
const NATIVE_MEMBER_ROUTES = new Map([
  ["/member", "/member"],
  ["/member/", "/member"],
  ["/member/account", "/member/account"],
  ["/member/bookings", "/member/bookings"],
  ["/member/packages", "/member/packages"],
  ["/member/payments", "/member/packages"],
  ["/member/schedule", "/member/schedule"],
]);

export function nativeMemberRouteFromUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !TRUSTED_APP_LINK_HOSTS.has(url.hostname)) return null;
  const route = NATIVE_MEMBER_ROUTES.get(url.pathname);
  if (!route) return null;
  return `${route}${url.search}${url.hash}`;
}

export async function installNativeAppLinkHandling(
  navigate: (route: string) => void = (route) => window.location.assign(route),
) {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return () => undefined;

  const { App } = await import("@capacitor/app");
  const openInApp = (rawUrl: string | undefined) => {
    if (!rawUrl) return;
    const route = nativeMemberRouteFromUrl(rawUrl);
    if (route) navigate(route);
  };

  const listener = await App.addListener("appUrlOpen", ({ url }) => openInApp(url));
  const launch = await App.getLaunchUrl().catch(() => null);
  openInApp(launch?.url);

  return () => {
    void listener.remove();
  };
}

export function startNativeAppLinkHandling(
  install: () => Promise<() => void> = installNativeAppLinkHandling,
) {
  let active = true;
  let dispose: (() => void) | undefined;

  void install()
    .then((cleanup) => {
      if (active) dispose = cleanup;
      else cleanup();
    })
    .catch((error) => console.warn("native_app_link_initialization_failed", error));

  return () => {
    active = false;
    dispose?.();
  };
}
