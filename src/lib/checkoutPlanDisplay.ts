import type { Lang } from "@/lib/i18n";
import { getPlanDisplay } from "@/lib/planDisplay";

export type CheckoutPlanDisplayInput = {
  code: string;
  credits: number;
  durationDays: number | null;
  name: string;
};

const GENERIC_PLAN_NAME: Record<Lang, string> = {
  en: "Class package",
  he: "חבילת שיעורים",
  ar: "باقة حصص",
};

export function getCheckoutPlanDisplay(plan: CheckoutPlanDisplayInput, lang: Lang) {
  const display = getPlanDisplay(
    {
      name: plan.name,
      description: plan.code,
      credits: plan.credits,
      duration_days: plan.durationDays,
    },
    lang,
  );

  return {
    ...display,
    name: lang !== "en" && display.name === plan.name ? GENERIC_PLAN_NAME[lang] : display.name,
  };
}
