import type { ReactNode } from "react";

import { t, type Lang } from "@/lib/i18n";

export type PasswordResetStatus = "validating" | "ready" | "invalid";

export function PasswordResetPanel({
  status,
  lang,
  children,
}: {
  status: PasswordResetStatus;
  lang: Lang;
  children?: ReactNode;
}) {
  const dir = lang === "en" ? "ltr" : "rtl";
  return (
    <div
      className="auth-form-card member-card w-full max-w-sm p-8"
      lang={lang}
      dir={dir}
      data-product-view={`password-reset-${status}`}
    >
      <div className="auth-brand-lockup">
        <img
          src="/brand/cloud-core-logo-full.png"
          alt="Cloud & Core Studio"
          width={180}
          height={102}
          className="auth-brand-logo"
        />
      </div>
      <p className="member-eyebrow mt-6">{t("reset.eyebrow")}</p>
      <h1 className="auth-form-title mt-3 text-balance font-semibold text-navy">
        {status === "ready"
          ? t("reset.headline")
          : status === "invalid"
            ? t("reset.invalidTitle")
            : t("reset.validatingTitle")}
      </h1>
      <div className="mt-4 h-px w-12 bg-gold" />
      <p className="mt-4 text-start text-sm text-slate">
        {status === "ready"
          ? t("reset.hint.ready")
          : status === "invalid"
            ? t("reset.invalidBody")
            : t("reset.hint.loading")}
      </p>
      {children}
    </div>
  );
}
