import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useI18n } from "@/lib/i18n";
import "@/styles/public.css";
import { PublicLanguageSwitcher } from "./PublicLanguageSwitcher";

export interface PublicShellProps {
  children: ReactNode;
  headerMode?: "full" | "compact";
  showSchedule?: boolean;
  showAccount?: boolean;
  mainClassName?: string;
}

export function PublicShell({
  children,
  headerMode = "full",
  showSchedule = true,
  showAccount = true,
  mainClassName,
}: PublicShellProps) {
  const { t } = useI18n();

  return (
    <div className="min-h-dvh bg-[var(--cc-surface-canvas)] text-[var(--cc-text-primary)]">
      <a
        className="cc-skip-link sr-only fixed start-4 top-4 z-50 rounded-md bg-[var(--cc-action-primary)] px-4 py-3 text-[var(--cc-action-primary-foreground)] focus:not-sr-only focus-visible:outline-[var(--cc-focus-outline)] focus-visible:outline-offset-[var(--cc-focus-offset)]"
        href="#main-content"
      >
        {t("common.skipToContent")}
      </a>
      <PublicHeader headerMode={headerMode} showSchedule={showSchedule} showAccount={showAccount} />
      <main id="main-content" className={mainClassName}>
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}

function PublicHeader({
  headerMode,
  showSchedule,
  showAccount,
}: Omit<PublicShellProps, "children" | "mainClassName">) {
  const { t } = useI18n();

  return (
    <header
      className={`public-shell-header public-shell-header--${headerMode ?? "full"} border-b border-[color:var(--color-border)] bg-[var(--cc-surface-raised)]`}
    >
      <div className="public-shell-header__inner mx-auto flex min-h-[var(--cc-target-min)] max-w-6xl items-center gap-3">
        <Link
          to="/"
          className="public-shell-header__brand font-display text-xl font-semibold text-[var(--cc-text-primary)] focus-visible:outline-[var(--cc-focus-outline)] focus-visible:outline-offset-[var(--cc-focus-offset)]"
        >
          {t("public.brand")}
        </Link>
        {headerMode === "full" && (showSchedule || showAccount) ? (
          <nav
            className="public-shell-header__nav ms-auto flex items-center gap-2"
            aria-label={t("public.navigation")}
          >
            {showSchedule ? (
              <Link
                to="/schedule"
                className="inline-flex min-h-[var(--cc-target-min)] items-center px-3 text-sm font-medium text-[var(--cc-text-secondary)] focus-visible:outline-[var(--cc-focus-outline)] focus-visible:outline-offset-[var(--cc-focus-offset)]"
              >
                {t("public.schedule")}
              </Link>
            ) : null}
            {showAccount ? (
              <Link
                to="/auth"
                className="inline-flex min-h-[var(--cc-target-min)] items-center px-3 text-sm font-medium text-[var(--cc-text-secondary)] focus-visible:outline-[var(--cc-focus-outline)] focus-visible:outline-offset-[var(--cc-focus-offset)]"
              >
                {t("public.account")}
              </Link>
            ) : null}
          </nav>
        ) : (
          <div className="public-shell-header__spacer ms-auto" />
        )}
        <PublicLanguageSwitcher className="public-shell-header__languages" />
      </div>
    </header>
  );
}

function PublicFooter() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-[color:var(--color-border)] bg-[var(--cc-surface-subtle)]">
      <nav
        className="mx-auto flex max-w-6xl flex-wrap gap-x-4 gap-y-2 px-4 py-5 text-sm sm:px-6"
        aria-label={t("public.footerNavigation")}
      >
        <Link to="/privacy" className="focus-visible:outline-[var(--cc-focus-outline)]">
          {t("legal.privacy")}
        </Link>
        <Link to="/terms" className="focus-visible:outline-[var(--cc-focus-outline)]">
          {t("legal.terms")}
        </Link>
        <Link to="/support" className="focus-visible:outline-[var(--cc-focus-outline)]">
          {t("legal.support")}
        </Link>
      </nav>
    </footer>
  );
}
