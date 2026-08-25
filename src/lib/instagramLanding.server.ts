/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase schema omits kid_aerial_packages. */
import { STUDIO_INSTAGRAM_URL } from "@/lib/instagramLanding";

export type InstagramAdultPlan = {
  code: string;
  credits: number;
  durationDays: number | null;
  name: string;
  priceIls: number;
};

export type InstagramKidsPlan = {
  code: string;
  creditsPerPeriod: number;
  name: string;
  periodDays: number;
  priceIls: number;
  recurringAvailable: boolean;
  totalPeriods: number;
};

export type InstagramLandingData = {
  address: string | null;
  adultPlans: InstagramAdultPlan[];
  contactEmail: string | null;
  instagramUrl: string;
  kidsCapacity: number | null;
  kidsPlans: InstagramKidsPlan[];
  publicPhone: string | null;
  trialClassAllowed: boolean;
  whatsappNumber: string | null;
};

export async function loadInstagramLandingData(): Promise<InstagramLandingData> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [settingsResult, adultPlansResult, kidsPlansResult, kidsProgramResult] = await Promise.all([
    supabaseAdmin
      .from("studio_settings")
      .select(
        "address,contact_email,instagram_url,public_phone,trial_class_allowed,whatsapp_number",
      )
      .eq("id", 1)
      .maybeSingle(),
    supabaseAdmin
      .from("plans")
      .select("name,description,credits,duration_days,price_cents,currency")
      .eq("active", true)
      .order("price_cents", { ascending: true }),
    (supabaseAdmin as any)
      .from("kid_aerial_packages")
      .select("code,name,price,credits_per_period,total_periods,period_days,recurring_available")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabaseAdmin
      .from("program_types")
      .select("default_capacity")
      .eq("slug", "kids-aerial-yoga")
      .eq("active", true)
      .maybeSingle(),
  ]);

  if (settingsResult.error) throw settingsResult.error;

  const settings = settingsResult.data;
  const adultPlans = adultPlansResult.error
    ? []
    : (adultPlansResult.data ?? [])
        .filter((plan) => plan.currency === "ILS")
        .map((plan) => ({
          code: plan.description?.trim() || plan.name.toLowerCase().replace(/\s+/g, "_"),
          credits: plan.credits,
          durationDays: plan.duration_days,
          name: plan.name,
          priceIls: plan.price_cents / 100,
        }));
  const kidsPlans = kidsPlansResult.error
    ? []
    : (kidsPlansResult.data ?? []).map((plan: any) => ({
        code: String(plan.code),
        creditsPerPeriod: Number(plan.credits_per_period),
        name: String(plan.name),
        periodDays: Number(plan.period_days),
        priceIls: Number(plan.price),
        recurringAvailable: Boolean(plan.recurring_available),
        totalPeriods: Number(plan.total_periods),
      }));

  return {
    address: settings?.address?.trim() || null,
    adultPlans,
    contactEmail: settings?.contact_email?.trim() || null,
    instagramUrl: settings?.instagram_url?.trim() || STUDIO_INSTAGRAM_URL,
    kidsCapacity: kidsProgramResult.error
      ? null
      : (kidsProgramResult.data?.default_capacity ?? null),
    kidsPlans,
    publicPhone: settings?.public_phone?.trim() || null,
    trialClassAllowed: settings?.trial_class_allowed !== false,
    whatsappNumber: settings?.whatsapp_number?.trim() || settings?.public_phone?.trim() || null,
  };
}
