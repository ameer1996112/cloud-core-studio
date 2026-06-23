import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (data?.role !== "admin") throw new Error("forbidden");
}

export const listRooms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("rooms").select("*").order("name");
    if (error) throw error;
    return data ?? [];
  });

const roomInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  description: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  capacity: z.number().int().positive().max(200),
  equipment_count: z.number().int().min(0).max(200),
  setup_minutes_before: z.number().int().min(0).max(120),
  setup_minutes_after: z.number().int().min(0).max(120),
  color: z.string().regex(/^#([0-9A-Fa-f]{6})$/),
  notes: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export const upsertRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => roomInput.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await (context.supabase as any).from("rooms").update(rest).eq("id", id);
      if (error) throw error;
      return { id };
    }
    const { data: row, error } = await context.supabase
      .from("rooms")
      .insert(data)
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const deleteRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("rooms").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/** Returns a signed URL valid for `expiresInSeconds` for a private studio-media object. */
export const signMediaUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        path: z.string().min(1),
        expiresInSeconds: z
          .number()
          .int()
          .positive()
          .max(60 * 60 * 24)
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await (context.supabase as any).storage
      .from("studio-media")
      .createSignedUrl(data.path, data.expiresInSeconds ?? 60 * 60 * 6);
    if (error) throw error;
    return { url: signed.signedUrl };
  });
