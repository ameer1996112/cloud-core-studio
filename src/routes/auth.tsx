import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { applyLang, getStoredLang, LANG_META, t, useI18n, type Lang } from "@/lib/i18n";
import { toast } from "sonner";
import { homeForCurrentUser, roleHome, getCurrentRole } from "@/lib/auth-redirect";

import { studioImages } from "@/lib/image-assets";
const BG_SRC = studioImages.loginHero.src;

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "כניסה — Cloud & Core" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const initial = getStoredLang();
    applyLang(initial);
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
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
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data: signed, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { name } },
        });
        if (error) throw error;
        toast.success(t("auth.welcome"));
        const uid = signed.user?.id;
        const role = uid ? await getCurrentRole(uid) : "member";
        navigate({ to: roleHome(role), replace: true });
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success(t("auth.resetSent"));
        setMode("signin");
      } else {
        const { data: signed, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const uid = signed.user?.id;
        const role = uid ? await getCurrentRole(uid) : "member";
        navigate({ to: roleHome(role), replace: true });
      }
    } catch (err) {
      const { friendlyErrorMessage } = await import("@/lib/error-messages");
      const message = friendlyErrorMessage(err, t("auth.tryAgain"));
      setFormError(message);
    } finally {
      setBusy(false);
    }
  }

  function clearError() {
    if (formError) setFormError("");
  }

  const eyebrow =
    mode === "signin"
      ? t("auth.members")
      : mode === "signup"
        ? t("auth.newHere")
        : t("auth.recover");
  const headline =
    mode === "signin"
      ? t("auth.signinHeadline")
      : mode === "signup"
        ? t("auth.signupHeadline")
        : t("auth.forgotHeadline");

  return (
    <main
      className="auth-bg min-h-[100dvh] text-navy flex flex-col relative"
      style={{ backgroundImage: `url(${BG_SRC})` }}
    >
      <div className="auth-bg-overlay" aria-hidden="true" />

      <div className="auth-shell relative z-10 flex flex-col min-h-[100dvh]">
        <header className="auth-topbar auth-topbar-on-image" dir="ltr">
          <span className="font-display text-xl text-ivory drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]">
            Cloud &amp; Core
          </span>
          <div
            className="auth-lang-switch auth-lang-switch-on-image"
            role="group"
            aria-label="Language"
          >
            {(Object.keys(LANG_META) as Lang[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => changeLang(code)}
                aria-pressed={lang === code}
                className={`auth-lang-btn ${lang === code ? "is-active" : ""}`}
              >
                {LANG_META[code].label}
              </button>
            ))}
          </div>
        </header>

        <section className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="auth-card auth-card-glass">
            <p className="member-eyebrow">{eyebrow}</p>
            <h1 className="font-display italic text-[2.1rem] leading-[1.05] text-navy mt-3 text-start">
              {headline}
            </h1>
            <div className="mt-4 h-px w-12 bg-gold" />

            <form onSubmit={submit} className="space-y-4 mt-7" dir="auto">
              {mode === "signup" && (
                <Field label={t("auth.name")}>
                  <input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      clearError();
                    }}
                    required
                    className="editorial-input focus:editorial-input-focus"
                    autoComplete="name"
                  />
                </Field>
              )}
              <Field label={t("auth.email")}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearError();
                  }}
                  required
                  className="editorial-input focus:editorial-input-focus"
                  autoComplete="email"
                  dir="ltr"
                />
              </Field>
              {mode !== "forgot" && (
                <Field label={t("auth.password")}>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearError();
                      }}
                      required
                      minLength={6}
                      className="editorial-input focus:editorial-input-focus pr-10"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center text-slate hover:text-navy"
                      aria-label={showPassword ? t("auth.hideSecret") : t("auth.showSecret")}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {mode === "signup" && <PasswordStrength password={password} />}
                </Field>
              )}

              {formError && (
                <p className="auth-form-error" role="alert" aria-live="polite">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className={
                  busy ? "cta-navy cta-navy-disabled mt-3" : "cta-navy hover:cta-navy-hover mt-3"
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

              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setFormError("");
                  }}
                  className="flex min-h-11 w-full items-center justify-center text-center text-[12px] text-slate hover:text-navy"
                >
                  {t("auth.forgot")}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setFormError("");
                }}
                className="flex min-h-11 w-full items-center justify-center border-t hairline text-center text-[12px] text-gold hover:text-navy"
              >
                {mode === "signin"
                  ? t("auth.create")
                  : mode === "signup"
                    ? t("auth.already")
                    : t("auth.back")}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-start">
      <span className="field-label">{label}</span>
      {children}
    </label>
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
  return (
    <div className="mt-3">
      <div className="flex gap-1 mb-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-px flex-1 transition-colors ${i < score ? "bg-gold" : "bg-[rgba(11,29,58,0.12)]"}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-slate">{t("auth.strength")}</span>
        <span className="text-[11px] text-navy">{password ? t(levels[score]) : ""}</span>
      </div>
      <ul className="space-y-1">
        {checks.map((c) => (
          <li
            key={c.label}
            className={`text-[11px] flex items-center gap-2 ${c.ok ? "text-navy" : "text-slate"}`}
          >
            <span aria-hidden className={c.ok ? "text-gold" : ""}>
              {c.ok ? "✓" : "○"}
            </span>
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
