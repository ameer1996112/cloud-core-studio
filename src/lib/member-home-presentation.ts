import type { MemberHomeData } from "@/components/member/MemberHomeContent";

export function sourceTextAttributes(text: string) {
  if (/[\u0590-\u05ff]/.test(text)) return { lang: "he", dir: "rtl" as const };
  if (/[\u0600-\u06ff]/.test(text)) return { lang: "ar", dir: "rtl" as const };
  return { dir: "auto" as const };
}

export function nextHomeBooking(upcoming: MemberHomeData["upcoming"]) {
  return (
    [...upcoming].sort(
      (a, b) => Date.parse(a.class.starts_at) - Date.parse(b.class.starts_at),
    )[0] ?? null
  );
}

/** Match the existing package screen's entitlement convention, without changing eligibility. */
export function membershipPresentation(plan: MemberHomeData["activePlan"], now = Date.now()) {
  return {
    unlimited: !!plan?.plan && (plan.plan.credits >= 999 || /unlim/i.test(plan.plan.name)),
    expired: !!plan?.expires_at && Date.parse(plan.expires_at) <= now,
  };
}
