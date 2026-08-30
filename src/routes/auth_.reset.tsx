import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { getCanonicalResetUrl } from "@/lib/password-reset-flow";
import { useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { PublicShell } from "@/components/public/PublicShell";

export const Route = createFileRoute("/auth_/reset")({
  component: AuthResetRedirectPage,
});

function AuthResetRedirectPage() {
  const { dir, t } = useI18n();
  useDocumentTitle("page.resetPassword.title");

  useEffect(() => {
    window.location.replace(getCanonicalResetUrl(window.location.href));
  }, []);

  return (
    <PublicShell
      headerMode="compact"
      showAccount={false}
      mainClassName="auth-page min-h-[100dvh] member-shell flex items-center justify-center px-6 py-10"
    >
      <div className="w-full max-w-sm member-card auth-form-card p-8" dir={dir}>
        <p className="member-eyebrow">{t("reset.eyebrow")}</p>
        <h1 className="auth-form-title font-semibold text-navy mt-3 text-balance">
          {t("reset.validatingTitle")}
        </h1>
        <p className="text-sm text-slate mt-4 text-start">{t("reset.hint.loading")}</p>
      </div>
    </PublicShell>
  );
}
