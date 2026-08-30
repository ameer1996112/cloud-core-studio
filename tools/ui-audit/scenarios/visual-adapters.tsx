import { useState } from "react";
import { AppMarketingPage } from "../../../src/components/app-marketing/AppMarketingPage";
import { AuthPanel, type AuthPanelMode } from "../../../src/components/auth/AuthPanel";
import { PasswordResetPanel } from "../../../src/components/auth/PasswordResetPanel";
import { SignupNotificationChoices } from "../../../src/components/auth/SignupNotificationChoices";
import { InstagramPresentation } from "../../../src/components/public/InstagramPresentation";
import { MemberOutcomePanel } from "../../../src/components/member/MemberOutcomePanel";
import { MemberEmptyState } from "../../../src/components/member/PremiumClassCard";
import { YogaPromoPresentation } from "../../../src/components/member/YogaPromoPresentation";
import {
  ScheduleDaySection,
  VisualClassCard,
} from "../../../src/components/visual/VisualClassCard";
import { deriveMemberOutcome } from "../../../src/lib/member-account-view-state";
import { tForLang } from "../../../src/lib/i18n";
import { DownloadPresentation } from "../../../src/routes/download";
import { PrivacyPresentation } from "../../../src/routes/privacy";
import { SupportPresentation } from "../../../src/routes/support";
import { TermsPresentation } from "../../../src/routes/terms";
import type { AuditRenderContext, ComponentEvidence, VisualAuditScenario } from "../types";

type VisualAdapter = {
  evidence: ComponentEvidence;
  render: VisualAuditScenario["render"];
};

export const task15AuthSubmitOutcomes = {
  he: {
    signin: "טופס הכניסה נקלט בבטחה.",
    signup: "טופס ההרשמה נקלט בבטחה.",
    forgot: "בקשת האיפוס נקלטה בבטחה.",
    "check-email": "בקשת האימייל נקלטה בבטחה.",
  },
  ar: {
    signin: "تم استلام نموذج الدخول بأمان.",
    signup: "تم استلام نموذج التسجيل بأمان.",
    forgot: "تم استلام طلب إعادة الضبط بأمان.",
    "check-email": "تم استلام طلب البريد بأمان.",
  },
  en: {
    signin: "Sign-in form received safely.",
    signup: "Sign-up form received safely.",
    forgot: "Reset request received safely.",
    "check-email": "Email request received safely.",
  },
} as const;

export const task15ScheduleDetailsOutcomes = {
  he: "פרטי השיעור נפתחו.",
  ar: "تم فتح تفاصيل الحصة.",
  en: "Class details opened.",
} as const;

function component(
  module: string,
  exported: string,
  marker: ComponentEvidence["marker"],
  render: (context: AuditRenderContext) => React.ReactNode,
): VisualAdapter {
  return { evidence: { type: "component", source: { module, export: exported }, marker }, render };
}

function AuthFixture({
  language,
  mode,
  state = "default",
}: AuditRenderContext & { mode: AuthPanelMode; state?: "default" | "disabled" }) {
  const disabled = state === "disabled";
  const [submitted, setSubmitted] = useState(false);
  const [whatsapp, setWhatsapp] = useState(false);
  const [marketing, setMarketing] = useState(false);
  return (
    <div className="auth-mobile-stage bg-[var(--color-surface-warm)] px-4 py-8">
      <div className="auth-mobile-panel">
        <AuthPanel mode={mode} state={state} lang={language}>
          <form
            className="auth-form mt-4 sm:mt-5"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmitted(true);
            }}
          >
            {mode === "signup" ? (
              <label className="field-group">
                <span className="field-label">{tForLang(language, "auth.name")}</span>
                <input
                  className="auth-text-input editorial-input"
                  defaultValue="Maya Cohen"
                  disabled={disabled}
                />
              </label>
            ) : null}
            <label className="field-group">
              <span className="field-label">{tForLang(language, "auth.email")}</span>
              <input
                className="auth-ltr-input editorial-input"
                type="email"
                defaultValue="member@example.test"
                disabled={disabled}
              />
            </label>
            {mode !== "forgot" ? (
              <label className="field-group">
                <span className="field-label">{tForLang(language, "auth.password")}</span>
                <input
                  className="auth-ltr-input editorial-input"
                  type="password"
                  defaultValue="fixture-password"
                  disabled={disabled}
                />
              </label>
            ) : null}
            {mode === "signup" ? (
              <SignupNotificationChoices
                lang={language}
                phone="0559398438"
                whatsapp={whatsapp}
                marketing={marketing}
                disabled={disabled}
                onWhatsappChange={setWhatsapp}
                onMarketingChange={setMarketing}
              />
            ) : null}
            <button className="cta-navy" type="submit" disabled={disabled}>
              {mode === "signin"
                ? tForLang(language, "auth.enter")
                : mode === "signup"
                  ? tForLang(language, "auth.reserve")
                  : tForLang(language, "auth.reset")}
            </button>
            <p role="status" aria-live="polite" aria-atomic="true" data-task15-auth-status={mode}>
              {submitted ? task15AuthSubmitOutcomes[language][mode] : ""}
            </p>
          </form>
        </AuthPanel>
      </div>
    </div>
  );
}

