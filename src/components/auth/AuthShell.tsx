import type { ReactNode } from "react";

import "@/components/public/PublicShell";
import { useI18n } from "@/lib/i18n";

interface AuthShellProps {
  children: ReactNode;
  mainClassName?: string;
}

export function AuthShell({ children, mainClassName }: AuthShellProps) {
  const { t } = useI18n();

  return (
    <div className="min-h-dvh bg-[var(--cc-surface-canvas)] text-[var(--cc-text-primary)]">
      <a
        className="cc-skip-link sr-only fixed start-4 top-4 z-50 rounded-md bg-[var(--cc-action-primary)] px-4 py-3 text-[var(--cc-action-primary-foreground)] focus:not-sr-only focus-visible:outline-[var(--cc-focus-outline)] focus-visible:outline-offset-[var(--cc-focus-offset)]"
        href="#main-content"
      >
        {t("common.skipToContent")}
      </a>
      <main id="main-content" className={mainClassName}>
        {children}
      </main>
    </div>
  );
}
