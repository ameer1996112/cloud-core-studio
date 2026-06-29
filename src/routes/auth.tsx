import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  clearSupabaseAccessTokenCookie,
  writeSupabaseAccessTokenCookie,
} from "@/integrations/supabase/session-cookie";
import { applyLang, LANG_META, t, useI18n, type Lang } from "@/lib/i18n";
import { toast } from "sonner";
import { homeForCurrentUser, roleHome, getCurrentRole } from "@/lib/auth-redirect";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { getPasswordResetRedirectUrl } from "@/lib/password-reset-flow";

import { authImages } from "@/lib/image-assets";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { lang, dir } = useI18n();
  useDocumentTitle("page.auth.title");
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "check-email">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [formVersion, setFormVersion] = useState(0);

  useEffect(() => {
    let requestedForgot = false;
    if (typeof window !== "undefined") {
      const requestedMode = new URL(window.location.href).searchParams.get("mode");
      if (requestedMode === "forgot") {
        requestedForgot = true;
        setMode("forgot");
        window.history.replaceState(null, document.title, window.location.pathname);
      }
    }
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session && !requestedForgot) {
        const to = await homeForCurrentUser();
        navigate({ to, replace: true });
      }
    });
  }, [navigate]);

  function changeLang(next: Lang) {
    applyLang(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data: signed, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { name, phone } },
        });
        if (error) throw error;
        if (signed.session) {
          await supabase.auth.signOut();
          clearSupabaseAccessTokenCookie();
        }
        setMode("signin");
        setName("");
        setPhone("");
        setEmail("");
        setPassword("");
        setShowPassword(false);
        setFormVersion((version) => version + 1);
        setFormSuccess(t("auth.signupComplete"));
        toast.success(t("auth.signupComplete"));
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getPasswordResetRedirectUrl(window.location.origin),
        });
        if (error) throw error;
        setFormSuccess(t("auth.resetSent"));
        toast.success(t("auth.resetSent"));
        setMode("check-email");
        setPassword("");
        setFormVersion((version) => version + 1);
      } else if (mode === "check-email") {
        setMode("forgot");
      } else {
        const { data: signed, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (signed.session?.access_token) {
          writeSupabaseAccessTokenCookie(signed.session.access_token, signed.session.expires_in);
        }
        const uid = signed.user?.id;
        const role = uid ? await getCurrentRole(uid) : "member";
        navigate({ to: roleHome(role), replace: true });
      }
    } catch (err) {
      const { friendlyErrorMessage } = await import("@/lib/error-messages");
      const message = localizedAuthError(err) ?? friendlyErrorMessage(err, t("auth.tryAgain"));
      setFormError(message);
    } finally {
      setBusy(false);
    }
  }

  function clearError() {
    if (formError) setFormError("");
    if (formSuccess) setFormSuccess("");
  }

  function switchMode(next: "signin" | "signup" | "forgot" | "check-email") {
    setMode(next);
    setFormError("");
    setFormSuccess("");
    setEmail("");
    setPassword("");
    setName("");
    setShowPassword(false);
    setFormVersion((version) => version + 1);
  }

  const eyebrow =
    mode === "signin"
      ? t("auth.members")
      : mode === "signup"
        ? t("auth.newHere")
        : mode === "check-email"
          ? t("auth.recover")
          : t("auth.recover");
  const headline =
    mode === "signin"
      ? t("auth.signinHeadline")
      : mode === "signup"
        ? t("auth.signupHeadline")
        : mode === "check-email"
          ? t("auth.checkEmailTitle")
          : t("auth.forgotHeadline");

  return (
    <main
      dir={dir}
      className="auth-page relative min-h-[100dvh] overflow-x-hidden bg-[var(--color-surface-warm)] flex flex-col"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <img
          src={authImages.hero.src}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover opacity-[0.56] md:opacity-[0.72]"
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(250,247,242,0.44)_0%,rgba(250,247,242,0.78)_34%,rgba(250,247,242,0.98)_100%)] md:bg-[linear-gradient(90deg,rgba(250,247,242,0.98)_0%,rgba(250,247,242,0.90)_44%,rgba(250,247,242,0.36)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(212,175,106,0.18),transparent_34%)]" />
      </div>

      <header className="auth-mobile-topbar">
        <AuthLanguageSwitcher lang={lang} onChange={changeLang} />
      </header>

      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="auth-mobile-stage">
          <div className="auth-mobile-panel">
            <div className="auth-brand-lockup">
              <img
                src="/brand/cloud-core-logo-full.png"
                alt="Cloud & Core Studio"
                width={220}
                height={124}
                className="auth-brand-logo"
              />
            </div>

            <div className="auth-form-card member-card relative">
              <p className="member-eyebrow">{eyebrow}</p>
              <h1 className="auth-form-title font-semibold text-navy mt-2 text-balance">
                {headline}
              </h1>
              <div className="mt-3 h-px w-10 bg-gold" />
              {(mode === "forgot" || mode === "check-email") && (
                <p className="auth-form-helper mt-3 text-sm text-slate text-start">
                  {mode === "forgot" ? t("auth.forgotBody") : t("auth.resetSent")}
                </p>
              )}

              <form
                key={`${mode}-${formVersion}`}
                onSubmit={submit}
                className="auth-form mt-4 sm:mt-5"
                dir={dir}
                autoComplete={mode === "signin" ? "on" : "off"}
              >
                {mode === "check-email" ? (
                  <div className="auth-check-email-panel" role="status" aria-live="polite">
                    <p>{t("auth.resetSent")}</p>
                  </div>
                ) : null}

                {mode === "signup" && (
                  <>
                    <Field label={t("auth.name")}>
                      <input
                        name={`signup-name-${formVersion}`}
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          clearError();
                        }}
                        required
                        className="auth-text-input editorial-input focus:editorial-input-focus"
                        autoComplete="off"
                        autoCapitalize="words"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </Field>
                    <Field label={t("auth.phone")}>
                      <input
                        type="tel"
                        name={`signup-phone-${formVersion}`}
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          clearError();
                        }}
                        required
                        className="auth-text-input editorial-input focus:editorial-input-focus"
                        autoComplete="tel"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </Field>
                  </>
                )}
                {mode !== "check-email" && (
                  <Field label={t("auth.email")}>
                    <input
                      type="email"
                      name={mode === "signup" ? `signup-email-${formVersion}` : "username"}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        clearError();
                      }}
                      required
                      className="auth-ltr-input editorial-input focus:editorial-input-focus"
                      autoComplete={mode === "signin" ? "username" : "off"}
                      dir="ltr"
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </Field>
                )}
                {(mode === "signin" || mode === "signup") && (
                  <Field label={t("auth.password")}>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        name={
                          mode === "signup" ? `signup-password-${formVersion}` : "current-password"
                        }
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          clearError();
                        }}
                        required
                        minLength={6}
                        className="auth-ltr-input auth-password-input editorial-input focus:editorial-input-focus"
                        autoComplete={mode === "signup" ? "new-password" : "current-password"}
                        dir="ltr"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
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
                    {mode === "signup" && <PasswordStrength password={password} />}
                  </Field>
                )}

                {formError && (
                  <p
                    className="auth-form-error"
                    role="alert"
                    aria-live="polite"
                    dir={lang === "en" ? "ltr" : "rtl"}
                  >
                    {formError}
                  </p>
                )}
                {formSuccess && (
                  <p className="auth-form-success" role="status" aria-live="polite">
                    {formSuccess}
                  </p>
                )}

                {mode !== "check-email" && (
                  <button
                    type="submit"
                    disabled={busy}
                    className={
                      busy ? "cta-navy cta-navy-disabled" : "cta-navy hover:cta-navy-hover"
                    }
                  >
                    {busy
                      ? t("auth.busy")
                      : mode === "signin"
                        ? t("auth.enter")
                        : mode === "signup"
                          ? t("auth.reserve")
                          : t("auth.reset")}
                  </button>
                )}

                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="auth-secondary-action block w-full text-center text-slate hover:text-navy"
                  >
                    {t("auth.forgot")}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
                  className="auth-switch-action block w-full text-center text-navy hover:text-gold pt-2 border-t hairline"
                >
                  {mode === "signin"
                    ? t("auth.create")
                    : mode === "signup"
                      ? t("auth.already")
                      : t("auth.back")}
                </button>
              </form>
            </div>

            <div className="auth-legal-links flex justify-center gap-6 mt-6 pb-6">
              <Link to="/privacy" className="auth-legal-link text-slate hover:text-navy">
                {t("legal.privacy")}
              </Link>
              <Link to="/terms" className="auth-legal-link text-slate hover:text-navy">
                {t("legal.terms")}
              </Link>
              <Link to="/support" className="auth-legal-link text-slate hover:text-navy">
                {t("legal.support")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function isInvalidCredentialsError(err: unknown) {
  const anyErr = err as { message?: string; error_description?: string };
  const message = (anyErr?.message ?? anyErr?.error_description ?? String(err)).toString();
  return /invalid login|invalid credentials|invalid_grant/i.test(message);
}

function localizedAuthError(err: unknown) {
  const anyErr = err as { message?: string; error_description?: string };
  const message = (anyErr?.message ?? anyErr?.error_description ?? String(err)).toString();

  if (isInvalidCredentialsError(err)) return t("auth.error.invalidCredentials");
  if (/email not confirmed/i.test(message)) return t("auth.error.emailNotConfirmed");
  if (/user already registered|already exists/i.test(message)) {
    return t("auth.error.emailAlreadyExists");
  }
  if (/password.*(short|6|weak)/i.test(message)) return t("auth.error.passwordTooShort");
  if (/rate limit|too many requests/i.test(message)) return t("auth.error.rateLimit");
  if (/network|fetch failed|failed to fetch|timeout/i.test(message)) return t("auth.error.network");

  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="auth-field block text-start">
      <span className="auth-field-label field-label">{label}</span>
      {children}
    </label>
  );
}

