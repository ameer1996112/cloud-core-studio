const PUBLIC_SHELL_PATHS = new Set([
  "/auth",
  "/auth/reset",
  "/reset-password",
  "/member/schedule",
  "/checkout",
  "/payment-result",
  "/privacy",
  "/terms",
  "/support",
  "/download",
  "/instagram",
  "/promo/yoga-lina",
  "/app",
]);

export function shouldShowRootSkipLink(pathname: string) {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  return !PUBLIC_SHELL_PATHS.has(normalizedPathname);
}