const scheduleClass = {
  id: "audit-aerial-flow",
  title: "Aerial Yoga Flow",
  title_en: "Aerial Yoga Flow",
  title_he: "יוגה אווירית Flow",
  title_ar: "يوغا هوائية Flow",
  starts_at: "2026-08-29T09:00:00+03:00",
  duration_minutes: 50,
  capacity: 8,
  booked_count: 2,
  credit_cost: 1,
  cancellation_window_hours: 4,
  status: "scheduled",
  instructor: { name: "Lina" },
  program_type: {
    name: "Aerial Yoga",
    name_en: "Aerial Yoga",
    name_he: "יוגה אווירית",
    name_ar: "يوغا هوائية",
  },
};

function GuestScheduleDefault({ language }: AuditRenderContext) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <section className="member-page w-full space-y-6 p-5" aria-labelledby="guest-schedule-title">
      <h1 id="guest-schedule-title">
        {language === "en" ? "Class schedule" : tForLang(language, "nav.schedule")}
      </h1>
      <ScheduleDaySection date={new Date("2026-08-29T09:00:00+03:00")} count={1}>
        <VisualClassCard
          cls={scheduleClass}
          state={{ kind: "available", spotsLeft: 6 }}
          bookingPresentationAudience="guest"
          onOpen={() => setDetailsOpen(true)}
          eager
        />
      </ScheduleDaySection>
      <p role="status" aria-live="polite" aria-atomic="true" data-task15-schedule-details>
        {detailsOpen ? task15ScheduleDetailsOutcomes[language] : ""}
      </p>
    </section>
  );
}

function GuestScheduleEmpty({ language }: AuditRenderContext) {
  return (
    <section className="member-page w-full space-y-6 p-5" aria-labelledby="guest-schedule-title">
      <h1 id="guest-schedule-title">{tForLang(language, "nav.schedule")}</h1>
      <MemberEmptyState
        variant="schedule"
        title={tForLang(language, "member.empty.schedule.title")}
        body={tForLang(language, "member.empty.schedule.body")}
        illustration="schedule"
      />
    </section>
  );
}

function PaymentFixture({ language, failed = false }: AuditRenderContext & { failed?: boolean }) {
  const kind = failed ? "payment-failed" : "payment-succeeded";
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md items-center px-5">
      <MemberOutcomePanel
        data-product-view={failed ? "payment-failed" : "payment-success"}
        outcome={deriveMemberOutcome({ kind, lang: language })}
        showAction={false}
        headingLevel="h1"
        className="w-full"
      />
    </div>
  );
}