function AuthLanguageSwitcher({ lang, onChange }: { lang: Lang; onChange: (next: Lang) => void }) {
  const codes: Lang[] = ["he", "en", "ar"];

  return (
    <div className="auth-language-switcher" role="group" aria-label={t("profile.language")}>
      {codes.map((code) => (
        <button
          key={code}
          type="button"
          data-active={lang === code}
          aria-pressed={lang === code}
          lang={code}
          dir={LANG_META[code].dir}
          onClick={() => onChange(code)}
        >
          {LANG_META[code].label}
        </button>
      ))}
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: t("auth.check.8"), ok: password.length >= 8 },
    { label: t("auth.check.upper"), ok: /[A-Z]/.test(password) },
    { label: t("auth.check.lower"), ok: /[a-z]/.test(password) },
    { label: t("auth.check.number"), ok: /\d/.test(password) },
    { label: t("auth.check.symbol"), ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const levels = [
    "auth.level.0",
    "auth.level.1",
    "auth.level.2",
    "auth.level.3",
    "auth.level.4",
    "auth.level.5",
  ] as const;
  const strengthClass =
    score <= 1
      ? "auth-strength-weak"
      : score <= 3
        ? "auth-strength-medium"
        : "auth-strength-strong";
  return (
    <div className={`auth-password-strength ${strengthClass}`}>
      <div className="auth-strength-meter" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} data-active={i < score} />
        ))}
      </div>
      <div className="auth-strength-header">
        <span>{t("auth.strength")}</span>
        <strong>{password ? t(levels[score]) : t(levels[0])}</strong>
      </div>
      {password.length > 0 && (
        <ul className="auth-strength-checks">
          {checks.map((c) => (
            <li key={c.label} data-ok={c.ok}>
              <span aria-hidden>{c.ok ? "✓" : "○"}</span>
              {c.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
