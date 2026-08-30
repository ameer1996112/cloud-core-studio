import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clearSupabaseAccessTokenCookie } from "@/integrations/supabase/session-cookie";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  clearPasswordResetUrlTokens,
  getResetPasswordValidationError,
  validatePasswordResetRecovery,
} from "@/lib/password-reset-flow";
import { PublicShell } from "@/components/public/PublicShell";
import { PasswordResetPanel } from "@/components/auth/PasswordResetPanel";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { lang, dir, t } = useI18n();
  useDocumentTitle("page.resetPassword.title");
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"validating" | "ready" | "invalid">("validating");
  const [formError, setFormError] = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    let recoveryEventReceived = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        recoveryEventReceived = true;
        setStatus("ready");
        clearPasswordResetUrlTokens();
      }
    });

    validatePasswordResetRecovery({
      auth: supabase.auth,
      href: window.location.href,
    })
      .then((result) => {
        if (cancelled) return;
        setStatus(result.status === "ready" || recoveryEventReceived ? "ready" : "invalid");
        clearPasswordResetUrlTokens();
      })
      .catch(() => {
        if (cancelled) return;
        setStatus(recoveryEventReceived ? "ready" : "invalid");
        clearPasswordResetUrlTokens();
      });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const validationKey = getResetPasswordValidationError(password, confirm);
    if (validationKey) {
      const message = t(validationKey);
      setFormError(message);
      toast(message);
      window.requestAnimationFrame(() => {
        (validationKey === "reset.mismatch" ? confirmRef : passwordRef).current?.focus();
      });
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(t("reset.success"));
      await supabase.auth.signOut();
      clearSupabaseAccessTokenCookie();
      clearPasswordResetUrlTokens();
      navigate({ to: "/auth", replace: true });
    } catch (err) {
      const message = localizedResetError(err, t("reset.error"));
      setFormError(message);
      toast(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicShell
      headerMode="compact"
      showAccount={false}
      mainClassName="auth-page min-h-[100dvh] member-shell flex items-center justify-center px-6 py-10"
    >
      <PasswordResetPanel status={status} lang={lang}>
        {status === "ready" && (
          <form onSubmit={submit} className="space-y-4 mt-7" dir={dir}>
            <label className="block text-start">
              <span className="field-label">{t("reset.newPassword")}</span>
              <div className="relative">
                <input
                  ref={passwordRef}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFormError("");
                  }}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  dir="ltr"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="auth-ltr-input auth-password-input editorial-input focus:editorial-input-focus pe-10"
                  aria-invalid={formError === t("reset.tooShort")}
                  aria-describedby={formError ? "reset-password-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="auth-password-toggle absolute top-1/2 -translate-y-1/2 text-slate hover:text-navy"
                  aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <label className="block text-start">
              <span className="field-label">{t("reset.confirmPassword")}</span>
              <div className="relative">
                <input
                  ref={confirmRef}
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    setFormError("");
                  }}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  dir="ltr"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="auth-ltr-input auth-password-input editorial-input focus:editorial-input-focus pe-10"
                  aria-invalid={formError === t("reset.mismatch")}
                  aria-describedby={formError ? "reset-password-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="auth-password-toggle absolute top-1/2 -translate-y-1/2 text-slate hover:text-navy"
                  aria-label={showConfirm ? t("auth.hidePassword") : t("auth.showPassword")}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {formError && (
              <p
                id="reset-password-error"
                className="auth-form-error"
                role="alert"
                aria-live="polite"
              >
                {formError}
              </p>
            )}

            <button
              disabled={busy}
              className={
                busy ? "cta-navy cta-navy-disabled mt-3" : "cta-navy hover:cta-navy-hover mt-3"
              }
            >
              {busy ? t("reset.saving") : t("reset.submit")}
            </button>
          </form>
        )}

        {status === "invalid" && (
          <div className="mt-7 space-y-3">
            <a href="/auth?mode=forgot" className="cta-navy hover:cta-navy-hover block text-center">
              {t("reset.requestNew")}
            </a>
            <Link
              to="/auth"
              className="auth-secondary-action block w-full text-center text-slate hover:text-navy"
            >
              {t("auth.back")}
            </Link>
          </div>
        )}
      </PasswordResetPanel>
    </PublicShell>
  );
}

function localizedResetError(err: unknown, fallback: string) {
  const anyErr = err as { message?: string; error_description?: string };
  const message = (anyErr?.message ?? anyErr?.error_description ?? String(err)).toString();

  if (/password.*(short|weak|strength)|weak_password/i.test(message)) return fallback;
  if (/session|jwt|token|expired|invalid/i.test(message)) return fallback;
  if (/network|fetch failed|failed to fetch|timeout/i.test(message)) return fallback;

  return fallback;
}
