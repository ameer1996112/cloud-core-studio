import type { ReactNode } from "react";

import { t, type Lang } from "@/lib/i18n";

export type AuthPanelMode = "signin" | "signup" | "forgot" | "check-email";
export type AuthPanelState = "default" | "disabled" | "loading" | "error" | "success";

export function AuthPanel({
  mode,
  state = "default",
  lang,
  packageReturn = false,
  children,
}: {
  mode: AuthPanelMode;
  state?: AuthPanelState;
  lang: Lang;
  packageReturn?: boolean;
  children: ReactNode;
}) {
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
        : mode === "check-email"
          ? t("auth.checkEmailTitle")
          : t("auth.forgotHeadline");

  return (
    <div
      className="auth-form-card member-card relative"
      data-product-view={`auth-${mode}-${state}`}
      data-auth-mode={mode}
      data-auth-state={state}
    >
      <p className="member-eyebrow">{eyebrow}</p>
      <h1 className="auth-form-title mt-2 text-balance font-semibold text-navy">{headline}</h1>
      <div className="mt-3 h-px w-10 bg-gold" />
      {mode === "forgot" || mode === "check-email" ? (
        <p className="auth-form-helper mt-3 text-start text-sm text-slate">
          {mode === "forgot" ? t("auth.forgotBody") : t("auth.resetSent")}
        </p>
      ) : null}
      {mode === "signin" && packageReturn ? (
        <p className="auth-form-helper mt-3 text-start text-sm text-slate">
          {t("auth.returnToPackagesBody")}
        </p>
      ) : null}
      {children}
    </div>
  );
}
