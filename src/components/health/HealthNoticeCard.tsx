import { ArrowLeft, ArrowRight, ClipboardCheck } from "lucide-react";
import type { HealthOnboarding } from "@/lib/health-onboarding";
import { onboardingCopy } from "@/lib/health-onboarding-copy";
import { healthPolicyCopy } from "@/lib/health-policy-copy";
import { useI18n } from "@/lib/i18n";
import "./health-notice.css";

export function HealthNoticeCard({ state }: { state: HealthOnboarding }) {
  const { lang, dir } = useI18n();
  const c = onboardingCopy[lang];
  const action = {
    he: "למילוי ההצהרה",
    en: "Complete declaration",
    ar: "تعبئة الإقرار",
  }[lang];
  const Arrow = dir === "rtl" ? ArrowLeft : ArrowRight;
  return (
    <aside className="health-home-notice" dir={dir}>
      <div className="health-home-notice-heading">
        <ClipboardCheck size={22} strokeWidth={1.5} aria-hidden="true" />
        <h2>{c.title}</h2>
      </div>
      <div className="health-home-notice-copy">
        {state.renewalDue && <p>{healthPolicyCopy[lang].renewal}</p>}
        {state.parentRenewalDue && (
          <p>
            {healthPolicyCopy[lang].parentRenewal}{" "}
            <a href="/health-parent">{healthPolicyCopy[lang].renew}</a>
          </p>
        )}
        <p>{state.needsNotice ? c.notice : state.status === "valid" ? c.valid : c.intro}</p>
      </div>
      <div className="health-home-notice-footer">
        {state.graceEndsAt && (
          <p className="health-home-notice-deadline">
            {c.grace}{" "}
            <time dateTime={state.graceEndsAt}>
              <bdi>{new Date(state.graceEndsAt).toLocaleDateString(lang)}</bdi>
            </time>
          </p>
        )}
        <a className="health-home-notice-action" href="/member/health">
          <span>{state.status === "valid" ? c.title : action}</span>
          <Arrow size={18} strokeWidth={1.5} aria-hidden="true" />
        </a>
      </div>
    </aside>
  );
}