export const visualAdapters: Readonly<Record<string, VisualAdapter>> = {
  "public|/auth|default": component(
    "src/components/auth/AuthPanel.tsx",
    "AuthPanel",
    '[data-product-view="auth-signin-default"]',
    ({ language }) => <AuthFixture language={language} mode="signin" />,
  ),
  "public|/auth?mode=signup|default": component(
    "src/components/auth/AuthPanel.tsx",
    "AuthPanel",
    '[data-product-view="auth-signup-default"]',
    ({ language }) => <AuthFixture language={language} mode="signup" />,
  ),
  "public|/auth?mode=signup|disabled": component(
    "src/components/auth/AuthPanel.tsx",
    "AuthPanel",
    '[data-product-view="auth-signup-disabled"]',
    ({ language }) => <AuthFixture language={language} mode="signup" state="disabled" />,
  ),
  "public|/auth?mode=forgot|default": component(
    "src/components/auth/AuthPanel.tsx",
    "AuthPanel",
    '[data-product-view="auth-forgot-default"]',
    ({ language }) => <AuthFixture language={language} mode="forgot" />,
  ),
  "public|/reset-password|error": component(
    "src/components/auth/PasswordResetPanel.tsx",
    "PasswordResetPanel",
    '[data-product-view="password-reset-invalid"]',
    ({ language }) => (
      <PasswordResetPanel status="invalid" lang={language}>
        <div className="mt-7 space-y-3">
          <a href="/auth?mode=forgot" className="cta-navy block text-center">
            {tForLang(language, "reset.requestNew")}
          </a>
        </div>
      </PasswordResetPanel>
    ),
  ),
  "public|/member/schedule|default": component(
    "src/components/visual/VisualClassCard.tsx",
    "VisualClassCard",
    '[data-product-view="guest-schedule-default"]',
    (context) => <GuestScheduleDefault {...context} />,
  ),
  "public|/member/schedule|empty": component(
    "src/components/member/PremiumClassCard.tsx",
    "MemberEmptyState",
    '[data-product-view="guest-schedule-empty"]',
    (context) => <GuestScheduleEmpty {...context} />,
  ),
  "public|/privacy|default": component(
    "src/routes/privacy.tsx",
    "PrivacyPresentation",
    '[data-product-view="privacy-default"]',
    ({ language }) => <PrivacyPresentation lang={language} />,
  ),
  "public|/terms|default": component(
    "src/routes/terms.tsx",
    "TermsPresentation",
    '[data-product-view="terms-default"]',
    ({ language }) => <TermsPresentation lang={language} />,
  ),
  "public|/support|default": component(
    "src/routes/support.tsx",
    "SupportPresentation",
    '[data-product-view="support-default"]',
    ({ language }) => (
      <SupportPresentation
        lang={language}
        legalLabels={{
          privacy: tForLang(language, "legal.privacy"),
          terms: tForLang(language, "legal.terms"),
          checkout: tForLang(language, "legal.checkout"),
        }}
      />
    ),
  ),
  "public|/payment-result?status=success|success": component(
    "src/components/member/MemberOutcomePanel.tsx",
    "MemberOutcomePanel",
    '[data-product-view="payment-success"]',
    (context) => <PaymentFixture {...context} />,
  ),
  "public|/payment-result?status=failed|error": component(
    "src/components/member/MemberOutcomePanel.tsx",
    "MemberOutcomePanel",
    '[data-product-view="payment-failed"]',
    (context) => <PaymentFixture {...context} failed />,
  ),
  "public|/app|default": component(
    "src/components/app-marketing/AppMarketingPage.tsx",
    "AppMarketingPage",
    '[data-product-view="app-marketing-default"]',
    ({ language }) => (
      <AppMarketingPage
        lang={language}
        appStoreUrl="https://apps.apple.com/app/id6744870732"
        profile={{
          address: "Main Road 89, Hurfeish",
          contactEmail: "cloudandcorestudio@gmail.com",
          instagramUrl: "https://www.instagram.com/cloudandcorestudio/",
          publicPhone: "055-939-8438",
          whatsappNumber: "972559398438",
        }}
      />
    ),
  ),
  "public|/download|default": component(
    "src/routes/download.tsx",
    "DownloadPresentation",
    '[data-product-view="download-default"]',
    () => (
      <DownloadPresentation
        iosHref="https://apps.apple.com/app/id6744870732"
        iosNativeHref="itms-apps://apps.apple.com/app/id6744870732"
        androidHref=""
      />
    ),
  ),
  "public|/instagram|default": component(
    "src/components/public/InstagramPresentation.tsx",
    "InstagramPresentation",
    '[data-product-view="instagram-default"]',
    () => (
      <InstagramPresentation
        address="Main Road 89, Hurfeish"
        contactEmail="cloudandcorestudio@gmail.com"
        whatsappHref="https://wa.me/972559398438"
      />
    ),
  ),
  "public|/promo/yoga-lina|default": component(
    "src/components/member/YogaPromoPresentation.tsx",
    "YogaPromoPresentation",
    '[data-product-view="yoga-promo-active"]',
    ({ language }) => (
      <section className="mx-auto max-w-5xl p-6" aria-labelledby="promo-title">
        <h1 id="promo-title">Cloud &amp; Core Yoga</h1>
        <YogaPromoPresentation
          state="active"
          title={tForLang(language, "promo.yoga.title")}
          body={tForLang(language, "promo.yoga.activeBody")}
          remaining={tForLang(language, "promo.yoga.remaining.many", { remaining: 7 })}
          dir={language === "en" ? "ltr" : "rtl"}
        />
      </section>
    ),
  ),
};
