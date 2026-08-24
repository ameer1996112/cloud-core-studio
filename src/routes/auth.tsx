import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  clearSupabaseAccessTokenCookie,
  syncSupabaseAccessTokenCookie,
} from "@/integrations/supabase/session-cookie";
import { applyLang, LANG_META, t, useI18n, type Lang } from "@/lib/i18n";
import { toast } from "sonner";
import { roleHome, getCurrentRole } from "@/lib/auth-redirect";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { getPasswordResetRedirectUrl } from "@/lib/password-reset-flow";
import { resolvePostAuthDestination } from "@/lib/guest-auth-intent";
import { notifyAdminMemberSignup } from "@/lib/adminPush.functions";
import { SignupNotificationChoices } from "@/components/auth/SignupNotificationChoices";
import {
  DEFAULT_SIGNUP_NOTIFICATION_CHOICES,
  buildSignupNotificationMetadata,
} from "@/lib/signupNotificationConsent";
import {
  validateAuthFields,
  type AuthFieldName,
  type AuthValidationErrors,
  type AuthValidationIssue,
} from "@/lib/authValidation";
import { getYogaPromoAttributionToken, trackYogaPromo } from "@/lib/yogaPromo";

import { authImages, authLogo } from "@/lib/auth-assets";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const AUTH_VALIDATION_MESSAGE_KEYS: Record<AuthValidationIssue, Parameters<typeof t>[0]> = {
  required: "auth.validation.required",
  invalidEmail: "auth.validation.invalidEmail",
  passwordTooShort: "auth.validation.passwordTooShort",
};

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
  const [whatsappUpdatesEnabled, setWhatsappUpdatesEnabled] = useState(
    DEFAULT_SIGNUP_NOTIFICATION_CHOICES.whatsapp,
  );
  const [marketingUpdatesEnabled, setMarketingUpdatesEnabled] = useState(
    DEFAULT_SIGNUP_NOTIFICATION_CHOICES.marketing,
  );
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthValidationErrors>({});
  const [formVersion, setFormVersion] = useState(0);
  const [restoringSession, setRestoringSession] = useState(true);
  const [returnToPath, setReturnToPath] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URL(window.location.href).searchParams;
      const requestedMode = searchParams.get("mode");
      setReturnToPath(searchParams.get("returnTo"));
      if (requestedMode === "forgot" || requestedMode === "signup") {
        setMode(requestedMode);
        if (requestedMode === "signup" && getYogaPromoAttributionToken()) {
          trackYogaPromo("yoga_promo_signup_started");
        }
      }
      if (requestedMode === "forgot") {
        window.history.replaceState(null, document.title, window.location.pathname);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreExistingSession() {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      if (url.searchParams.get("mode") === "forgot") {
        if (!cancelled) setRestoringSession(false);
        return;
      }

      let redirected = false;

      try {
        const { getFreshSupabaseSession } = await import("@/integrations/supabase/auth-session");
        const session = await getFreshSupabaseSession();
        const uid = session?.user?.id;
        if (!uid) return;

        const role = await getCurrentRole(uid);
        const fallbackTo = roleHome(role);
        const to = resolvePostAuthDestination({
          fallbackTo,
          origin: window.location.origin,
          returnTo: url.searchParams.get("returnTo"),
          storage: window.sessionStorage,
        });
        if (!cancelled) {
          redirected = true;
          navigate({ to, replace: true });
        }
      } finally {
        if (!cancelled && !redirected) setRestoringSession(false);
      }
    }

    void restoreExistingSession();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  function changeLang(next: Lang) {
    applyLang(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    const validationErrors = validateAuthFields({ mode, name, email, password });
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      window.requestAnimationFrame(() => {
        formRef.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus({ preventScroll: false });
      });
      return;
    }

    setFieldErrors({});
    setBusy(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      if (mode === "signup") {
        const trimmedPhone = phone.trim();
        const { data: signed, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              name,
              preferred_language: lang,
              ...buildSignupNotificationMetadata({
                phone: trimmedPhone,
                whatsapp: whatsappUpdatesEnabled,
                marketing: marketingUpdatesEnabled,
              }),
              ...(trimmedPhone ? { phone: trimmedPhone } : {}),
            },
          },
        });
        if (error) throw error;
        if (signed.user?.id) {
          try {
            const notificationResult = await notifyAdminMemberSignup({
              data: { memberId: signed.user.id },
            });
            if (!notificationResult.ok) {
              console.warn("admin_signup_push_skipped", notificationResult);
            }
          } catch (error) {
            console.error("admin_signup_push_failed", error);
          }
        }
        if (getYogaPromoAttributionToken()) trackYogaPromo("yoga_promo_signup_completed");
        if (signed.session) {
          await supabase.auth.signOut();
          clearSupabaseAccessTokenCookie();
        }
        setMode("signin");
        setName("");
        setPhone("");
        setWhatsappUpdatesEnabled(DEFAULT_SIGNUP_NOTIFICATION_CHOICES.whatsapp);
        setMarketingUpdatesEnabled(DEFAULT_SIGNUP_NOTIFICATION_CHOICES.marketing);
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
        syncSupabaseAccessTokenCookie(signed.session);
        const uid = signed.user?.id;
        const role = uid ? await getCurrentRole(uid) : "member";
        const fallbackTo = roleHome(role);
        const to =
          typeof window === "undefined"
            ? fallbackTo
            : resolvePostAuthDestination({
                fallbackTo,
                origin: window.location.origin,
                returnTo: new URL(window.location.href).searchParams.get("returnTo"),
                storage: window.sessionStorage,
              });
        navigate({ to, replace: true });
      }
    } catch (err) {
      const { friendlyErrorMessage } = await import("@/lib/error-messages");
      const message = localizedAuthError(err) ?? friendlyErrorMessage(err, t("auth.tryAgain"));
      setFormError(message);
    } finally {
      setBusy(false);
    }
  }

  function clearError(field?: AuthFieldName) {
    if (formError) setFormError("");
    if (formSuccess) setFormSuccess("");
    if (field && fieldErrors[field]) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  }

  function switchMode(next: "signin" | "signup" | "forgot" | "check-email") {
    setMode(next);
    setFormError("");
    setFormSuccess("");
    setFieldErrors({});
    setEmail("");
    setPassword("");
    setName("");
    setPhone("");
    setWhatsappUpdatesEnabled(DEFAULT_SIGNUP_NOTIFICATION_CHOICES.whatsapp);
    setMarketingUpdatesEnabled(DEFAULT_SIGNUP_NOTIFICATION_CHOICES.marketing);
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
  const guestEntryTitle = t("auth.guestTitle");
  const guestEntryBody = t("auth.guestBody");
  const browseScheduleLabel = t("auth.browseSchedule");
  const guestSupportLabel = t("auth.guestSupport");
  const isPackageReturn = returnToPath === "/member/packages";
  const fieldErrorText = (field: AuthFieldName) => {
    const issue = fieldErrors[field];
    return issue ? t(AUTH_VALIDATION_MESSAGE_KEYS[issue]) : undefined;
  };

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
          className="h-full w-full object-cover opacity-[0.48] contrast-[1.08] saturate-[0.94] md:opacity-[0.66]"
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(246,238,226,0.28)_0%,rgba(246,238,226,0.58)_36%,rgba(246,238,226,0.92)_100%)] md:bg-[linear-gradient(90deg,rgba(246,238,226,0.94)_0%,rgba(246,238,226,0.74)_46%,rgba(246,238,226,0.18)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.38),transparent_30%),linear-gradient(180deg,rgba(11,29,58,0.08),transparent_42%,rgba(11,29,58,0.07))]" />
      </div>

      <header className="auth-mobile-topbar">
        <AuthLanguageSwitcher lang={lang} onChange={changeLang} />
      </header>

      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="auth-mobile-stage">
          <div className="auth-mobile-panel">
            <div className="auth-brand-lockup">
              <img
                src={authLogo.src}
                alt={authLogo.alt}
                width={authLogo.width}
                height={authLogo.height}
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
              {!restoringSession && mode === "signin" && isPackageReturn && (
                <p className="auth-form-helper mt-3 text-sm text-slate text-start">
                  {t("auth.returnToPackagesBody")}
                </p>
              )}

              {restoringSession ? (
                <div
                  className="auth-check-email-panel mt-5 min-h-24 justify-center"
                  role="status"
                  aria-live="polite"
                >
                  <span className="auth-restoring-orbit" aria-hidden="true">
                    <span />
                  </span>
                  <p className="auth-restoring-text">{t("auth.checkingSession")}</p>
                </div>
              ) : (
                <form
                  key={`${mode}-${formVersion}`}
                  ref={formRef}
                  onSubmit={submit}
                  className="auth-form mt-4 sm:mt-5"
                  dir={dir}
                  autoComplete="on"
                  noValidate
                >
                  {mode === "check-email" ? (
                    <div className="auth-check-email-panel" role="status" aria-live="polite">
                      <p>{t("auth.resetSent")}</p>
                    </div>
                  ) : null}

                  {mode === "signup" && (
                    <>
                      <Field
                        label={t("auth.name")}
                        error={fieldErrorText("name")}
                        errorId="auth-name-error"
                      >
                        <input
                          name="name"
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            clearError("name");
                          }}
                          required
                          className="auth-text-input editorial-input focus:editorial-input-focus"
                          autoComplete="name"
                          aria-invalid={Boolean(fieldErrors.name)}
                          aria-describedby={fieldErrors.name ? "auth-name-error" : undefined}
                          autoCapitalize="words"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                      </Field>
                      <Field label={t("auth.phoneOptional")}>
                        <input
                          type="tel"
                          name={`signup-phone-${formVersion}`}
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value);
                            clearError();
                          }}
                          className="auth-text-input editorial-input focus:editorial-input-focus"
                          autoComplete="tel"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                        <p className="mt-2 text-xs leading-5 text-slate text-start">
                          {t("auth.phoneOptionalHelp")}
                        </p>
                      </Field>
                    </>
                  )}
                  {mode !== "check-email" && (
                    <Field
                      label={t("auth.email")}
                      error={fieldErrorText("email")}
                      errorId="auth-email-error"
                    >
                      <input
                        type="email"
                        name={mode === "signin" ? "username" : "email"}
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          clearError("email");
                        }}
                        required
                        className="auth-ltr-input editorial-input focus:editorial-input-focus"
                        autoComplete={mode === "signin" ? "username" : "email"}
                        aria-invalid={Boolean(fieldErrors.email)}
                        aria-describedby={fieldErrors.email ? "auth-email-error" : undefined}
                        dir="ltr"
                        inputMode="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </Field>
                  )}
                  {(mode === "signin" || mode === "signup") && (
                    <Field
                      label={t("auth.password")}
                      error={fieldErrorText("password")}
                      errorId="auth-password-error"
                    >
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          name={
                            mode === "signup"
                              ? `signup-password-${formVersion}`
                              : "current-password"
                          }
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            clearError("password");
                          }}
                          required
                          minLength={6}
                          className="auth-ltr-input auth-password-input editorial-input focus:editorial-input-focus"
                          autoComplete={mode === "signup" ? "new-password" : "current-password"}
                          aria-invalid={Boolean(fieldErrors.password)}
                          aria-describedby={
                            fieldErrors.password ? "auth-password-error" : undefined
                          }
                          dir="ltr"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="auth-password-toggle absolute top-1/2 -translate-y-1/2 text-slate hover:text-navy"
                          aria-label={
                            showPassword ? t("auth.hidePassword") : t("auth.showPassword")
                          }
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {mode === "signup" && <PasswordStrength password={password} />}
                    </Field>
                  )}
                  {mode === "signup" && (
                    <SignupNotificationChoices
                      lang={lang}
                      phone={phone}
                      whatsapp={whatsappUpdatesEnabled}
                      marketing={marketingUpdatesEnabled}
                      onWhatsappChange={setWhatsappUpdatesEnabled}
                      onMarketingChange={setMarketingUpdatesEnabled}
                    />
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
                  <section
                    className="mt-5 border-t hairline pt-5"
                    aria-labelledby="auth-guest-entry"
                  >
                    <p id="auth-guest-entry" className="member-eyebrow text-slate">
                      {guestEntryTitle}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate text-start">{guestEntryBody}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <Link
                        to="/member/schedule"
                        className="inline-flex min-h-11 items-center justify-center rounded-full border border-gold/35 bg-white/92 px-5 text-sm font-semibold tracking-[0.08em] text-navy shadow-[0_18px_50px_-30px_rgba(11,29,58,0.38)] transition-colors hover:bg-gold/8"
                      >
                        {browseScheduleLabel}
                      </Link>
                      <Link
                        to="/support"
                        className="inline-flex min-h-11 items-center justify-center rounded-full border border-navy/12 bg-transparent px-5 text-sm font-medium text-slate transition-colors hover:border-gold/35 hover:text-navy"
                      >
                        {guestSupportLabel}
                      </Link>
                    </div>
                  </section>
                </form>
              )}
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
              <Link to="/checkout" className="auth-legal-link text-slate hover:text-navy">
                {t("legal.checkout")}
              </Link>
            </div>
            <p className="pb-6 text-center text-xs font-medium text-slate/80">
              Cloud and Core Studio · Hurfeish, North District, Israel
            </p>
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

function Field({
  label,
  children,
  error,
  errorId,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  errorId?: string;
}) {
  return (
    <label className="auth-field block text-start">
      <span className="auth-field-label field-label">{label}</span>
      {children}
      {error && errorId ? (
        <span id={errorId} className="auth-field-error" role="alert">
          {error}
        </span>
      ) : null}
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
