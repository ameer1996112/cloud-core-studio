import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PUBLIC_COLS =
  "studio_name,public_phone,whatsapp_number,contact_email,address,instagram_url,website_url,currency,timezone,supported_languages,booking_window_days,allow_waitlist,trial_class_allowed,logo_url,fallback_image_url,welcome_text,announcement_text,default_language,payments_enabled,payments_provider";

export type PublicStudioSettings = {
  studio_name: string | null;
  public_phone: string | null;
  whatsapp_number: string | null;
  contact_email: string | null;
  address: string | null;
  instagram_url: string | null;
  website_url: string | null;
  currency: string;
  timezone: string;
  supported_languages: string[];
  booking_window_days: number;
  allow_waitlist: boolean;
  trial_class_allowed: boolean;
  logo_url: string | null;
  fallback_image_url: string | null;
  welcome_text: string | null;
  announcement_text: string | null;
  default_language: string;
  payments_enabled: boolean;
  payments_provider: string;
};

export const getPublicStudioSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("studio_settings")
      .select(PUBLIC_COLS)
      .eq("id", 1)
      .maybeSingle();
    return (data ?? null) as PublicStudioSettings | null;
  });

export const getStudioSettingsFull = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .maybeSingle();
    if (prof?.role !== "admin") throw new Error("forbidden");
    const { data } = await context.supabase
      .from("studio_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    return data;
  });

const settingsSchema = z.object({
  studio_name: z.string().min(1),
  public_phone: z.string().nullable().optional(),
  whatsapp_number: z.string().nullable().optional(),
  contact_email: z.string().email().nullable().optional().or(z.literal("")),
  address: z.string().nullable().optional(),
  instagram_url: z.string().nullable().optional(),
  website_url: z.string().nullable().optional(),
  currency: z.string().min(2),
  timezone: z.string().min(2),
  supported_languages: z.array(z.string()).min(1),
  default_language: z.string().min(2),
  // Booking rules
  default_cancellation_window_hours: z.number().int().min(0),
  default_capacity: z.number().int().positive(),
  default_credit_cost: z.number().int().min(0),
  booking_window_days: z.number().int().min(1).max(180),
  registration_closes_minutes: z.number().int().min(0),
  allow_waitlist: z.boolean(),
  auto_promote_waitlist: z.boolean(),
  waitlist_claim_window_minutes: z.number().int().min(0),
  trial_class_allowed: z.boolean(),
  // Comms
  whatsapp_enabled: z.boolean(),
  email_enabled: z.boolean(),
  // Branding
  logo_url: z.string().nullable().optional(),
  fallback_image_url: z.string().nullable().optional(),
  welcome_text: z.string().nullable().optional(),
  announcement_text: z.string().nullable().optional(),
  // Existing arrays
  rooms: z.array(z.string()).default([]),
  energy_labels: z.array(z.string()).default([]),
  // Payments (provider-neutral foundation)
  payments_enabled: z.boolean().optional(),
  payments_provider: z.enum(["none", "manual", "hyp", "stripe", "paddle"]).optional(),
  payments_mode: z.enum(["test", "live"]).optional(),
  payments_success_url: z.string().nullable().optional(),
  payments_cancel_url: z.string().nullable().optional(),
  receipt_prefix: z.string().max(8).optional(),
  receipt_footer_note: z.string().nullable().optional(),
  invoice_provider: z.enum(["none", "greeninvoice", "icount", "ezcount"]).optional(),
});

export const updateStudioSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .maybeSingle();
    if (prof?.role !== "admin") throw new Error("forbidden");
    const clean = {
      ...data,
      contact_email: data.contact_email || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await context.supabase.from("studio_settings").update(clean).eq("id", 1);
    if (error) throw error;
    return { ok: true };
  });
