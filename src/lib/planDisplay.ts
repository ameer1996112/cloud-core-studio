import { t, type Lang } from "@/lib/i18n";

type PlanCopy = {
  name: string;
  description: string;
  memberLine: string;
  adminLine: string;
};

const PLAN_COPY: Record<string, Record<Lang, PlanCopy>> = {
  single_class: {
    en: {
      name: "Single Class",
      description: "A single class to get to know the studio.",
      memberLine: "1 credit · valid for 14 days",
      adminLine: "1 credit · 14 days",
    },
    he: {
      name: "כניסה חד־פעמית",
      description: "שיעור בודד להיכרות עם הסטודיו",
      memberLine: "כניסה אחת · בתוקף ל־14 ימים",
      adminLine: "כניסה אחת · 14 ימים",
    },
    ar: {
      name: "حصة واحدة",
      description: "حصة واحدة للتعرّف على الاستوديو.",
      memberLine: "دخول واحد · صالح لمدة 14 يوم",
      adminLine: "دخول واحد · 14 يوم",
    },
  },
  monthly_once_week: {
    en: {
      name: "Monthly Membership — Once a Week",
      description: "Monthly plan with 5 class credits, perfect for attending once a week.",
      memberLine: "5 credits per month · once a week",
      adminLine: "5 credits · once a week · 30 days",
    },
    he: {
      name: "מנוי חודשי — 5 כניסות",
      description: "מתאים למי שמגיעה פעם בשבוע",
      memberLine: "5 כניסות · בתוקף ל־30 ימים",
      adminLine: "5 כניסות · פעם בשבוע · 30 ימים",
    },
    ar: {
      name: "اشتراك شهري — مرة بالأسبوع",
      description: "اشتراك شهري يشمل 5 حصص بالشهر، مناسب للي بدها تيجي مرة بالأسبوع.",
      memberLine: "5 حصص بالشهر · مناسب لمرة بالأسبوع",
      adminLine: "5 حصص · مرة بالأسبوع · 30 يوم",
    },
  },
  monthly_twice_week: {
    en: {
      name: "Monthly Membership — Twice a Week",
      description: "Monthly plan with 10 class credits, ideal for attending twice a week.",
      memberLine: "10 credits per month · twice a week",
      adminLine: "10 credits · twice a week · 30 days",
    },
    he: {
      name: "מנוי חודשי — 10 כניסות",
      description: "הבחירה הטובה למי שרוצה להתקדם ולהתמיד",
      memberLine: "10 כניסות · בתוקף ל־30 ימים",
      adminLine: "10 כניסות · פעמיים בשבוע · 30 ימים",
    },
    ar: {
      name: "اشتراك شهري — مرتين بالأسبوع",
      description: "اشتراك شهري يشمل 10 حصص بالشهر، مناسب للي بدها تيجي مرتين بالأسبوع.",
      memberLine: "10 حصص بالشهر · مناسب لمرتين بالأسبوع",
      adminLine: "10 حصص · مرتين بالأسبوع · 30 يوم",
    },
  },
  cloud_monthly_1x_week: {
    en: {
      name: "Monthly Membership — Once a Week",
      description: "Monthly plan with 5 class credits, perfect for attending once a week.",
      memberLine: "5 credits per month · once a week",
      adminLine: "5 credits · once a week · 30 days",
    },
    he: {
      name: "מנוי חודשי — 5 כניסות",
      description: "מתאים למי שמגיעה פעם בשבוע",
      memberLine: "5 כניסות · בתוקף ל־30 ימים",
      adminLine: "5 כניסות · פעם בשבוע · 30 ימים",
    },
    ar: {
      name: "اشتراك شهري — مرة بالأسبوع",
      description: "اشتراك شهري يشمل 5 حصص بالشهر، مناسب للي بدها تيجي مرة بالأسبوع.",
      memberLine: "5 حصص بالشهر · مناسب لمرة بالأسبوع",
      adminLine: "5 حصص · مرة بالأسبوع · 30 يوم",
    },
  },
  cloud_monthly_2x_week: {
    en: {
      name: "Monthly Membership — Twice a Week",
      description: "Monthly plan with 10 class credits, ideal for attending twice a week.",
      memberLine: "10 credits per month · twice a week",
      adminLine: "10 credits · twice a week · 30 days",
    },
    he: {
      name: "מנוי חודשי — 10 כניסות",
      description: "הבחירה הטובה למי שרוצה להתקדם ולהתמיד",
      memberLine: "10 כניסות · בתוקף ל־30 ימים",
      adminLine: "10 כניסות · פעמיים בשבוע · 30 ימים",
    },
    ar: {
      name: "اشتراك شهري — مرتين بالأسبوع",
      description: "اشتراك شهري يشمل 10 حصص بالشهر، مناسب للي بدها تيجي مرتين بالأسبوع.",
      memberLine: "10 حصص بالشهر · مناسب لمرتين بالأسبوع",
      adminLine: "10 حصص · مرتين بالأسبوع · 30 يوم",
    },
  },
  cloud_10_entry_card: {
    en: {
      name: "10-entry card",
      description: "10 entries with no monthly commitment",
      memberLine: "10 credits",
      adminLine: "10 credits",
    },
    he: {
      name: "כרטיסייה · 10 כניסות",
      description: "גמישות מלאה ללא התחייבות חודשית",
      memberLine: "10 כניסות · בתוקף ל־90 ימים",
      adminLine: "10 כניסות",
    },
    ar: {
      name: "بطاقة 10 دخولات",
      description: "10 دخولات بدون التزام شهري",
      memberLine: "10 دخولات",
      adminLine: "10 دخولات",
    },
  },
};

export function getPlanDisplay(plan: any, lang: Lang) {
  const code = typeof plan?.description === "string" ? plan.description : "";
  const copy = PLAN_COPY[code]?.[lang];
  if (copy) return copy;

  return {
    name: plan?.name ?? t("nav.plans"),
    description:
      typeof plan?.description === "string" &&
      !plan.description.startsWith("cloud_") &&
      !isKnownLaunchSlug(plan.description)
        ? plan.description
        : "",
    memberLine: defaultPlanLine(plan, lang),
    adminLine: defaultPlanLine(plan, lang),
  };
}

export function formatPlanPrice(plan: any) {
  const amount = Number(plan?.price_cents ?? 0) / 100;
  if ((plan?.currency ?? "ILS") === "ILS") return `₪${amount.toFixed(0)}`;
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: plan?.currency ?? "ILS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function isKnownLaunchSlug(value: string) {
  return Boolean(PLAN_COPY[value]);
}

function defaultPlanLine(plan: any, lang: Lang) {
  const credits = Number(plan?.credits ?? 0);
  const days = Number(plan?.duration_days ?? 0);
  if (lang === "he") {
    const creditText = credits === 1 ? "כניסה אחת" : `${credits} כניסות`;
    return days ? `${creditText} · בתוקף ל־${days} ימים` : creditText;
  }
  if (lang === "ar") {
    const creditText = credits === 1 ? "دخول واحد" : `${credits} دخولات`;
    return days ? `${creditText} · صالح لمدة ${days} يوم` : creditText;
  }
  const creditText = credits === 1 ? "1 credit" : `${credits} credits`;
  return days ? `${creditText} · valid for ${days} days` : creditText;
}
